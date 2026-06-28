import { loadApp, flush } from './applib.js';
import assert from 'assert';

// ---- shared firebase-tree mock fetch (same REST semantics) ----
function clone(o){return JSON.parse(JSON.stringify(o||{}));}
function makeServerFetch(state){
  const DB='https://mockdb';
  function segs(u){u=u.replace(/^https?:\/\/[^/]+/,'').replace(/\?.*$/,'').replace(/\.json$/,'');return u.split('/').filter(Boolean);}
  const get=s=>{let n=state.tree;for(const k of s){if(n==null)return null;n=n[k];}return n==null?null:n;};
  const set=(s,v)=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)n[s[i]]={};n=n[s[i]];}n[s[s.length-1]]=v;};
  const patch=(s,v)=>{let n=state.tree;for(const k of s){if(n[k]==null)n[k]={};n=n[k];}Object.assign(n,v);};
  const del=s=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)return;n=n[s[i]];}delete n[s[s.length-1]];};
  return async function(url,opts){opts=opts||{};const m=(opts.method||'GET').toUpperCase();
    if(/site\.api\.espn\.com/.test(url))return {ok:true,status:200,json:async()=>state.espn||{events:[]}};
    const s=segs(url);let body=null;try{body=opts.body?JSON.parse(opts.body):null;}catch(e){}
    let v=null;
    if(m==='GET')v=s.length?get(s):state.tree;
    else if(m==='PUT'){if(s.length)set(s,body);else state.tree=body;v=body;}
    else if(m==='PATCH'){if(s.length)patch(s,body);else Object.assign(state.tree,body);v=body;}
    else if(m==='DELETE'){if(s.length)del(s);v=null;}
    return {ok:true,status:200,json:async()=>v==null?null:clone(v)};
  };
}

const now=Date.now();
function evt(id,hw,aw,hs,as){return {id,date:new Date(now-3*36e5).toISOString(),status:{type:{state:'post',completed:true}},competitions:[{competitors:[
  {homeAway:'home',winner:hw,score:hs,team:{displayName:'H'+id}},{homeAway:'away',winner:aw,score:as,team:{displayName:'A'+id}}]}]};}

function makeSeed(){return {meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪',lastIdleCheck:now,lastCashPurge:now},
  players:{p0:{name:'P0',feePaid:true,t:1},p1:{name:'P1',feePaid:true,t:2},p2:{name:'P2',feePaid:true,t:3},p3:{name:'P3',feePaid:true,t:4}},
  matches:{
    m1:{round:'R32',order:0,t:1,teamA:'H1',teamB:'A1',dt:new Date(now-3*36e5).toISOString().slice(0,16),settled:false,winner:null,fx:'espn1',fxLeague:'fifa.world'},
    m2:{round:'R32',order:1,t:2,teamA:'H2',teamB:'A2',dt:new Date(now-3*36e5).toISOString().slice(0,16),settled:false,winner:null,fx:'espn2',fxLeague:'fifa.world'},
    m3:{round:'R32',order:2,t:3,teamA:'H3',teamB:'A3',dt:new Date(now-3*36e5).toISOString().slice(0,16),settled:false,winner:null,fx:'espn3',fxLeague:'fifa.world'},
    m4:{round:'R32',order:3,t:4,teamA:'Man',teamB:'Ual',dt:'',settled:false,winner:null}, // manual, no fx -> ignored by both
    m5:{round:'R32',order:4,t:5,teamA:'H5',teamB:'A5',dt:new Date(now+5*36e5).toISOString().slice(0,16),settled:false,winner:null,fx:'espn5',fxLeague:'fifa.world'}, // not finished in ESPN
    m6:{round:'GRP',order:5,t:6,teamA:'H6',teamB:'A6',dt:new Date(now-3*36e5).toISOString().slice(0,16),settled:false,winner:null,fx:'espn6',fxLeague:'eng.1',drawOK:true} // draw-enabled -> X
  },
  bets:{
    m1:{p0:{team:'A',stake:3},p1:{team:'B',stake:5}},      // home win -> A
    m2:{p2:{team:'A',stake:2}},                              // away win -> B (p2 on A loses)
    m3:{p0:{team:'A',stake:4},p1:{team:'B',stake:4}},        // knockout 1-1 level -> SKIP (gate)
    m6:{p0:{team:'X',stake:4},p1:{team:'A',stake:3},p2:{team:'B',stake:2}}  // draw-enabled, draws -> p0(X) wins
  }};}

