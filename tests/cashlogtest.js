const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
function entries(tree,pid){return Object.values((tree.cashlog||{})[pid]||{});}

(async()=>{
  // ===== first deposit via aToggleFee (field amount -> deposit) =====
  let A=loadApp({meta:{bank:100,fee:100,cur:'\u20aa',minBet:1},players:{p1:{name:'A',feePaid:false,t:1}}},{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);
  A.q('#bf-p1').value='100';
  A.sandbox.aToggleFee('p1'); await flush();
  let e1=entries(A.state.tree,'p1');
  ok(e1.length===1,'toggleFee on -> 1 cash entry (got '+e1.length+')');
  ok(e1[0]&&e1[0].type==='in'&&e1[0].amount===100,'first deposit logged: in 100');
  ok(e1[0]&&e1[0].bal===100,'first deposit bal-after = 100');
  ok(e1[0]&&e1[0].note==='הפקדה ראשונה','first-deposit note set');
  ok(e1[0]&&e1[0].ts>0,'timestamp set');

  // ===== aApply deposit +50 then withdraw -20 =====
  let B=loadApp({meta:{bank:100,fee:100,cur:'\u20aa',minBet:1},players:{p2:{name:'B',feePaid:true,dep:100,t:1}}},{hash:'ctrl7'});
  B.sandbox.buildState(B.state.tree);
  B.q('#bf-p2').value='50'; B.sandbox.aApply('p2'); await flush();
  let e2=entries(B.state.tree,'p2');
  ok(e2.length===1&&e2[0].type==='in'&&e2[0].amount===50,'aApply +50 -> in 50');
  ok(e2[0].bal===150,'deposit bal-after = 150');
  B.sandbox.buildState(B.state.tree);
  B.q('#bf-p2').value='-20'; B.sandbox.aApply('p2'); await flush();
  let e2b=entries(B.state.tree,'p2');
  ok(e2b.length===2,'after withdraw -> 2 entries');
  let out=e2b.find(x=>x.type==='out');
  ok(out&&out.amount===20,'aApply -20 -> out 20');
  ok(out&&out.bal===130,'withdraw bal-after = 130 (150-20)');

  // ===== aToggleFee off -> zero =====
  B.sandbox.buildState(B.state.tree);
  B.sandbox.aToggleFee('p2'); await flush();
  let zero=entries(B.state.tree,'p2').find(x=>x.type==='zero');
  ok(zero,'toggleFee off -> zero entry');
  ok(zero&&zero.bal===0,'zero entry bal-after = 0');
  ok(zero&&zero.amount===130,'zero entry amount = balance removed (130)');

  // ===== seedOpeningCash: opening for pre-existing dep, wd handled, idempotent =====
  let C=loadApp({meta:{bank:100,fee:100,cur:'\u20aa'},players:{
    p3:{name:'C',feePaid:true,dep:100,t:5},
    p4:{name:'D',feePaid:true,dep:150,wd:30,t:6},
    p5:{name:'E',feePaid:false,t:7}
  }},{hash:'ctrl7'});
  C.sandbox.buildState(C.state.tree);
  C.sandbox.seedOpeningCash(); await flush(); C.sandbox.buildState(C.state.tree);
  let o3=entries(C.state.tree,'p3'),o4=entries(C.state.tree,'p4'),o5=entries(C.state.tree,'p5');
  ok(o3.length===1&&o3[0].type==='open'&&o3[0].amount===100,'opening: p3 open 100');
  ok(o3[0].bal===100,'opening p3 bal=100');
  ok(o4.length===2,'opening p4: open + out (had wd)');
  ok(!!o4.find(x=>x.type==='open'&&x.amount===150),'p4 open 150');
  ok(!!o4.find(x=>x.type==='out'&&x.amount===30),'p4 pre-journal withdrawal 30');
  ok(o4.find(x=>x.type==='open').bal===120,'p4 opening bal = 150-30 = 120');
  ok(o5.length===0,'p5 (no dep) -> no opening entry');
  C.sandbox.seedOpeningCash(); await flush(); C.sandbox.buildState(C.state.tree);
  ok(entries(C.state.tree,'p3').length===1,'seedOpeningCash idempotent (p3 still 1)');
  ok(entries(C.state.tree,'p4').length===2,'seedOpeningCash idempotent (p4 still 2)');

  // ===== buildState exposes S.cashlog =====
  ok(typeof C.sandbox.S.cashlog==='object'&&!!C.sandbox.S.cashlog.p3,'S.cashlog loaded in buildState');

  // ===== anti-double-count: opening fixed even if a deposit happens, then re-seed =====
  let D=loadApp({meta:{bank:100,fee:100,cur:'\u20aa',minBet:1},players:{p6:{name:'F',feePaid:true,dep:100,t:1}}},{hash:'ctrl7'});
  D.sandbox.buildState(D.state.tree);
  D.sandbox.seedOpeningCash(); await flush(); D.sandbox.buildState(D.state.tree);
  D.q('#bf-p6').value='40'; D.sandbox.aApply('p6'); await flush(); D.sandbox.buildState(D.state.tree);
  D.sandbox.seedOpeningCash(); await flush(); D.sandbox.buildState(D.state.tree);
  let o6=entries(D.state.tree,'p6');
  ok(o6.filter(x=>x.type==='open').length===1,'opening NOT duplicated after later deposit + re-seed');
  ok(o6.find(x=>x.type==='open').amount===100,'opening still original 100 (not inflated by the 40)');
  ok(!!o6.find(x=>x.type==='in'&&x.amount===40),'later deposit 40 recorded separately');

  console.log((fail?'❌':'✅')+' cashlogtest: '+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
