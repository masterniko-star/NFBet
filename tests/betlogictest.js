// betlogictest.js — инварианты денег и ставок (вне фаззеров):
// availFor резервирует открытые ставки (нет перебора), clampStake границы,
// сохранение денег (Σdep == Σ(balance+pending)), отсутствие отрицательного баланса,
// явная паримутуэль-арифметика, возврат при отсутствии соперников, авто-ставка ₪1 без минуса.
const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};
const near=(a,b,e)=>Math.abs(a-b)<(e||1e-6);

(async()=>{

// ---------- 1. availFor резервирует открытые ставки на ДРУГИХ матчах ----------
{
  const seed={meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},
    players:{p1:{name:'A',feePaid:true,dep:100,t:1}},
    matches:{m1:{teamA:'A',teamB:'B',settled:false,t:1},m2:{teamA:'C',teamB:'D',settled:false,t:2},
             m3:{teamA:'E',teamB:'F',settled:false,t:3},m4:{teamA:'G',teamB:'H',settled:false,t:4}},
    bets:{m1:{p1:{team:'A',stake:10}},m2:{p1:{team:'A',stake:10}},m3:{p1:{team:'A',stake:10}}}};
  const A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);A.sandbox.ME='p1';
  const st=A.sandbox.statsFor('p1');
  ok(near(st.pending,30)&&near(st.balance,70),'1: pending=30, free balance=70');
  ok(near(A.sandbox.availFor('p1','m4'),70),'1: availFor(m4)=70 (reserves m1..m3)');
  ok(near(A.sandbox.availFor('p1','m1'),80),'1: availFor(m1)=80 (excludes own m1 stake)');
  ok(A.sandbox.clampStake('m4',10)===10,'1: clampStake m4 ->10 (within balance)');
}

// ---------- 2. clampStake границы ----------
{
  const A=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{p1:{name:'A',feePaid:true,dep:7,t:1}},matches:{m1:{teamA:'A',teamB:'B',settled:false}},bets:{}},{});
  A.sandbox.buildState(A.state.tree);A.sandbox.ME='p1';
  ok(A.sandbox.clampStake('m1',10)===7,'2: avail 7 -> clamp 10 to 7');
  ok(A.sandbox.clampStake('m1',1)===1,'2: min stake 1');
  ok(A.sandbox.clampStake('m1',0)===1,'2: 0 -> min 1');
}
{
  // нет свободных денег -> clampStake 0 (нельзя ставить)
  const A=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{p1:{name:'A',feePaid:true,dep:10,t:1}},
    matches:{m1:{teamA:'A',teamB:'B',settled:false},m2:{teamA:'C',teamB:'D',settled:false}},
    bets:{m1:{p1:{team:'A',stake:10}}}},{});
  A.sandbox.buildState(A.state.tree);A.sandbox.ME='p1';
  ok(A.sandbox.clampStake('m2',5)===0,'2: all money committed -> clampStake(m2)=0');
}

// ---------- 3. сохранение денег: Σdep == Σ(balance+pending), реальная победа/проигрыш ----------
{
  const seed={meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},
    players:{p1:{name:'A',feePaid:true,dep:100,t:1},p2:{name:'B',feePaid:true,dep:100,t:2}},
    matches:{m1:{teamA:'A',teamB:'B',settled:true,winner:'A',t:1},m2:{teamA:'C',teamB:'D',settled:false,t:2}},
    bets:{m1:{p1:{team:'A',stake:10},p2:{team:'B',stake:10}},m2:{p1:{team:'A',stake:5}}}};
  const A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);
  const s1=A.sandbox.statsFor('p1'),s2=A.sandbox.statsFor('p2');
  // m1: pool20, winner A, p1(A)=20, p2(B)=0
  ok(near(s1.won,20),'3: p1 won full pool 20 (sole A bettor)');
  ok(near(s2.won,0),'3: p2 (B) won 0');
  const dep=200,worth=(s1.balance+s1.pending)+(s2.balance+s2.pending);
  ok(near(worth,dep),'3: conservation Σdep(200) == Σ(balance+pending) ('+worth+')');
  ok(s1.balance>=-1e-9&&s2.balance>=-1e-9,'3: no negative balance');
}

