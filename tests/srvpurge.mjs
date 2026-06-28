import assert from 'assert';
function clone(o){return JSON.parse(JSON.stringify(o||{}));}
function makeFetch(state){
  function segs(u){u=u.replace(/^https?:\/\/[^/]+/,'').replace(/\?.*$/,'').replace(/\.json$/,'');return u.split('/').filter(Boolean);}
  const get=s=>{let n=state.tree;for(const k of s){if(n==null)return null;n=n[k];}return n==null?null:n;};
  const set=(s,v)=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)n[s[i]]={};n=n[s[i]];}n[s[s.length-1]]=v;};
  const patch=(s,v)=>{let n=state.tree;for(const k of s){if(n[k]==null)n[k]={};n=n[k];}Object.assign(n,v);};
  return async function(url,opts){opts=opts||{};const m=(opts.method||'GET').toUpperCase();
    if(/site\.api\.espn\.com/.test(url))return {ok:true,json:async()=>state.espn||{events:[]}};
    const s=segs(url);
    let body=null;try{body=opts.body?JSON.parse(opts.body):null;}catch(e){}
    let v=null;
    if(m==='GET')v=s.length?get(s):state.tree;
    else if(m==='PUT'){if(s.length)set(s,body);else state.tree=body;v=body;}
    else if(m==='PATCH'){if(s.length)patch(s,body);else Object.assign(state.tree,body);v=body;}
    return {ok:true,json:async()=>v==null?null:clone(v)};
  };
}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const DAY=24*60*60*1000;
(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const now=Date.now();

console.log('===== purge: delete >365d, keep recent =====');
const st={tree:{
  meta:{bank:100},
  autocfg:{},                       // no due matches -> runCheck reaches purge then returns skipped
  cashlog:{
    p1:{
      opening:{ts:now-400*DAY,type:'open',amount:100,bal:100},  // OLD -> delete
      recent:{ts:now-10*DAY,type:'in',amount:50,bal:150}        // recent -> keep
    },
    p2:{ only:{ts:now-500*DAY,type:'in',amount:20,bal:20} }      // OLD -> delete
  }
},espn:{events:[]}};
globalThis.fetch=makeFetch(st);
await mod.runCheck();
ok(st.tree.cashlog.p1.opening===null,'old opening purged (p1)');
ok(st.tree.cashlog.p1.recent&&st.tree.cashlog.p1.recent.amount===50,'recent kept (p1)');
ok(st.tree.cashlog.p2.only===null,'old entry purged (p2)');
ok(typeof st.tree.meta.lastCashPurge==='number','lastCashPurge marker set');

console.log('===== throttle: recent purge -> skip =====');
const st2={tree:{
  meta:{bank:100,lastCashPurge:now-1000},      // purged 1s ago -> within 24h -> skip
  autocfg:{},
  cashlog:{p1:{old:{ts:now-400*DAY,type:'in',amount:5,bal:5}}}
},espn:{events:[]}};
globalThis.fetch=makeFetch(st2);
await mod.runCheck();
ok(st2.tree.cashlog.p1.old&&st2.tree.cashlog.p1.old.amount===5,'throttle: old entry NOT removed within 24h');

console.log('===== boundary: just under 365d kept =====');
const st3={tree:{
  meta:{bank:100},autocfg:{},
  cashlog:{p1:{
    almost:{ts:now-364*DAY,type:'in',amount:7,bal:7},   // <365d -> keep
    over:{ts:now-366*DAY,type:'in',amount:9,bal:9}       // >365d -> delete
  }}
},espn:{events:[]}};
globalThis.fetch=makeFetch(st3);
await mod.runCheck();
ok(st3.tree.cashlog.p1.almost&&st3.tree.cashlog.p1.almost.amount===7,'364d kept');
ok(st3.tree.cashlog.p1.over===null,'366d purged');

console.log('===== no cashlog -> complete no-op (no marker write) =====');
const st4={tree:{meta:{bank:100},autocfg:{}},espn:{events:[]}};
globalThis.fetch=makeFetch(st4);
await mod.runCheck();
ok(st4.tree.meta.lastCashPurge===undefined,'no cashlog -> no lastCashPurge marker (quiet)');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
