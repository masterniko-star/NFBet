const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}

(async()=>{
// ===== 1. noticeItemHtml demote case (owner notice) =====
let A=loadApp({meta:{bank:100,cur:'\u20aa'},players:{niko:{name:'\u05e0\u05d9\u05e7\u05d5\u05dc\u05d0\u05d9 \u05e4\u05dc\u05d3\u05de\u05df',feePaid:true,dep:100,t:1}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
let h0=A.sandbox.noticeItemHtml({type:'demote',name:'\u05d3\u05e0\u05d9',amount:0});
ok(/\u05e2\u05d1\u05e8\/\u05d4 \u05dc\u05de\u05e6\u05d1 \u05d3\u05de\u05d5/.test(h0),'1: demote notice text (moved to demo)');
ok(/\u05d0\u05d9\u05df \u05d9\u05ea\u05e8\u05d4/.test(h0),'1: amount 0 -> (no balance)');
ok(/\u05d3\u05e0\u05d9/.test(h0),'1: demote notice shows name');
let h1=A.sandbox.noticeItemHtml({type:'demote',name:'X',amount:0.5});
ok(/\u05dc\u05d4\u05d7\u05d6\u05e8/.test(h1)&&/0\.50/.test(h1),'1: amount>0 -> shows residual to return');

// ===== 2. buildState carries demoteAt/demoteNotify =====
let B=loadApp({meta:{bank:100,cur:'\u20aa'},players:{
  d:{name:'Demo',feePaid:false,dep:0,demoteAt:12345,demoteNotify:true,t:1}
}});
B.sandbox.buildState(B.state.tree);
let pd=B.sandbox.S.players.find(p=>p.id==='d');
ok(pd&&pd.demoteAt===12345,'2: demoteAt carried into state');
ok(pd&&pd.demoteNotify===true,'2: demoteNotify carried into state');

// ===== 3. checkMyDemote shows popup for demoted player; ack clears flag =====
let C=loadApp({meta:{bank:100,cur:'\u20aa'},players:{
  d:{name:'Demo',feePaid:false,dep:0,demoteAt:1,demoteNotify:true,t:1}
}});
C.sandbox.buildState(C.state.tree);
C.sandbox.ME='d';
C.sandbox.checkMyDemote();
ok(C.sandbox._noticeOpen===true,'3: checkMyDemote opens popup for demoted player');
ok(/\u05de\u05e6\u05d1 \u05d3\u05de\u05d5/.test(C.q('#nbox').innerHTML),'3: popup has demo header');
ok(/\u05e4\u05d7\u05d5\u05ea \u05de-1/.test(C.q('#nbox').innerHTML),'3: popup has balance<1 text');
ok(/\u05e6\u05d5\u05e8 \u05e7\u05e9\u05e8 \u05e2\u05dd \u05de\u05e0\u05d4\u05dc/.test(C.q('#nbox').innerHTML),'3: popup has contact-admin text');
C.sandbox.demoteAck(); await flush();
ok(C.sandbox._noticeOpen===false,'3: demoteAck closes popup');
ok(C.state.tree.players.d.demoteNotify===false,'3: demoteAck clears demoteNotify in DB');

// ===== 4. checkMyDemote no-op when demoteNotify absent =====
let D=loadApp({meta:{bank:100,cur:'\u20aa'},players:{
  d:{name:'Demo',feePaid:false,dep:0,demoteAt:1,t:1}
}});
D.sandbox.buildState(D.state.tree);
D.sandbox.ME='d';
D.sandbox.checkMyDemote();
ok(D.sandbox._noticeOpen===false,'4: no popup when demoteNotify absent');

// ===== 5. clean-slate gate includes demoteAt (re-pay wipes history) =====
let E=loadApp({meta:{bank:100,cur:'\u20aa'},players:{
  d:{name:'Demo',feePaid:false,dep:0,demoteAt:777,t:1}
},matches:{m1:{teamA:'X',teamB:'Y',settled:false}},
  bets:{m1:{d:{team:'A',stake:5}}},
  cashlog:{d:{old1:{ts:1,type:'in',amount:100,bal:100,note:'x'},old2:{ts:2,type:'out',amount:50,bal:50,note:'y'}}}
},{hash:'ctrl7'});
E.sandbox.buildState(E.state.tree);
E.q('#bf-d').value='100';
E.sandbox.aToggleFee('d'); await flush();
ok(E.state.tree.players.d.feePaid===true,'5: demoted player re-paid (feePaid=true)');
ok(E.state.tree.players.d.demoteAt===null,'5: demoteAt cleared on clean-slate re-pay');
ok(!(E.state.tree.bets.m1&&E.state.tree.bets.m1.d),'5: old bets wiped on clean-slate');
let cl=E.state.tree.cashlog.d||{};let keys=Object.keys(cl);
ok(keys.length===1&&cl[keys[0]].note==='\u05d4\u05e4\u05e7\u05d3\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4','5: cashlog reset to single first-deposit entry');
ok(cl[keys[0]].amount===100,'5: clean-slate deposit = bank (100)');

console.log((fail?('FAILED '+fail+' '):'ALL PASS ')+pass+'/'+(pass+fail));
process.exit(fail?1:0);
})();
