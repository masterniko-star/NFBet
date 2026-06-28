const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
const near=(a,b)=>Math.abs(a-b)<1e-6;

(async()=>{
// --- 1. un-pay a paid player with an open bet ---
let A=loadApp({meta:{bank:100},players:{p1:{name:'דנה',pw:'1',feePaid:true,dep:100}},matches:{m1:{teamA:'A',teamB:'B',settled:false}},bets:{m1:{p1:{team:'A',stake:10}}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);A.sandbox.confirm=function(){return true;};
A.sandbox.aToggleFee('p1');await flush();
let pl=await A.sandbox.fbGet("/players/p1");
ok(pl&&near(pl.resetBal,100),'1: resetBal = balance+pending (100)');
ok(pl&&pl.feePaid===false,'1: feePaid set false');
ok(pl&&pl.resetAt>0,'1: resetAt stamped');
let bet=await A.sandbox.fbGet("/bets/m1/p1");
ok(!bet,'1: open bet cancelled');
A.sandbox.buildState(A.state.tree);
ok(near(A.sandbox.statsFor('p1').balance,0),'1: balance is exactly 0 after un-pay');

// --- 2. un-pay with a SETTLED losing bet -> still exactly 0, snapshot correct ---
A=loadApp({meta:{bank:100},players:{p2:{name:'רון',feePaid:true,dep:100},w:{name:'מנצח',feePaid:true,dep:100}},
  matches:{ms:{teamA:'A',teamB:'B',settled:true,winner:'A'},mo:{teamA:'C',teamB:'D',settled:false}},
  bets:{ms:{p2:{team:'B',stake:20},w:{team:'A',stake:20}},mo:{p2:{team:'C',stake:5}}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);A.sandbox.confirm=function(){return true;};
let st=A.sandbox.statsFor('p2');           // staked25 pending5 won0 -> bal75 ; snapshot 80
A.sandbox.aToggleFee('p2');await flush();
let p2=await A.sandbox.fbGet("/players/p2");
ok(p2&&near(p2.resetBal,80),'2: snapshot with settled loss = 80');
A.sandbox.buildState(A.state.tree);
ok(near(A.sandbox.statsFor('p2').balance,0),'2: balance exactly 0 even with settled bet');
let ob=await A.sandbox.fbGet("/bets/mo/p2");ok(!ob,'2: open bet cancelled');
let sb=await A.sandbox.fbGet("/bets/ms/p2");ok(!!sb,'2: settled bet kept (history preserved)');

// --- 3. resetList gathers un-paid + exited ---
A=loadApp({meta:{bank:100},players:{
  a:{name:'אבי',feePaid:false,dep:0,resetBal:40,resetAt:200},
  b:{name:'בני',feePaid:true,dep:100},
  x:{name:'גיל',exited:true,exitBal:60,exitedAt:300,exitReason:'idle7'}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
let L=A.sandbox.resetList();
ok(L.length===2,'3: list has 2 (un-paid + exited), not the active paid one');
ok(L.some(function(r){return r.name==='אבי'&&near(r.bal,40);}),'3: un-paid אבי 40');
ok(L.some(function(r){return r.name==='גיל'&&near(r.bal,60)&&/7 ימי/.test(r.reason);}),'3: exited גיל 60 idle reason');
let txt=A.sandbox.resetText();
ok(/אבי/.test(txt)&&/גיל/.test(txt)&&/סה"כ להחזיר: 100/.test(txt),'3: text lists both + total 100');

// --- 4. re-add = CLEAN SLATE: paid, dep 100, balance 100, history (cashlog+bets+snapshot) wiped ---
A=loadApp({meta:{bank:100},players:{
  q:{name:'שי',feePaid:false,dep:20,resetBal:80,resetAt:200},
  w2:{name:'מנצח',feePaid:true,dep:100}},
  matches:{msx:{teamA:'A',teamB:'B',settled:true,winner:'A'}},
  bets:{msx:{q:{team:'B',stake:20},w2:{team:'A',stake:20}}},
  cashlog:{q:{c1:{ts:100,type:'in',amount:100,bal:100,note:'הפקדה ראשונה'},c2:{ts:200,type:'zero',amount:80,bal:0,note:'ביטול שולם'}}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);A.sandbox.confirm=function(){return true;};
A.q('#bf-q').value='100';
A.sandbox.aToggleFee('q');await flush();
let q=await A.sandbox.fbGet("/players/q");
ok(q&&q.feePaid===true&&near(q.dep,100)&&q.resetBal==null,'4: re-add -> feePaid, dep 100, resetBal cleared');
let qbet=await A.sandbox.fbGet("/bets/msx/q");
ok(!qbet,'4: old settled bet erased (history wiped)');
let qcl=await A.sandbox.fbGet("/cashlog/q");
let clVals=qcl?Object.keys(qcl).map(function(k){return qcl[k];}):[];
ok(clVals.length===1&&clVals[0].type==='in'&&near(clVals[0].amount,100),'4: cashlog reset to a single fresh deposit of 100');
A.sandbox.buildState(A.state.tree);
ok(near(A.sandbox.statsFor('q').balance,100),'4: balance is exactly 100 after re-add');
ok(A.sandbox.resetList().length===0,'4: re-added player drops off the return list');

// --- 5. mark-all un-pay snapshots everyone + cancels bets ---
A=loadApp({meta:{bank:100},players:{u1:{name:'A',feePaid:true,dep:100},u2:{name:'B',feePaid:true,dep:100}},
  matches:{m:{teamA:'X',teamB:'Y',settled:false}},bets:{m:{u1:{team:'A',stake:7},u2:{team:'B',stake:3}}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);A.sandbox.confirm=function(){return true;};
A.sandbox.aMarkAllPaid();await flush();
let u1=await A.sandbox.fbGet("/players/u1"),u2=await A.sandbox.fbGet("/players/u2");
ok(u1&&near(u1.resetBal,100)&&u2&&near(u2.resetBal,100),'5: mark-all un-pay snapshots both (100 each)');
let bm=await A.sandbox.fbGet("/bets/m");ok(!bm||(!bm.u1&&!bm.u2),'5: all open bets cancelled');

console.log((fail?'❌':'✅')+' resetbaltest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
