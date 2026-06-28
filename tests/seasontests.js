const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;
function ok(c,m){tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);}
function approx(a,b){return Math.abs(a-b)<1e-7;}

(async()=>{
console.log('===== E1. FULL-SEASON CONSERVATION via real settle chain (+auto-bets) =====');
// 8 players, 10 matches, random bets; settle each with mixed A/B/X through real aSettle
function mk(seed){let s=seed|0;return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let r=mk(98765);
const N=8,M=10,BANK=100;
const players={},matches={},bets={};
for(let i=0;i<N;i++)players['p'+i]={name:'P'+i,t:i};
for(let m=0;m<M;m++){
  matches['m'+m]={round:'R32',order:m,t:m,teamA:'A'+m,teamB:'B'+m,dt:'',settled:false,winner:null};
  const bb={}; for(let i=0;i<N;i++){ if(r()<0.6) bb['p'+i]={team:(r()<0.5?'A':'B'),stake:1+Math.floor(r()*5)}; }
  bets['m'+m]=bb;
}
const seed={meta:{fee:100,bank:BANK,minBet:1,maxBet:10,cur:'₪'},players,matches,bets};
let A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);A.sandbox.MODE='admin';
// settle all sequentially
for(let m=0;m<M;m++){const w=r();const out=w<0.4?'A':(w<0.8?'B':'X');A.sandbox.aSettle('m'+m,out);await flush(25);}
A.sandbox.buildState(A.state.tree);
let sumBal=0,allMatch=true;
for(let i=0;i<N;i++){const st=A.sandbox.statsFor('p'+i);sumBal+=st.balance;
  // independent recompute
  let staked=0,won=0;A.sandbox.S.matches.forEach(mt=>{const b=(mt.bets||{})['p'+i];if(!b)return;staked+=Number(b.stake)||0;if(mt.settled)won+=(A.sandbox.calcMatch(mt).payouts['p'+i]||0);});
  if(!approx(st.balance, BANK-staked+won))allMatch=false;
}
ok(allMatch,'season: every balance == bank - staked + won');
ok(A.sandbox.S.matches.every(m=>m.settled),'season: all matches settled');
ok(approx(sumBal, N*BANK),'season: Σbalances == N*bank ('+sumBal.toFixed(2)+' vs '+(N*BANK)+')');
// no orphan auto-bets: every auto bet belongs to a settled match & a real player
let orphan=false;
Object.keys(A.state.tree.bets||{}).forEach(mid=>{const mt=A.state.tree.matches[mid];Object.keys(A.state.tree.bets[mid]||{}).forEach(pid=>{const b=A.state.tree.bets[mid][pid];if(b&&b.auto){if(!mt||!mt.settled||!A.state.tree.players[pid])orphan=true;}});});
ok(!orphan,'season: no orphan auto-bets');

console.log('\n===== E2. SETTLE -> UNSETTLE restores exactly =====');
const seed2={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},
  players:{p0:{name:'A',t:1},p1:{name:'B',t:2},p2:{name:'C',t:3}},
  matches:{m1:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:'',settled:false,winner:null}},
  bets:{m1:{p0:{team:'A',stake:3},p1:{team:'B',stake:5}}}};
let U=loadApp(seed2,{});U.sandbox.buildState(U.state.tree);U.sandbox.MODE='admin';
const balBefore=[0,1,2].map(i=>U.sandbox.statsFor('p'+i).balance);
U.sandbox.aSettle('m1','A');await flush();
U.sandbox.aSettle('m1','A');await flush(); // toggle off
U.sandbox.buildState(U.state.tree);
const balAfter=[0,1,2].map(i=>U.sandbox.statsFor('p'+i).balance);
ok(JSON.stringify(balBefore)===JSON.stringify(balAfter),'unsettle restores balances exactly');
const autos=Object.keys(U.state.tree.bets.m1||{}).filter(k=>U.state.tree.bets.m1[k].auto).length;
ok(autos===0,'unsettle leaves no auto-bets');
ok(!!U.state.tree.bets.m1.p0&&!!U.state.tree.bets.m1.p1,'unsettle keeps real bets');

console.log('\n===== E3. RE-SETTLE change winner (A -> B) without explicit unsettle =====');
let R=loadApp(seed2,{});R.sandbox.buildState(R.state.tree);R.sandbox.MODE='admin';
R.sandbox.aSettle('m1','A');await flush();
R.sandbox.aSettle('m1','B');await flush();
ok(R.state.tree.matches.m1.winner==='B'&&R.state.tree.matches.m1.settled,'re-settle: winner switched to B');
// each player at most one bet (no duplicates), p2 auto-bet present & singular
const dup=Object.keys(R.state.tree.bets.m1).filter(k=>!R.state.tree.players[k]).length;
ok(dup===0,'re-settle: no bets for non-existent players');
R.sandbox.buildState(R.state.tree);
let s2=0;[0,1,2].forEach(i=>s2+=R.sandbox.statsFor('p'+i).balance);
ok(approx(s2,3*100),'re-settle: Σbalances still 3*bank');

console.log('\n===== E4. clampStake bounds (min/max/avail) =====');
const cs=loadApp({meta:{fee:100,bank:3,minBet:1,maxBet:10,cur:'₪'},players:{p0:{name:'A',t:1}},matches:{m1:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:'',settled:false,winner:null}},bets:{}},{});
cs.sandbox.buildState(cs.state.tree);cs.sandbox.ME='p0';
ok(cs.sandbox.clampStake('m1',50)===3,'clamp: capped by available (3)');
ok(cs.sandbox.clampStake('m1',2)===2,'clamp: within range kept');
ok(cs.sandbox.clampStake('m1',0)===1,'clamp: below min -> minBet(1)');
const cs2=loadApp({meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},players:{p0:{name:'A',t:1}},matches:{m1:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:'',settled:false,winner:null}},bets:{}},{});
cs2.sandbox.buildState(cs2.state.tree);cs2.sandbox.ME='p0';
ok(cs2.sandbox.clampStake('m1',50)===10,'clamp: capped by maxBet(10)');

console.log('\n===== E5. LARGE DATA render (90 players, 60 matches) no throw =====');
const bigP={},bigM={},bigB={};
for(let i=0;i<90;i++)bigP['p'+i]={name:'Player '+i,t:i};
for(let m=0;m<60;m++){bigM['m'+m]={round:'R32',order:m,t:m,teamA:'Team A'+m,teamB:'Team B'+m,dt:'',settled:(m%3===0),winner:(m%3===0?(m%2?'A':'X'):null)};
  const bb={};for(let i=0;i<90;i++){if((i+m)%2===0)bb['p'+i]={team:(i%2?'A':'B'),stake:1+(i%5)};}bigB['m'+m]=bb;}
let BG=loadApp({meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},players:bigP,matches:bigM,bets:bigB},{});
BG.sandbox.buildState(BG.state.tree);
function tryRender(mode,tab,me){BG.sandbox.MODE=mode;BG.sandbox.TAB=tab;BG.sandbox.ME=me;try{BG.sandbox.renderActive();return null;}catch(e){return e;}}
ok(!tryRender('player','all','p5'),'large: leaderboard renders');
ok(!tryRender('player','board','p5'),'large: board renders');
ok(!tryRender('player','hist','p5'),'large: history renders');
ok(!tryRender('player','bet','p5'),'large: bet view renders');
ok(!tryRender('admin','matches',null),'large: admin matches renders');
ok(!tryRender('admin','players',null),'large: admin players renders');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));
process.exit(fails?1:0);
})();
