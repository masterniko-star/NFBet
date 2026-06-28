// statsmini.js — жёлтый треугольник (⚠️) в шапке панели «סטטיסטיקה»,
// когда есть незавершённый возврат (resetList не пуст): exited с exitBal или resetBal/resetAt.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};
const WARN='⚠'; // ⚠

// 1) есть незакрытый возврат (вышедший игрок с exitBal)
const A=loadApp({meta:{fee:100,bank:100,cur:'₪'},
  players:{p1:{name:'A',feePaid:true,dep:100,t:1,exited:true,exitedAt:1,exitBal:50,exitReason:'manual'}},
  matches:{},bets:{}},{});
A.sandbox.buildState(A.state.tree);
ok(A.sandbox.resetList().length===1,'resetList видит незакрытый возврат (=1)');
A.sandbox.statsMiniUpdate();
ok(A.q('#statsMini').innerHTML.indexOf(WARN)>=0,'⚠️ показан в шапке статистики при возврате');

// 2) возврат через resetBal/resetAt у активного игрока
const C=loadApp({meta:{fee:100,bank:100,cur:'₪'},
  players:{p1:{name:'B',feePaid:false,t:1,resetBal:30,resetAt:123}},
  matches:{},bets:{}},{});
C.sandbox.buildState(C.state.tree);
ok(C.sandbox.resetList().length===1,'resetBal/resetAt тоже считается возвратом');
C.sandbox.statsMiniUpdate();
ok(C.q('#statsMini').innerHTML.indexOf(WARN)>=0,'⚠️ показан и для resetBal-возврата');

// 3) нет возвратов — треугольника нет
const B=loadApp({meta:{fee:100,bank:100,cur:'₪'},players:{p1:{name:'A',feePaid:true,dep:100,t:1}},matches:{},bets:{}},{});
B.sandbox.buildState(B.state.tree);
ok(B.sandbox.resetList().length===0,'нет возвратов (resetList=0)');
B.sandbox.statsMiniUpdate();
ok(B.q('#statsMini').innerHTML==='','без возврата треугольника нет');

// 4) renderSettings выводит контейнер #statsMini в панель статистики
ok(B.sandbox.renderSettings.toString().indexOf('statsMini')>=0,'renderSettings подключает #statsMini');

console.log((fail?'❌':'✅')+' statsmini: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
