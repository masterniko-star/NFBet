'use strict';
const fs=require('fs'), vm=require('vm'), path=require('path');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];

function clone(o){return JSON.parse(JSON.stringify(o||{}));}

// ---- in-memory firebase tree with REST semantics ----
function makeFetch(state){
  function segs(url){
    let u=url.replace(/^https?:\/\/[^/]+/,'');      // strip host
    u=u.replace(/\?.*$/,'');                          // strip query
    u=u.replace(/\.json$/,'');                        // strip .json
    return u.split('/').filter(Boolean);
  }
  function getAt(s){let n=state.tree;for(const k of s){if(n==null)return null;n=n[k];}return n==null?null:n;}
  function setAt(s,v){let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)n[s[i]]={};n=n[s[i]];}n[s[s.length-1]]=v;}
  function patchAt(s,v){let n=state.tree;for(const k of s){if(n[k]==null)n[k]={};n=n[k];}Object.assign(n,v);}
  function delAt(s){let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)return;n=n[s[i]];}delete n[s[s.length-1]];}
  return function(url,opts){
    opts=opts||{};const method=(opts.method||'GET').toUpperCase();
    if(/webws\.365scores\.com/.test(url)){
      return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(state.s365||{games:[]})});
    }
    if(/site\.api\.espn\.com/.test(url)){
      return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(state.espn||{events:[]})});
    }
    const s=segs(url);let body=null;try{body=opts.body?JSON.parse(opts.body):null;}catch(e){}
    let val=null;
    if(method==='GET'){val=s.length?getAt(s):state.tree;}
    else if(method==='PUT'){if(s.length)setAt(s,body);else state.tree=body;val=body;}
    else if(method==='PATCH'){if(s.length)patchAt(s,body);else Object.assign(state.tree,body);val=body;}
    else if(method==='DELETE'){if(s.length)delAt(s);val=null;}
    return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(val==null?null:clone(val))});
  };
}

// ---- fake DOM element (Proxy absorbs everything) ----
function makeEl(){
  const t={innerHTML:'',textContent:'',value:'',className:'',id:'',checked:false,disabled:false,
    clientWidth:0,scrollWidth:0,offsetWidth:0,tagName:'DIV',children:[],childNodes:[],parentNode:null,dataset:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    style:new Proxy({},{get(){return '';},set(){return true;}}),
    setAttribute(k,v){t[k]=v;},getAttribute(k){return (k in t)?t[k]:null;},removeAttribute(){},
    appendChild(){},removeChild(){},insertAdjacentHTML(){},remove(){},focus(){},blur(){},click(){},
    closest(){return null;},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;},
    querySelector(){return makeEl();},querySelectorAll(){return [];},
    getBoundingClientRect(){return {top:0,left:0,width:0,height:0};},scrollIntoView(){}};
  return new Proxy(t,{get(o,p){if(p in o)return o[p];return ()=>undefined;},set(o,p,v){o[p]=v;return true;}});
}

function loadApp(seed,opts){
  opts=opts||{};
  const state={tree:clone(seed||{}),espn:opts.espn||{events:[]},s365:opts.s365||{games:[]}};
  const elCache={};
  function q(sel){if(!elCache[sel])elCache[sel]=makeEl();return elCache[sel];}
  const document={querySelector:q,querySelectorAll:()=>[],getElementById:(id)=>q('#'+id),
    body:makeEl(),documentElement:makeEl(),activeElement:{tagName:'BODY'},hidden:false,
    createElement:()=>makeEl(),addEventListener(){},removeEventListener(){}};
  const mkStore=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};};
  const sandbox={console,Promise,Date,Math,JSON,parseInt,parseFloat,Number,String,Boolean,Array,Object,
    isNaN,isFinite,encodeURIComponent,decodeURIComponent,RegExp,Error,Symbol,Map,Set,
    document,navigator:{userAgent:'node',clipboard:{writeText:()=>Promise.resolve()}},
    localStorage:mkStore(),sessionStorage:mkStore(),
    location:{hash:opts.hash||'',origin:'https://test',pathname:'/',href:'https://test/',reload(){}},
    history:{back(){},pushState(){},replaceState(){}},
    btoa:s=>Buffer.from(String(s),'binary').toString('base64'),
    atob:s=>Buffer.from(String(s),'base64').toString('binary'),
    confirm:()=>opts.confirm!==false,alert(){},prompt:()=>null,
    setTimeout:(f,ms)=>setTimeout(f,ms),clearTimeout:id=>clearTimeout(id),
    setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,
    fetch:makeFetch(state)};
  sandbox.window=sandbox;sandbox.self=sandbox;sandbox.globalThis=sandbox;
  sandbox.window.scrollTo=()=>{};sandbox.window.open=()=>makeEl();sandbox.window.addEventListener=()=>{};
  vm.createContext(sandbox);
  let bootErr=null;
  try{vm.runInContext(script,sandbox,{filename:'app.js'});}catch(e){bootErr=e;}
  return {sandbox,state,q,mainHTML:()=>q('#main').innerHTML,bootErr};
}
const flush=async(n=30)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};

module.exports={loadApp,flush:async(n=40)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r))}};
