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
  const state={tree:clone(seed||{}),espn:opts.espn||{events:[]}};
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

// ---------------- TESTS ----------------
let fails=0,tests=0;
function ok(c,msg){tests++;if(!c){fails++;console.log('FAIL:',msg);}else console.log('ok  ',msg);}
function has(s,sub,msg){ok(typeof s==='string'&&s.indexOf(sub)>=0,msg+(s&&s.indexOf(sub)<0?' [missing: '+sub+']':''));}

const now=Date.now();
function dtLocal(off){const d=new Date(now+off);const p=n=>(n<10?'0':'')+n;return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());}

function seedBasic(){
  return {meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},
    players:{p0:{name:'Alice',pw:'1',feePaid:true,t:1},p1:{name:'Bob',pw:'2',feePaid:true,t:2},p2:{name:'Carol',pw:'3',feePaid:true,t:3}},
    matches:{
      m1:{round:'R32',order:0,t:1,teamA:'Czechia',teamB:'South Africa',dt:dtLocal(60*60e3),settled:false,winner:null},
      m2:{round:'R32',order:1,t:2,teamA:'Switzerland',teamB:'Bosnia-Herzegovina',dt:dtLocal(-60*60e3),settled:false,winner:null}, // locked
      m3:{round:'R32',order:2,t:3,teamA:'Canada',teamB:'Qatar',dt:'',settled:true,winner:'A'},
      m4:{round:'R32',order:3,t:4,teamA:'Brazil',teamB:'Serbia',dt:'',settled:true,winner:'X'} // draw
    },
    bets:{
      m1:{p0:{team:'A',stake:3},p1:{team:'B',stake:5}},
      m2:{p0:{team:'A',stake:2}},
      m3:{p0:{team:'A',stake:4},p1:{team:'B',stake:6}},
      m4:{p0:{team:'A',stake:3},p1:{team:'B',stake:3}}
    }};
}

