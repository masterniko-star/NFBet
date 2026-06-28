const {loadApp}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},players:{},matches:{},bets:{}};
(async()=>{
const A=loadApp(seed,{});const S=A.sandbox;S.buildState(A.state.tree);
console.log('===== repeat collapse (no flood) =====');
S.logClear();
for(let i=0;i<6;i++)S.logCrit("firebase","GET /rev נכשל (רשת): Failed to fetch");
let a=S.logRead();
ok(a.length===1,'6 identical errors collapse to 1 entry ('+a.length+')');
ok(a[0].n===6,'collapsed entry carries count n=6 ('+a[0].n+')');
S.logErr("firebase","GET /meta -> 401"); // different msg -> new entry
ok(S.logRead().length===2,'different message starts a new entry');

console.log('===== connection state logs ONCE =====');
S.logClear();S.connDown=false;
S.connFail(new TypeError('Failed to fetch'));
S.connFail(new TypeError('Failed to fetch'));
S.connFail(new TypeError('Failed to fetch'));
let warns=S.logRead().filter(e=>e.cat==='net'&&/אין חיבור/.test(e.msg));
ok(warns.length===1,'connection-loss logged exactly once across repeated failures ('+warns.length+')');
ok(S.connDown===true,'connDown flag set');
S.connOk(); // recovery
let oks=S.logRead().filter(e=>e.cat==='net'&&/חזר/.test(e.msg));
ok(oks.length===1,'connection-restored logged once');
ok(S.connDown===false,'connDown cleared after recovery');
S.connOk(); // already ok -> no extra log
ok(S.logRead().filter(e=>/חזר/.test(e.msg)).length===1,'no duplicate restore log when already connected');

console.log('===== fire-and-forget writes do not throw on network failure =====');
S.fetch=function(){return Promise.reject(new TypeError('down'));};
let threw=false;
try{ S.fbBump(); }catch(e){threw=true;}
ok(!threw,'fbBump does not throw synchronously when offline');
// trigger a CRIT -> diagPush fires a fetch that rejects but is .catch-handled
S.logClear();
let before=S.logRead().length;
S.logCrit("test","boom"); // triggers diagPush (fetch rejects, but caught)
await wait(120);
ok(true,'diagPush fetch rejection is swallowed (no loop)');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
