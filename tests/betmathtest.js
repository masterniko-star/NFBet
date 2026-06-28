'use strict';
// NEW betting/payout math tests — parimutuel pool, balances, available, ranking, conservation.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const fails=[];
function ok(c,m){if(c){pass++;}else{fail++;fails.push(m);console.log('  ✗ '+m);}}
function near(a,b,m,eps){eps=eps||1e-6;ok(Math.abs(a-b)<eps,m+' (got '+a+' want '+b+')');}
function eq(a,b,m){ok(a===b,m+' (got '+JSON.stringify(a)+' want '+JSON.stringify(b)+')');}

// build one match with given bets {pid:{team,stake}} and optional settle
function one(settle,bets,meta){
  const m1=Object.assign({round:'R32',order:0,t:1,teamA:'H',teamB:'A',dt:'2026-06-20T18:00',settled:false,winner:null},settle||{});
  const A=loadApp({meta:Object.assign({bank:100,minBet:1,maxBet:10,cur:'\u20aa'},meta||{}),players:{},matches:{m1},bets:{m1:bets||{}}},{});
  A.sandbox.buildState(A.state.tree);
  return {A,m:A.sandbox.S.matches[0],calc(){return A.sandbox.calcMatch(this.m);}};
}
// multi-match state, bets = {mid:{pid:{team,stake}}}, matches = {mid:{settled,winner,...}}
function multi(matches,bets,players,meta){
  const ms={};let o=0;for(const mid in matches){ms[mid]=Object.assign({round:'R32',order:o++,t:o,teamA:'H',teamB:'A',dt:'2026-06-20T18:00',settled:false,winner:null},matches[mid]);}
  const A=loadApp({meta:Object.assign({bank:100,minBet:1,maxBet:10,cur:'\u20aa'},meta||{}),players:players||{},matches:ms,bets:bets||{}},{});
  A.sandbox.buildState(A.state.tree);
  return A;
}

// ---------- 1. unsettled: pool + coefficients ----------
{
  const t=one(null,{p1:{team:'A',stake:10},p2:{team:'B',stake:20},p3:{team:'X',stake:10}});
  const c=t.calc();
  eq(c.pool,40,'pool=40');
  eq(c.sumA,10,'sumA=10'); eq(c.sumB,20,'sumB=20'); eq(c.sumX,10,'sumX=10');
  near(c.coefA,4,'coefA=pool/sumA=4'); near(c.coefB,2,'coefB=2'); near(c.coefX,4,'coefX=4');
  eq(Object.keys(c.payouts).length,0,'no payouts before settle');
  eq(c.refunded,false,'not refunded before settle');
}

// ---------- 2. A wins: gross proportional payout ----------
{
  const t=one({settled:true,winner:'A'},{p1:{team:'A',stake:10},p2:{team:'B',stake:20},p3:{team:'X',stake:10}});
  const c=t.calc();
  near(c.coef,4,'coef=pool/sumA=4');
  near(c.payouts.p1,40,'winner A gross payout=40 (whole pool, sole A)');
  near(c.payouts.p2,0,'loser B payout=0');
  near(c.payouts.p3,0,'loser X payout=0');
  // conservation: sum payouts == pool
  near(c.payouts.p1+c.payouts.p2+c.payouts.p3,40,'sum payouts == pool (conserved)');
}

// ---------- 3. winner side empty -> full refund ----------
{
  const t=one({settled:true,winner:'B'},{p1:{team:'A',stake:10},p2:{team:'A',stake:10}});
  const c=t.calc();
  ok(c.refunded===true,'no bettor on winner B -> refunded');
  near(c.payouts.p1,10,'refund p1 stake'); near(c.payouts.p2,10,'refund p2 stake');
  eq(c.coef,1,'refund coef=1');
}

// ---------- 4. VOID -> refund all ----------
{
  const t=one({settled:true,winner:'VOID'},{p1:{team:'A',stake:7},p2:{team:'B',stake:3}});
  const c=t.calc();
  ok(c.refunded===true,'VOID -> refunded');
  near(c.payouts.p1,7,'VOID refund p1'); near(c.payouts.p2,3,'VOID refund p2');
}