const espn={events:[
  evt('1',true,false,'2','0'),  // m1 home win -> A
  evt('2',false,true,'0','1'),  // m2 away win -> B
  evt('3',false,false,'1','1'),  // m3 knockout 1-1 -> level -> SKIP (gate)
  evt('6',false,false,'1','1')   // m6 draw-enabled 1-1 -> X (draw wins)
  // espn5 absent -> m5 stays unsettled
]};

function normalize(tree){
  // keep only matches(settled,winner) + bets for comparison
  const out={matches:{},bets:{}};
  for(const id in (tree.matches||{})){const m=tree.matches[id];out.matches[id]={settled:!!m.settled,winner:m.winner||null};}
  for(const mid in (tree.bets||{})){out.bets[mid]={};for(const pid in tree.bets[mid]){const b=tree.bets[mid][pid];out.bets[mid][pid]={team:b.team,stake:b.stake,auto:!!b.auto};}}
  return out;
}

(async()=>{
  // ---- SERVER ----
  process.env.FIREBASE_DB_URL='https://mockdb';
  const serverState={tree:clone(makeSeed()),espn};
  globalThis.fetch=makeServerFetch(serverState);
  const mod=await import('../netlify/functions/check-results.mjs');
  const res=await mod.runCheck();
  console.log('server runCheck result:',JSON.stringify(res));

  // ---- CLIENT ----
  const app=loadApp(makeSeed(),{espn});
  app.sandbox.buildState(app.state.tree); app.sandbox.MODE='admin';
  app.sandbox.aFillResults(false); await flush(120);

  // ---- COMPARE ----
  const S=normalize(serverState.tree), C=normalize(app.state.tree);
  let fails=0;
  function eq(a,b,label){const ja=JSON.stringify(a),jb=JSON.stringify(b);if(ja!==jb){fails++;console.log('MISMATCH '+label+'\n  server:',ja,'\n  client:',jb);}else console.log('ok   '+label);}
  eq(S.matches,C.matches,'matches (settled/winner) identical server==client');
  eq(S.bets,C.bets,'bets (incl auto-bets) identical server==client');
  // explicit expectations
  eq(S.matches.m1,{settled:true,winner:'A'},'m1 -> A');
  eq(S.matches.m2,{settled:true,winner:'B'},'m2 -> B');
  eq(S.matches.m3,{settled:false,winner:null},'m3 knockout 1-1 -> SKIPPED by gate (stays pending, not refunded)');
  eq(S.matches.m6,{settled:true,winner:'X'},'m6 draw-enabled 1-1 -> X (draw wins, pays X-bettor)');
  eq(S.matches.m4,{settled:false,winner:null},'m4 (manual) untouched');
  eq(S.matches.m5,{settled:false,winner:null},'m5 (not finished) untouched');
  // m3 draw -> no auto bets
  const m3autos=Object.keys(S.bets.m3||{}).filter(k=>S.bets.m3[k].auto).length;
  console.log(m3autos===0?'ok   m3 skipped (gate): no auto-bets added':'FAIL m3 has auto-bets'); if(m3autos)fails++;
  const m6autos=Object.keys(S.bets.m6||{}).filter(k=>S.bets.m6[k].auto).length;
  console.log(m6autos===0?'ok   m6 draw X: no auto-bets (draw skips auto-fill)':'FAIL m6 draw has auto-bets'); if(m6autos)fails++;
  // m1/m2 should have auto-bets for non-bettors
  const m1autos=Object.keys(S.bets.m1||{}).filter(k=>S.bets.m1[k].auto).length;
  console.log(m1autos>0?'ok   m1: auto-bets added for non-bettors ('+m1autos+')':'FAIL m1 no auto-bets'); if(!m1autos)fails++;
  const m1autoA=Object.keys(S.bets.m1||{}).filter(k=>S.bets.m1[k].auto).every(k=>S.bets.m1[k].team==='A');
  console.log(m1autoA?'ok   m1 auto-bets all on home A [task1]':'FAIL m1 auto-bets not all team A'); if(!m1autoA)fails++;

  // ---- no-pending case ----
  const empty={tree:{meta:{bank:100},players:{},matches:{},bets:{}},espn:{events:[]}};
  globalThis.fetch=makeServerFetch(empty);
  const r2=await mod.runCheck();
  console.log((r2.updated===0||r2.skipped===true)?'ok   no-pending -> updated:0/skipped':'FAIL no-pending'); if(!(r2.updated===0||r2.skipped===true))fails++;

  console.log('\n'+(fails?('FAILED '+fails):'ALL PARITY CHECKS PASS — server == client'));
  process.exit(fails?1:0);
})();