(async()=>{
  console.log('===== B1. BOOT (no throw) =====');
  let app=loadApp({},{});
  ok(!app.bootErr,'boot with empty DB no throw'+(app.bootErr?' ['+app.bootErr+']':''));
  app=loadApp(seedBasic(),{});
  ok(!app.bootErr,'boot with seed data no throw'+(app.bootErr?' ['+app.bootErr+']':''));

  console.log('\n===== B2. RENDER ALL VIEWS (no throw + content) =====');
  function render(opts){const a=loadApp(seedBasic(),opts);a.sandbox.buildState(a.state.tree);
    if(opts.ME!==undefined)a.sandbox.ME=opts.ME; if(opts.MODE)a.sandbox.MODE=opts.MODE; if(opts.TAB)a.sandbox.TAB=opts.TAB;
    let err=null;try{a.sandbox.renderActive();}catch(e){err=e;}return {a,err,html:a.mainHTML()};}

  let r;
  r=render({MODE:'player',ME:null,TAB:'bet'}); ok(!r.err,'render identify (no me) no throw'+(r.err?' ['+r.err+']':''));
  r=render({MODE:'player',ME:'p0',TAB:'bet'}); ok(!r.err,'render bet view no throw'+(r.err?' ['+r.err+']':''));
    has(r.html,'ההימור נסגר','bet: locked match shows closed label');
    has(r.html,'Czechia','bet: open match team shown');
  r=render({MODE:'player',ME:'p0',TAB:'board'}); ok(!r.err,'render board no throw'+(r.err?' ['+r.err+']':''));
    has(r.html,'קופה','board: per-team pool label');
  r=render({MODE:'player',ME:'p0',TAB:'all'}); ok(!r.err,'render leaderboard no throw'+(r.err?' ['+r.err+']':''));
    has(r.html,'Alice','leaderboard: player listed');
  r=render({MODE:'player',ME:'p0',TAB:'hist'}); ok(!r.err,'render history no throw'+(r.err?' ['+r.err+']':''));
    has(r.html,'סגור חשבון','hist: close-account action present');
    has(r.html,'תיקו','hist: draw refund label for m4 present');
  r=render({MODE:'admin',ME:null,TAB:'players'}); ok(!r.err,'render admin players no throw'+(r.err?' ['+r.err+']':''));
    has(r.html,'Alice','admin players: name shown');
  r=render({MODE:'admin',ME:null,TAB:'matches'}); ok(!r.err,'render admin matches no throw'+(r.err?' ['+r.err+']':''));
    has(r.html,'טען משחקים','admin matches: reload button (טען משחקים)');
    has(r.html,'מלא תוצאות','admin matches: fill-results button (מלא תוצאות)');
    has(r.html,'החזר קופה','admin matches: void/refund button on card');
  r=render({MODE:'admin',ME:null,TAB:'settings'}); ok(!r.err,'render admin settings no throw'+(r.err?' ['+r.err+']':''));

  console.log('\n===== B3. ASYNC FB-CHAINS (real fb writes on mock tree) =====');
  // settle A then verify + auto-bets
  let A=loadApp(seedBasic(),{}); A.sandbox.buildState(A.state.tree); A.sandbox.MODE='admin';
  A.sandbox.aSettle('m1','A'); await flush();
  ok(A.state.tree.matches.m1.settled===true&&A.state.tree.matches.m1.winner==='A','settle A: settled+winner persisted');
  ok(!!(A.state.tree.bets.m1.p2&&A.state.tree.bets.m1.p2.auto),'settle A: auto-bet created for non-bettor p2');
  // unsettle (toggle)
  A.sandbox.aSettle('m1','A'); await flush();
  ok(A.state.tree.matches.m1.settled===false,'unsettle: settled=false');
  ok(!(A.state.tree.bets.m1&&A.state.tree.bets.m1.p2&&A.state.tree.bets.m1.p2.auto),'unsettle: auto-bet removed');

  // settle X (draw) -> no auto-bets, balances net 0  (ISOLATED single-match seed)
  const drawSeed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},
    players:{p0:{name:'Alice',t:1},p1:{name:'Bob',t:2},p2:{name:'Carol',t:3}},
    matches:{m1:{round:'R32',order:0,t:1,teamA:'X',teamB:'Y',dt:'',settled:false,winner:null}},
    bets:{m1:{p0:{team:'A',stake:3},p1:{team:'B',stake:5}}}};
  let D=loadApp(drawSeed,{}); D.sandbox.buildState(D.state.tree); D.sandbox.MODE='admin';
  D.sandbox.aSettle('m1','X'); await flush();
  ok(D.state.tree.matches.m1.winner==='X','draw: winner=X persisted');
  const m1bets=D.state.tree.bets.m1; const autoCount=Object.keys(m1bets).filter(k=>m1bets[k].auto).length;
  ok(autoCount===0,'draw: no auto-bets created');
  D.sandbox.buildState(D.state.tree);
  ok(Math.abs(D.sandbox.statsFor('p0').balance-100)<1e-9&&Math.abs(D.sandbox.statsFor('p1').balance-100)<1e-9,'draw: bettor balances back to bank (net 0, isolated)');
  ok(D.sandbox.statsFor('p2').balance===100,'draw: non-bettor unaffected');

  // delete player (admin) removes player + bets
  let P=loadApp(seedBasic(),{}); P.sandbox.buildState(P.state.tree); P.sandbox.MODE='admin';
  P.sandbox.aDelPlayer('p0'); await flush();
  ok(!!P.state.tree.players.p0&&P.state.tree.players.p0.exited===true,'delPlayer: player archived (kept, exited)');
  ok(!(P.state.tree.bets.m1&&P.state.tree.bets.m1.p0),'delPlayer: UNSETTLED bet removed');
  ok(!!(P.state.tree.bets.m3&&P.state.tree.bets.m3.p0),'delPlayer: SETTLED bet KEPT (immutable history)');

  // close account (player)
  let C=loadApp(seedBasic(),{}); C.sandbox.buildState(C.state.tree); C.sandbox.ME='p1';
  C.sandbox.closeMyAccount(); await flush();
  ok(!!C.state.tree.players.p1&&C.state.tree.players.p1.exited===true,'closeAccount: player archived (kept, exited)');
  ok(!(C.state.tree.bets.m1&&C.state.tree.bets.m1.p1),'closeAccount: UNSETTLED bet removed');
  ok(!!(C.state.tree.bets.m3&&C.state.tree.bets.m3.p1),'closeAccount: SETTLED bet KEPT (immutable history)');
  ok(C.sandbox.ME===null,'closeAccount: ME cleared');

  // fill results (ESPN) -> settle finished match
  const espnSeed=seedBasic();
  espnSeed.matches.m5={round:'R32',order:4,t:5,teamA:'Czechia',teamB:'South Africa',dt:dtLocal(-3*60*60e3),settled:false,winner:null,fx:'espn555',fxLeague:'fifa.world'};
  espnSeed.bets.m5={p0:{team:'A',stake:3},p1:{team:'B',stake:2}};
  const espnResp={events:[{id:'555',date:new Date(now-3*36e5).toISOString(),status:{type:{state:'post',completed:true}},
    competitions:[{competitors:[{homeAway:'home',winner:true,score:'2',team:{displayName:'Czechia'}},{homeAway:'away',winner:false,score:'1',team:{displayName:'South Africa'}}]}]}]};
  let F=loadApp(espnSeed,{espn:espnResp}); F.sandbox.buildState(F.state.tree); F.sandbox.MODE='admin';
  F.sandbox.aFillResults(); await flush(60);
  ok(F.state.tree.matches.m5.settled===true&&F.state.tree.matches.m5.winner==='A','fillResults: finished match settled as A (home winner)');
  ok(F.state.tree.matches.m1.settled!==true,'fillResults: future/no-result match left unsettled');

  console.log('\n===== B4. LOCK GUARD blocks write after start =====');
  let L=loadApp(seedBasic(),{}); L.sandbox.buildState(L.state.tree); L.sandbox.ME='p2'; L.sandbox.TAB='bet';
  // m2 is locked (start 1h ago); p2 has no bet on m2 -> pPick should refuse
  const before=JSON.stringify(L.state.tree.bets.m2||{});
  L.sandbox.pPick('m2','A'); await flush();
  const after=JSON.stringify(L.state.tree.bets.m2||{});
  ok(before===after,'lock: pPick on started match did NOT create/modify a bet');
  // open match m1 -> pPick should work for p2
  L.sandbox.pPick('m1','A'); await flush();
  ok(!!(L.state.tree.bets.m1&&L.state.tree.bets.m1.p2),'lock: pPick on open match DID create bet');

  console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));
  process.exit(fails?1:0);
})();
