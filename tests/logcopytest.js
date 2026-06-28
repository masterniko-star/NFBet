const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}

(async()=>{
// tree with a real problem (negative balance) so the integrity scan logs locally + to /diag
let A=loadApp({meta:{bank:100},players:{z:{name:'זהר',feePaid:true,dep:10},w:{name:'W',feePaid:true,dep:100}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'A'}},
  bets:{m1:{z:{team:'B',stake:50},w:{team:'A',stake:50}}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
A.sandbox.navigator={clipboard:{writeText:function(t){A.sandbox.__copied=t;return Promise.resolve();}}};

// 1) integrity scan logs the finding into THIS device's local log (+/diag buffer)
await A.sandbox.integrityRun();
await flush();
ok(/יתרה שלילית/.test(A.sandbox.logText()),'setup: integrity finding is in this device local log');

// 2) simulate server + another device having written to /diag
await A.sandbox.fbSet("/diag/server",{pulse:Date.now(),items:[{ts:Date.now(),lvl:"INFO",cat:"run",msg:"server-run-marker"}]});
await A.sandbox.fbSet("/diag/otherdev",{upd:Date.now(),items:[{ts:Date.now(),lvl:"CRIT",cat:"js",msg:"other-device-crit-marker"}]});

// 3) ONE button -> one combined text
A.sandbox.__copied="";
A.sandbox.copyAllLog(null);
await flush();
let t=A.sandbox.__copied||"";

ok(t.length>0,'copyAllLog produced text');
ok(/NF PlayOff log/.test(t),'1 button: includes THIS device local log header');
ok(/ver 2026-/.test(t)&&/mode admin/.test(t),'1 button: header has version + mode (anchors)');
ok(/יתרה שלילית/.test(t),'1 button: includes this-device problem findings');
ok(/יומן שרת/.test(t),'1 button: includes the server+devices section');
ok(/server-run-marker/.test(t),'1 button: includes a SERVER entry');
ok(/other-device-crit-marker/.test(t),'1 button: includes OTHER devices entries');

console.log((fail?'❌':'✅')+' logcopytest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