// ---------- 5. X (draw) wins ----------
{
  const t=one({settled:true,winner:'X',drawOK:true},{p1:{team:'A',stake:10},p2:{team:'X',stake:5},p3:{team:'X',stake:5}});
  const c=t.calc();
  near(c.coef,20/10,'coef=pool/sumX=2');
  near(c.payouts.p2,10,'X winner p2 = 20*5/10=10'); near(c.payouts.p3,10,'X winner p3=10');
  near(c.payouts.p1,0,'A loser=0');
  near(c.payouts.p2+c.payouts.p3,20,'X payouts sum == pool');
}

// ---------- 6. EXACT lopsided board (Tunisia 1 vs Japan 29) ----------
{
  const bets={niko:{team:'A',stake:1},a:{team:'B',stake:10},b:{team:'B',stake:5},c:{team:'B',stake:4},d:{team:'B',stake:10}};
  // A wins (underdog): niko takes whole pool
  let c=one({settled:true,winner:'A'},bets).calc();
  eq(c.pool,30,'lopsided pool=30');
  near(c.payouts.niko,30,'A wins: niko gross=30 (net +29)');
  near(c.payouts.niko-1,29,'niko net profit = +29 against the crowd');
  ['a','b','c','d'].forEach(k=>near(c.payouts[k],0,'A wins: B bettor '+k+' = 0'));
  // B wins (favorite/crowd): split 30 across 29 staked -> tiny profit
  c=one({settled:true,winner:'B'},bets).calc();
  near(c.coef,30/29,'B wins coef=30/29');
  near(c.payouts.a,30*10/29,'B wins a gross=10.3448');
  near(c.payouts.a-10,30*10/29-10,'a net ~= +0.345 (with the crowd, tiny)');
  near(c.payouts.b-5,30*5/29-5,'b net ~= +0.172');
  near(c.payouts.c-4,30*4/29-4,'c net ~= +0.138');
  near(c.payouts.niko,0,'B wins: niko (A) = 0');
  near(c.payouts.a+c.payouts.b+c.payouts.c+c.payouts.d,30,'B payouts sum == pool');
}

// ---------- 7. parimutuel is zero-sum (closed pool, no rake) ----------
{
  const bets={p1:{team:'A',stake:10},p2:{team:'A',stake:30},p3:{team:'B',stake:20}};
  const c=one({settled:true,winner:'A'},bets).calc();
  let net=0;for(const k in bets)net+=(c.payouts[k]||0)-bets[k].stake;
  near(net,0,'sum of net P/L across all players == 0 (zero-sum pool)');
  near(c.payouts.p1,15,'p1 60*10/40=15 (net +5)');
  near(c.payouts.p2,45,'p2 60*30/40=45 (net +15)');
  near(c.payouts.p3,0,'p3 loser=0 (net -20)');
}

// ---------- 8. empty pool settled -> no crash, no payouts ----------
{
  const c=one({settled:true,winner:'A'},{}).calc();
  eq(c.pool,0,'empty pool=0');
  ok(c.refunded===true,'empty winner side -> refund branch');
  eq(Object.keys(c.payouts).length,0,'no payouts when no bets');
}

