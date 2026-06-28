import assert from 'assert';
function clone(o){return JSON.parse(JSON.stringify(o||{}));}
function makeFetch(state,failGetRoot){
  function segs(u){u=u.replace(/^https?:\/\/[^/]+/,'').replace(/\?.*$/,'').replace(/\.json$/,'');return u.split('/').filter(Boolean);}
  const get=s=>{let n=state.tree;for(const k of s){if(n==null)return null;n=n[k];}return n==null?null:n;};
  const set=(s,v)=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)n[s[i]]={};n=n[s[i]];}n[s[s.length-1]]=v;};
  const patch=(s,v)=>{let n=state.tree;for(const k of s){if(n[k]==null)n[k]={};n=n[k];}Object.assign(n,v);};
  return async function(url,opts){opts=opts||{};const m=(opts.method||'GET').toUpperCase();
    if(/site\.api\.espn\.com/.test(url))return {ok:true,json:async()=>state.espn||{events:[]}};
    const s=segs(url);
    if(m==='GET'&&s.length===0&&failGetRoot)throw new TypeError('tree GET down');
    let body=null;try{body=opts.body?JSON.parse(opts.body):null;}catch(e){}
    let v=null;
    if(m==='GET')v=s.length?get(s):state.tree;
    else if(m==='PUT'){if(s.length)set(s,body);else state.tree=body;v=body;}
    else if(m==='PATCH'){if(s.length)patch(s,body);else Object.assign(state.tree,body);v=body;}
    return {ok:true,json:async()=>v==null?null:clone(v)};
  };
}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
console.log('===== server crash -> /diag/server =====');
// make it due (no autocfg -> fallback, srvLast 0) but full-tree GET fails -> runCheck throws -> handler slogs
const st={tree:{meta:{bank:100}},espn:{events:[]}};
globalThis.fetch=makeFetch(st,true);
const res=await mod.default();
ok(res.status===500,'handler returns 500 on crash');
ok(st.tree.diag&&st.tree.diag.server&&Array.isArray(st.tree.diag.server.items),'/diag/server written');
const items=(st.tree.diag.server.items)||[];
ok(items.some(it=>it.lvl==='CRIT'&&/crashed/.test(it.msg)),'CRIT crash entry logged for admin to see');
console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