// ---------- 4. явная паримутуэль-арифметика (3xA vs 2xB, winner A) ----------
{
  const seed={meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},
    players:{a1:{name:'a1',feePaid:true,dep:100},a2:{name:'a2',feePaid:true,dep:100},a3:{name:'a3',feePaid:true,dep:100},b1:{name:'b1',feePaid:true,dep:100},b2:{name:'b2',feePaid:true,dep:100}},
    matches:{m:{teamA:'A',teamB:'B',settled:true,winner:'A'}},
    bets:{m:{a1:{team:'A',stake:10},a2:{team:'A',stake:10},a3:{team:'A',stake:10},b1:{team:'B',stake:10},b2:{team:'B',stake:10}}}};
  const A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);
  const c=A.sandbox.calcMatch(A.sandbox.S.matches.find(m=>m.id==='m'));
  ok(near(c.pool,50)&&near(c.sumA,30)&&near(c.sumB,20),'4: pool50 sumA30 sumB20');
  ok(near(c.payouts.a1,50*10/30)&&near(c.payouts.b1,0),'4: A payout=16.67 each, B=0');
  let sum=0;Object.keys(c.payouts).forEach(k=>sum+=c.payouts[k]);
  ok(near(sum,50),'4: Σpayouts == pool (conserved)');
}

// ---------- 5. возврат при отсутствии соперников + VOID ----------
{
  const A=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},
    players:{p1:{name:'a',feePaid:true,dep:100},p2:{name:'b',feePaid:true,dep:100}},
    matches:{m:{teamA:'A',teamB:'B',settled:true,winner:'A'}},
    bets:{m:{p1:{team:'A',stake:10},p2:{team:'A',stake:7}}}},{});
  A.sandbox.buildState(A.state.tree);
  const c=A.sandbox.calcMatch(A.sandbox.S.matches.find(m=>m.id==='m'));
  // нет соперников: coef=1, выплата=ставке (деньги сохранены); это не VOID, поэтому refunded=false
  ok(near(c.coef,1)&&near(c.payouts.p1,10)&&near(c.payouts.p2,7),'5: only A bettors -> coef 1, payout=stake (money returned)');
}
{
  const A=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},
    players:{p1:{name:'a',feePaid:true,dep:100}},
    matches:{m:{teamA:'A',teamB:'B',settled:true,winner:'VOID'}},
    bets:{m:{p1:{team:'A',stake:10}}}},{});
  A.sandbox.buildState(A.state.tree);
  const c=A.sandbox.calcMatch(A.sandbox.S.matches.find(m=>m.id==='m'));
  ok(c.refunded===true&&near(c.payouts.p1,10),'5: VOID -> refund');
}

// ---------- 6. авто-ставка ₪1: только тем, у кого есть свободные деньги; без минуса ----------
{
  const seed={meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},
    players:{rich:{name:'rich',feePaid:true,dep:100,t:1},broke:{name:'broke',feePaid:true,dep:10,t:2},demo:{name:'demo',feePaid:false,dep:0,t:3}},
    matches:{m1:{teamA:'A',teamB:'B',settled:false,t:1},m2:{teamA:'C',teamB:'D',settled:false,t:2}},
    bets:{m1:{broke:{team:'A',stake:10}}}}; // broke вложил все 10 в m1
  const A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);
  await A.sandbox.autoBetFill('m2');await flush();
  A.sandbox.buildState(A.state.tree);
  const b=A.state.tree.bets.m2||{};
  ok(b.rich&&b.rich.auto&&b.rich.stake===1&&b.rich.team==='A','6: rich got auto ₪1 on A');
  ok(!b.broke,'6: broke (no free money) did NOT get auto-bet');
  ok(!b.demo,'6: demo (not paid) did NOT get auto-bet');
  // теперь m2 завершается B -> rich теряет 1, баланс не отрицательный
  A.state.tree.matches.m2.settled=true;A.state.tree.matches.m2.winner='B';
  A.sandbox.buildState(A.state.tree);
  ok(A.sandbox.statsFor('rich').balance>=-1e-9,'6: rich balance not negative after auto-bet loss');
}

// ---------- 7. сквозной путь pPick: нельзя поставить больше баланса ----------
{
  const A=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{p1:{name:'A',feePaid:true,dep:3,t:1}},matches:{m1:{teamA:'A',teamB:'B',settled:false}},bets:{}},{});
  A.sandbox.buildState(A.state.tree);A.sandbox.ME='p1';A.sandbox.stakeOf={m1:10}; // хочет 10, есть 3
  A.sandbox.pPick('m1','A');await flush();
  const bet=A.state.tree.bets&&A.state.tree.bets.m1&&A.state.tree.bets.m1.p1;
  ok(bet&&bet.stake===3,'7: pPick clamps stake to available balance (3, not 10)');
}

console.log((fail?'❌':'✅')+' betlogictest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
