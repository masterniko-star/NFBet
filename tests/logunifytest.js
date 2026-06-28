const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}

(async()=>{
// orphan bet: settled match m1 with a bet from "ghost" who is NOT in players
let A=loadApp({meta:{bank:100},players:{real:{name:'דנה',feePaid:true,dep:100}},matches:{m1:{teamA:'A',teamB:'B',settled:true,winner:'A'}},bets:{m1:{ghost:{team:'A',stake:5}}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);

// 1. integrity scan flags the orphan
let iss=A.sandbox.integrityScan(A.state.tree);
ok(iss.some(function(x){return /שלא קיים/.test(x.msg);}),'1: integrityScan flags orphan bet');

// 2. auto-scan writes the finding into the log (so it lands in the copyable text)
A.sandbox.intgAutoScan(A.state.tree);
let txt=A.sandbox.logText();
ok(/שלא קיים/.test(txt),'2: integrity finding written to the log (logText)');
ok(/integrity/.test(txt),'2: logged under integrity category');

// 3. integrity ERROR reached the /diag buffer (ERR is pushed)
ok(A.sandbox._diagBuf.some(function(e){return /שלא קיים/.test(e.msg);}),'3: integrity error pushed to /diag buffer');

// 4. WARN now reaches /diag too (was CRIT/ERR only before)
A.sandbox.logWarn('test','warn-to-diag-check');
ok(A.sandbox._diagBuf.some(function(e){return /warn-to-diag-check/.test(e.msg);}),'4: WARN now pushed to /diag buffer');

// 5. dedup: repeated scans do not duplicate the integrity log entry
let n1=A.sandbox.logRead().filter(function(e){return /שלא קיים/.test(e.msg);}).length;
A.sandbox.intgAutoScan(A.state.tree);A.sandbox.intgAutoScan(A.state.tree);
let n2=A.sandbox.logRead().filter(function(e){return /שלא קיים/.test(e.msg);}).length;
ok(n1>=1&&n1===n2,'5: repeated scans do not duplicate integrity entries (dedup)');

// 6. INFO stays local-only (keep noise out of /diag)
A.sandbox.logInfo('test','info-line-check');
ok(!A.sandbox._diagBuf.some(function(e){return /info-line-check/.test(e.msg);}),'6: INFO stays local (not in /diag)');

console.log((fail?'❌':'✅')+' logunifytest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