// ---------- 9. statsFor: balance = bank - staked + won across matches ----------
{
  // p1 bets across 3 matches: m1 A/10 (wins -> gross 10*pool... build), m2 B/5 (loses), m3 A/4 (pending)
  const A=multi(
    {m1:{settled:true,winner:'A'},m2:{settled:true,winner:'A'},m3:{settled:false,winner:null}},
    {m1:{p1:{team:'A',stake:10},p2:{team:'B',stake:10}},   // m1: A wins, pool20 sumA10 -> p1 gross 20
     m2:{p1:{team:'B',stake:5},p2:{team:'A',stake:5}},      // m2: A wins, p1 (B) loses -> 0
     m3:{p1:{team:'A',stake:4}}},                            // m3 pending: stake held
    {p1:{name:'P1'},p2:{name:'P2'}}
  );
  const s=A.sandbox.statsFor('p1');
  // staked = 10+5+4=19; won = 20 (m1) + 0 (m2) = 20; balance = 100 -19 +20 = 101
  eq(s.staked,19,'p1 staked=19');
  near(s.won,20,'p1 won=20 (m1 gross)');
  near(s.balance,101,'p1 balance=100-19+20=101');
  eq(s.correct,1,'p1 correct=1 (m1)'); eq(s.lost,1,'p1 lost=1 (m2)'); near(s.pending,4,'p1 pending=4 (m3)');
}

// ---------- 10. availFor excludes the current match ----------
{
  const A=multi(
    {m1:{settled:true,winner:'A'},m2:{settled:false,winner:null}},
    {m1:{p1:{team:'A',stake:10},p2:{team:'B',stake:10}},   // p1 wins m1 -> gross 20
     m2:{p1:{team:'A',stake:7}}},
    {p1:{name:'P1'},p2:{name:'P2'}}
  );
  // available for editing bet on m2: bank - staked(other=m1:10) + won(other m1:20) = 100-10+20=110
  near(A.sandbox.availFor('p1','m2'),110,'availFor m2 excludes m2 stake, counts m1');
  // available for a brand-new match m3: counts both m1+m2 -> 100 -(10+7) +20 = 103
  near(A.sandbox.availFor('p1','m3'),103,'availFor new match counts all existing');
}

// ---------- 11. ranking by balance desc ----------
{
  const A=multi(
    {m1:{settled:true,winner:'A'}},
    {m1:{p1:{team:'A',stake:10},p2:{team:'B',stake:10},p3:{team:'A',stake:5}}},
    {p1:{name:'Alpha'},p2:{name:'Beta'},p3:{name:'Gamma'}}
  );
  // m1 pool25 sumA15. p1 gross 25*10/15=16.67 bal=100-10+16.67=106.67; p3 gross 25*5/15=8.33 bal=100-5+8.33=103.33; p2 bal=100-10=90
  const r=A.sandbox.ranking();
  eq(r[0].p.name,'Alpha','rank1 Alpha (highest balance)');
  eq(r[1].p.name,'Gamma','rank2 Gamma');
  eq(r[2].p.name,'Beta','rank3 Beta');
  eq(r[0].rank,1,'rank index set'); eq(r[2].rank,3,'last rank=3');
}

// ---------- 12. coef null when side empty (unsettled) ----------
{
  const c=one(null,{p1:{team:'A',stake:10},p2:{team:'A',stake:5}}).calc();
  near(c.coefA,15/15,'coefA=1 (all on A)');
  eq(c.coefB,null,'coefB null (no B bets)');
  eq(c.coefX,null,'coefX null (no X bets)');
}

// ---------- 13. fmt rounding ----------
{
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{});
  const f=A.sandbox.fmt;
  eq(f(3),'3','fmt integer -> no decimals'); eq(f(2.5),'2.50','fmt 2.5'); eq(f(0),'0','fmt 0');
  eq(f(10*10/29*0+30*10/29),(30*10/29).toFixed(2),'fmt 10.3448 -> 2dp');
  eq(f(5.0),'5','fmt 5.0 -> 5');
}

// ---------- 14. single bettor on winner takes whole pool ----------
{
  const c=one({settled:true,winner:'A'},{p1:{team:'A',stake:3},p2:{team:'B',stake:8},p3:{team:'X',stake:4}}).calc();
  near(c.payouts.p1,15,'sole A winner gets entire pool 15 (net +12)');
  near(c.payouts.p1-3,12,'net +12');
}

console.log('\n'+(fail===0?'✅':'❌')+' betmathtest: '+pass+' passed, '+fail+' failed');
if(fail)process.exit(1);
