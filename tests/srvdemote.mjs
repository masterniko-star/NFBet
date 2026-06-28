import assert from 'assert';
function clone(o){return JSON.parse(JSON.stringify(o||{}));}
function makeFetch(state){
  function segs(u){u=u.replace(/^https?:\/\/[^/]+/,'').replace(/\?.*$/,'').replace(/\.json$/,'');return u.split('/').filter(Boolean);}
  const get=s=>{let n=state.tree;for(const k of s){if(n==null)return null;n=n[k];}return n==null?null:n;};
  const set=(s,v)=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)n[s[i]]={};n=n[s[i]];}n[s[s.length-1]]=v;};
  const patch=(s,v)=>{let n=state.tree;for(const k of s){if(n[k]==null)n[k]={};n=n[k];}Object.assign(n,v);};
  const del=s=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)return;n=n[s[i]];}delete n[s[s.length-1]];};
  return async function(url,opts){opts=opts||{};const m=(opts.method||'GET').toUpperCase();
    if(/site\.api\.espn\.com/.test(url))return {ok:true,json:async()=>state.espn||{events:[]}};
    const s=segs(url);
    let body=null;try{body=opts.body?JSON.parse(opts.body):null;}catch(e){}
    let v=null;
    if(m==='GET')v=s.length?get(s):state.tree;
    else if(m==='PUT'){if(s.length)set(s,body);else state.tree=body;v=body;}
    else if(m==='PATCH'){if(s.length)patch(s,body);else Object.assign(state.tree,body);v=body;}
    else if(m==='DELETE'){if(s.length)del(s);v=null;}
    return {ok:true,json:async()=>v==null?null:clone(v)};
  };
}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const now=Date.now();

function setup(td){
  const tree=clone(td);
  if(!tree.meta)tree.meta={};
  if(tree.meta.bank==null)tree.meta.bank=100;
  if(!tree.notices)tree.notices={};
  const state={tree,espn:{events:[]}};
  globalThis.fetch=makeFetch(state);
  const players=Object.keys(tree.players||{}).map(id=>({id,...tree.players[id]}));
  const matches=Object.keys(tree.matches||{}).map(id=>({id,...tree.matches[id],settled:!!tree.matches[id].settled,winner:tree.matches[id].winner||null}));
  const bets={};for(const mid in (tree.bets||{}))bets[mid]={...tree.bets[mid]};
  return {tree,players,matches,bets,bank:Number(tree.meta.bank)||100};
}
const sweep=s=>mod.lowBalanceSweep(s.players,s.matches,s.bets,s.bank,now);

// 1. broke via settled loss -> demoted; winner untouched
let s=setup({players:{p1:{name:'Broke',feePaid:true,dep:100},p2:{name:'Winner',feePaid:true,dep:100}},matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'B'}},bets:{m1:{p1:{team:'A',stake:100},p2:{team:'B',stake:100}}}});
let acted=await sweep(s);
ok(s.tree.players.p1.feePaid===false,'1: broke player demoted (feePaid=false)');
ok(s.tree.players.p1.demoteAt>0,'1: demoteAt set');
ok(s.tree.players.p1.demoteNotify===true,'1: demoteNotify=true (player popup pending)');
ok(s.tree.players.p2.feePaid===true,'1: winner NOT demoted');
ok(acted===1,'1: acted=1');

// 2. demote notice (owner) created with seen:false, name, amount=0
ok(s.tree.notices.demote_p1&&s.tree.notices.demote_p1.type==='demote','2: demote notice created');
ok(s.tree.notices.demote_p1.name==='Broke','2: notice name=Broke');
ok(s.tree.notices.demote_p1.seen===false,'2: notice unseen');
ok(s.tree.notices.demote_p1.amount===0,'2: notice amount=0 (no balance)');

// 3. balance becomes exactly 0 after demotion (dep=depA), pending=0
let s3=setup(s.tree);
const bb=mod.srvBalance(s3.players.find(p=>p.id==='p1'),s3.matches,s3.bets,s3.bank);
ok(Math.abs(bb.balance)<1e-9,'3: balance=0 after demote (dep=depA)');
ok(bb.pending===0,'3: pending=0');

// 4. ва-банк (free 1 + open 99 = 100) NOT demoted — pending protects
s=setup({players:{p3:{name:'AllIn',feePaid:true,dep:100}},matches:{m2:{teamA:'X',teamB:'Y',settled:false}},bets:{m2:{p3:{team:'A',stake:99}}}});
acted=await sweep(s);
ok(s.tree.players.p3.feePaid===true,'4: ва-банк NOT demoted');
ok(!s.tree.notices.demote_p3,'4: no demote notice for ва-банк');
ok(acted===0,'4: acted=0');

// 5. full-balance paid player (no bets) NOT demoted
s=setup({players:{p5:{name:'Fresh',feePaid:true,dep:100}}});
await sweep(s);
ok(s.tree.players.p5.feePaid===true,'5: full-balance player NOT demoted');

// 6. boundary: total exactly 1 -> NOT demoted (can still bet 1)
s=setup({players:{p6:{name:'One',feePaid:true,dep:1}}});
await sweep(s);
ok(s.tree.players.p6.feePaid===true,'6: total=1 (boundary) NOT demoted');

// 7. exited player skipped even with 0 balance
s=setup({players:{p7:{name:'Gone',feePaid:true,dep:0,exited:true}}});
await sweep(s);
ok(!s.tree.notices.demote_p7,'7: exited player skipped (no demote)');

// 8. already-unpaid (feePaid:false) skipped
s=setup({players:{p8:{name:'AlreadyDemo',feePaid:false,dep:0}}});
await sweep(s);
ok(!s.tree.notices.demote_p8,'8: already-unpaid skipped (no notice)');
ok(!s.tree.players.p8.demoteAt,'8: no demoteAt on already-unpaid');

// 9. open bet on broke player cancelled (contrived sub-shekel edge to exercise cancel path)
s=setup({players:{p9:{name:'Edge',feePaid:true,dep:0.5}},matches:{m9:{teamA:'X',teamB:'Y',settled:false}},bets:{m9:{p9:{team:'A',stake:0.4}}}});
acted=await sweep(s);
ok(s.tree.players.p9.feePaid===false,'9: broke-with-open-bet demoted');
ok(!(s.tree.bets.m9&&s.tree.bets.m9.p9),'9: open bet cancelled on demote');

// 10. dedup: second sweep is a no-op (already feePaid:false)
let s10=setup(s.tree);
const acted10=await sweep(s10);
ok(acted10===0,'10: second sweep no-op (already demoted)');

console.log((fails?'FAILED ':'ALL PASS ')+(tests-fails)+'/'+tests);
process.exit(fails?1:0);
})();
