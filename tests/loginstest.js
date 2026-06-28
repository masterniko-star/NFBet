const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
  players:{p1:{name:'\u05d3\u05e0\u05d9',t:1},p2:{name:'\u05e0\u05d5\u05e2\u05d4',t:2}},  // דני, נועה
  matches:{},bets:{}};

(async()=>{
console.log('===== logins panel: markEntry -> /seen -> renderLogins =====');
const A=loadApp(seed,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.ME='p1';A.sandbox.markEntry();await flush(50);
ok((A.state.tree.seen||{}).p1,'markEntry wrote /seen/p1');

A.sandbox.renderLogins();await flush(60);
const box=(A.q('#loginsBox')||{}).innerHTML||'';
ok(box.indexOf('\u05e0\u05db\u05e0\u05e1\u05d5')>=0&&box.indexOf('1')>=0,'header shows entered count ("נכנסו 1/2")');
ok(box.indexOf('\u05d3\u05e0\u05d9')>=0,'entered player "דני" listed');
ok(box.indexOf('\u05e0\u05d5\u05e2\u05d4')>=0,'not-entered player "נועה" listed');
ok(box.indexOf('\u05dc\u05d0 \u05e0\u05db\u05e0\u05e1')>=0,'"לא נכנס/ה" marker shown for non-entrant');
ok(box.indexOf('\u00d7')>=0,'entry-count "×" indicator present');

console.log('\n===== switch account within one session re-marks both =====');
// \u0431\u0430\u0433 \u0431\u044b\u043b: \u0433\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u044b\u0439 \u0444\u043b\u0430\u0433 _enteredThisSession \u043d\u0435 \u0441\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u043b\u0441\u044f \u043f\u0440\u0438 switchMe -> \u0432\u0442\u043e\u0440\u043e\u0439 \u0438\u0433\u0440\u043e\u043a \u043d\u0435 \u043f\u0438\u0441\u0430\u043b\u0441\u044f \u0432 /seen.
const C=loadApp(seed,{hash:'ctrl7'});C.sandbox.buildState(C.state.tree);
C.sandbox.ME='p1';C.sandbox.markEntry();await flush(50);
C.sandbox.ME='p2';C.sandbox.markEntry();await flush(50);   // \u0441\u043c\u0435\u043d\u0430 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430 \u0432 \u0442\u043e\u0439 \u0436\u0435 \u0441\u0435\u0441\u0441\u0438\u0438
ok((C.state.tree.seen||{}).p1&&(C.state.tree.seen||{}).p2,'\u043e\u0431\u0430 p1 \u0438 p2 \u0437\u0430\u043f\u0438\u0441\u0430\u043d\u044b \u0432 /seen \u043f\u043e\u0441\u043b\u0435 \u043f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f');

console.log('\n===== markEntry: \u0441\u0431\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438 -> \u043b\u043e\u0433 + \u041d\u0415 \u043f\u043e\u043c\u0435\u0447\u0435\u043d, \u043f\u043e\u0432\u0442\u043e\u0440 \u0437\u0430\u043f\u0438\u0441\u044b\u0432\u0430\u0435\u0442 =====');
const E=loadApp(seed,{hash:'ctrl7'});E.sandbox.buildState(E.state.tree);
const realFetchE=E.sandbox.fetch;let failPut=true;
E.sandbox.fetch=function(url,opts){
  if(failPut&&/\/seen\//.test(String(url))&&opts&&String(opts.method||'').toUpperCase()==='PUT')
    return Promise.resolve({ok:false,status:500,json:()=>Promise.resolve(null)});
  return realFetchE(url,opts);
};
E.sandbox.ME='p1';E.sandbox.markEntry();await flush(50);
ok(!((E.state.tree.seen||{}).p1),'PUT 500 -> /seen \u041d\u0415 \u0437\u0430\u043f\u0438\u0441\u0430\u043d (\u043d\u0435\u0442 \u043b\u043e\u0436\u043d\u043e\u0439 \u043e\u0442\u043c\u0435\u0442\u043a\u0438 \u0432\u0445\u043e\u0434\u0430)');
ok((E.sandbox._diagBuf||[]).some(function(e){return e.cat==='entry'&&e.lvl==='WARN';}),'\u0441\u0431\u043e\u0439 \u0437\u0430\u043b\u043e\u0433\u0438\u0440\u043e\u0432\u0430\u043d \u043a\u0430\u043a WARN (\u0432\u0438\u0434\u0435\u043d \u0432 \u05d9\u05d5\u05de\u05df \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd)');
failPut=false;                                              // \u0441\u0435\u0442\u044c \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u043b\u0430\u0441\u044c
E.sandbox.markEntry();await flush(50);                      // \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 (\u0441\u0442\u0430\u0432\u043a\u0430/refresh) \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0435\u0442
ok((E.state.tree.seen||{}).p1,'\u043f\u043e\u0432\u0442\u043e\u0440 \u043f\u043e\u0441\u043b\u0435 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u0437\u0430\u043f\u0438\u0441\u044b\u0432\u0430\u0435\u0442 /seen/p1');

console.log('\n===== renderLogins: \u0441\u0442\u0430\u0432\u043a\u0430 \u0435\u0441\u0442\u044c, \u0432\u0445\u043e\u0434\u0430 \u043d\u0435\u0442 -> \u0434\u0438\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 WARN =====');
const D=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
  players:{px:{name:'\u05e6\u05d3',feePaid:true,t:1}},
  matches:{m1:{round:'R32',order:0,t:1,teamA:'H',teamB:'A',settled:false,winner:null}},
  bets:{m1:{px:{team:'A',stake:3}}}},{hash:'ctrl7'});
D.sandbox.buildState(D.state.tree);                          // /seen \u043f\u0443\u0441\u0442, \u043d\u043e \u0443 px \u0435\u0441\u0442\u044c \u0441\u0442\u0430\u0432\u043a\u0430
D.sandbox.renderLogins();await flush(60);
ok((D.sandbox._diagBuf||[]).some(function(e){return e.cat==='entry'&&/\u05dc\u05d0 \u05e0\u05db\u05e0\u05e1/.test(e.msg);}),'renderLogins \u043b\u043e\u0433\u0438\u0440\u0443\u0435\u0442 \u0440\u0430\u0441\u0441\u0438\u043d\u0445\u0440\u043e\u043d: \u0435\u0441\u0442\u044c \u0441\u0442\u0430\u0432\u043a\u0430, \u043d\u043e \u043d\u0435\u0442 /seen');

console.log('\n===== logins panel: no participants =====');
const B=loadApp({meta:{bank:100,cur:'\u20aa'},players:{},matches:{},bets:{}},{hash:'ctrl7'});B.sandbox.buildState(B.state.tree);
B.sandbox.renderLogins();await flush(40);
ok(((B.q('#loginsBox')||{}).innerHTML||'').indexOf('\u05d0\u05d9\u05df \u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd')>=0,'no players -> "אין משתתפים"');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
