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
const DAY=24*60*60*1000;

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const now=Date.now();

function setup(td){
  const tree=clone(td);
  if(!tree.meta)tree.meta={};
  if(tree.meta.bank==null)tree.meta.bank=100;
  if(tree.meta.lastIdleCheck==null)tree.meta.lastIdleCheck=0;
  if(!tree.notices)tree.notices={};
  const state={tree,espn:{events:[]}};
  globalThis.fetch=makeFetch(state);
  const players=Object.keys(tree.players||{}).map(id=>({id,...tree.players[id]}));
  const matches=Object.keys(tree.matches||{}).map(id=>({id,...tree.matches[id],settled:!!tree.matches[id].settled,winner:tree.matches[id].winner||null}));
  const bets={};for(const mid in (tree.bets||{}))bets[mid]={...tree.bets[mid]};
  return {tree,players,matches,bets,bank:Number(tree.meta.bank)||100};
}
const sweep=s=>mod.idleSweep(s.tree,s.players,s.matches,s.bets,s.bank,now);

// 1. removal at 7+ days (old lastBet, paid, no bets)
let s=setup({players:{p1:{name:'A',feePaid:true,dep:100,lastBet:now-8*DAY,t:now-20*DAY}}});
await sweep(s);
ok(s.tree.players.p1.exited===true,'1: removed at 8d idle');
ok(s.tree.players.p1.exitReason==='idle7','1: exitReason=idle7');
ok(s.tree.players.p1.exitBal===100,'1: exitBal=100 (full deposit)');
ok(s.tree.notices.idle_removed_p1&&s.tree.notices.idle_removed_p1.type==='idle_removed','1: idle_removed notice created');
ok(s.tree.notices.idle_removed_p1.amount===100,'1: notice amount=100');
ok(s.tree.notices.idle_removed_p1.seen===false,'1: notice unseen');

// 2. warning at 6 days (not removed)
s=setup({players:{p1:{name:'B',feePaid:true,dep:100,lastBet:now-6.5*DAY}}});
await sweep(s);
ok(!s.tree.players.p1.exited,'2: NOT removed at 6.5d');
ok(s.tree.players.p1.idleWarned===true,'2: idleWarned flag set');
ok(s.tree.notices.idle_warn_p1&&s.tree.notices.idle_warn_p1.type==='idle_warn','2: idle_warn notice created');

// 3. open MANUAL bet protects
s=setup({players:{p1:{name:'C',feePaid:true,dep:100,lastBet:now-8*DAY}},matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{p1:{team:'A',stake:5}}}});
await sweep(s);
ok(!s.tree.players.p1.exited,'3: open manual bet protects from removal');
ok(!s.tree.notices.idle_warn_p1&&!s.tree.notices.idle_removed_p1,'3: no notices when protected');

// 4. AUTO bet does NOT protect -> removed, stake refunded
s=setup({players:{p1:{name:'D',feePaid:true,dep:100,lastBet:now-8*DAY}},matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{p1:{team:'A',stake:1,auto:true}}}});
await sweep(s);
ok(s.tree.players.p1.exited===true,'4: auto-bet does NOT protect -> removed');
ok(s.tree.players.p1.exitBal===100,'4: exitBal=100 (auto stake refunded)');
ok(!(s.tree.bets.m1&&s.tree.bets.m1.p1),'4: open auto bet cancelled on removal');

// 5. unpaid skipped
s=setup({players:{p1:{name:'E',feePaid:false,t:now-20*DAY}}});
await sweep(s);
ok(!s.tree.players.p1.exited,'5: unpaid participant NOT removed');

// 6. paid but never bet -> removed via t (variant a)
s=setup({players:{p1:{name:'F',feePaid:true,dep:100,t:now-8*DAY}}});
await sweep(s);
ok(s.tree.players.p1.exited===true,'6: paid-never-bet removed via registration t');
ok(s.tree.players.p1.exitBal===100,'6: exitBal=100');

// 7. exitBal with settled match (parimutuel win)
s=setup({players:{p1:{name:'G',feePaid:true,dep:100,lastBet:now-8*DAY},p2:{name:'GG',feePaid:true,dep:100,lastBet:now}},matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'A'}},bets:{m1:{p1:{team:'A',stake:10},p2:{team:'B',stake:10}}}});
await sweep(s);
ok(s.tree.players.p1.exited===true,'7: G removed');
ok(s.tree.players.p1.exitBal===110,'7: exitBal=110 (100-10 staked +20 won)');
ok(!s.tree.players.p2.exited,'7: active p2 (recent bet) not removed');

// 8. idleWarned dedup: second sweep does not re-create (seen preserved)
s=setup({players:{p1:{name:'H',feePaid:true,dep:100,lastBet:now-6.5*DAY}}});
await sweep(s);
s.tree.notices.idle_warn_p1.seen=true;          // user dismissed
s.tree.meta.lastIdleCheck=0;                     // allow another run
let s8=setup(s.tree);                            // re-derive players (idleWarned now true)
await sweep(s8);
ok(s8.tree.notices.idle_warn_p1.seen===true,'8: dedup — warn NOT re-created (seen preserved)');

// 9. re-activity reset: warned then active -> flag cleared + warn notice deleted
s=setup({players:{p1:{name:'I',feePaid:true,dep:100,lastBet:now-1*DAY,idleWarned:true}},notices:{idle_warn_p1:{type:'idle_warn',name:'I',amount:50,ts:now-2*DAY,seen:false}}});
await sweep(s);
ok(s.tree.players.p1.idleWarned===false,'9: idleWarned cleared on re-activity');
ok(!s.tree.notices.idle_warn_p1,'9: stale warn notice deleted on re-activity');

// 10. throttle: recent lastIdleCheck -> no action
s=setup({players:{p1:{name:'J',feePaid:true,dep:100,lastBet:now-8*DAY}}});
s.tree.meta.lastIdleCheck=now-1000;
let s10=setup(s.tree);
const acted=await sweep(s10);
ok(!s10.tree.players.p1.exited,'10: throttled — no removal within 24h');
ok(acted===0,'10: idleSweep returns 0 when throttled');

// 11. crit notice dedup
let st={tree:{notices:{}},espn:{events:[]}};
globalThis.fetch=makeFetch(st);
await mod.critNotice('runCheck crashed: fetch failed');
let k1=Object.keys(st.tree.notices).filter(k=>k.indexOf('crit_')===0);
ok(k1.length===1,'11: crit notice created');
ok(st.tree.notices[k1[0]].type==='crit','11: type=crit');
st.tree.notices[k1[0]].seen=true;
await mod.critNotice('runCheck crashed: fetch failed');   // same -> dedup
ok(st.tree.notices[k1[0]].seen===true,'11: same crit deduped (seen preserved)');
await mod.critNotice('TypeError: boom is not defined');   // different -> new
let k2=Object.keys(st.tree.notices).filter(k=>k.indexOf('crit_')===0);
ok(k2.length===2,'11: distinct crit error -> new notice');

console.log((fails?'FAILED ':'ALL PASS ')+(tests-fails)+'/'+tests);
process.exit(fails?1:0);
})();
