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

console.log('\n===== logins panel: no participants =====');
const B=loadApp({meta:{bank:100,cur:'\u20aa'},players:{},matches:{},bets:{}},{hash:'ctrl7'});B.sandbox.buildState(B.state.tree);
B.sandbox.renderLogins();await flush(40);
ok(((B.q('#loginsBox')||{}).innerHTML||'').indexOf('\u05d0\u05d9\u05df \u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd')>=0,'no players -> "אין משתתפים"');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
