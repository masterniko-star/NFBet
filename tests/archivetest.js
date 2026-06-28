const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}

function seed(){return {
  meta:{bank:100,fee:100,cur:'\u20aa',minBet:1},
  players:{
    p1:{name:'Alice',feePaid:true,dep:100,t:1},
    p2:{name:'Bob',feePaid:true,dep:100,t:2},
    p3:{name:'Carl',feePaid:true,dep:100,t:3}
  },
  matches:{
    m1:{teamA:'TA',teamB:'TB',dt:'2026-06-20T20:00',settled:true,winner:'A',drawOK:false,t:1},
    m2:{teamA:'TC',teamB:'TD',dt:'2026-06-30T20:00',settled:false,drawOK:false,t:2}
  },
  bets:{
    m1:{p1:{team:'A',stake:5,t:1},p2:{team:'B',stake:5,t:1}},  // settled: p1 won, p2 lost
    m2:{p2:{team:'A',stake:5,t:1}}                              // open bet by p2 (to be cancelled)
  }
};}

(async()=>{
  // ===== aDelPlayer archives (admin) =====
  let A=loadApp(seed(),{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);
  let st=A.sandbox.statsFor('p2');
  ok(Math.round(st.balance)===90,'p2 balance before exit = 90 (100 - 10 staked) (got '+st.balance+')');
  ok(Math.round(st.pending)===5,'p2 pending (open stake) = 5');

  A.sandbox.aDelPlayer('p2');
  await flush();
  let t=A.state.tree;
  ok(t.players.p2 && t.players.p2.exited===true,'p2 record KEPT and marked exited (not deleted)');
  ok(t.players.p2.exitedAt>0,'exitedAt timestamp set');
  ok(Math.round(t.players.p2.exitBal)===95,'exitBal = walk-away 95 (open stake refunded) (got '+t.players.p2.exitBal+')');
  ok(t.players.p2.name==='Bob','name preserved');
  ok(t.players.p2.dep===100,'dep preserved');
  ok(t.bets.m1 && t.bets.m1.p2,'SETTLED bet (m1) kept');
  ok(!(t.bets.m2 && t.bets.m2.p2),'OPEN bet (m2) cancelled');

  A.sandbox.buildState(A.state.tree);
  ok(!A.sandbox.S.players.find(x=>x.id==='p2'),'p2 NOT in active S.players');
  ok(!!A.sandbox.S.exited.find(x=>x.id==='p2'),'p2 IS in S.exited');
  ok(A.sandbox.S.players.length===2,'2 active players remain');
  ok(A.sandbox.S.players.filter(x=>x.feePaid).length===2,'active paid count excludes exited');

  let rk=A.sandbox.ranking();
  ok(!rk.find(e=>e.p.id==='p2'),'exited excluded from standings (ranking)');
  ok(rk.length===2,'standings has 2 active rows');

  let m1=A.sandbox.S.matches.find(x=>x.id==='m1');
  let c=A.sandbox.calcMatch(m1);
  ok(c.pool===10,'settled-match pot STILL counts exited player bet (pool=10) (got '+c.pool+')');

  // ===== closeMyAccount archives + logs out (participant) =====
  let B=loadApp(seed());
  B.sandbox.buildState(B.state.tree);
  B.sandbox.ME='p2';
  B.sandbox.closeMyAccount();
  await flush();
  let t2=B.state.tree;
  ok(t2.players.p2 && t2.players.p2.exited===true,'closeMyAccount: p2 marked exited (not deleted)');
  ok(Math.round(t2.players.p2.exitBal)===95,'closeMyAccount: exitBal 95');
  ok(B.sandbox.ME===null,'closeMyAccount: logged out (ME null)');
  ok(!(t2.bets.m2 && t2.bets.m2.p2),'closeMyAccount: open bet cancelled');
  ok(t2.bets.m1 && t2.bets.m1.p2,'closeMyAccount: settled bet kept');

  console.log((fail?'❌':'✅')+' archivetest: '+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
