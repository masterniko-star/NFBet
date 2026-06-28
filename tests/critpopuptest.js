const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}

(async()=>{
// 1. logCrit adds to _clientCrits
let A=loadApp({meta:{bank:100}},{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.logCrit('render','renderActive נכשל: boom');
ok(A.sandbox._clientCrits.length===1&&/boom/.test(A.sandbox._clientCrits[0].msg),'1: logCrit -> added to buffer');
ok(A.sandbox._clientCrits[0].seen===false,'1: new crit unseen');

// 2. logErr / logWarn do NOT add
A=loadApp({meta:{bank:100}},{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.logErr('x','an error');A.sandbox.logWarn('y','a warning');
ok(A.sandbox._clientCrits.length===0,'2: logErr/logWarn do NOT enter crit popup buffer');

// 3. dedup: same cat+msg not piled up
A=loadApp({meta:{bank:100}},{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.critPopupAdd('js','same error');A.sandbox.critPopupAdd('js','same error');A.sandbox.critPopupAdd('js','same error');
ok(A.sandbox._clientCrits.length===1,'3: critPopupAdd dedupes identical crits');
A.sandbox.critPopupAdd('js','other error');
ok(A.sandbox._clientCrits.length===2,'3: distinct crit added');

// 4. checkNotices shows client crit (owner)
A=loadApp({meta:{bank:100}},{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.critPopupAdd('promise','Cannot read properties of undefined');
A.sandbox._noticeOpen=false;
A.sandbox.checkNotices();
ok(A.sandbox._noticeOpen===true,'4: popup opens for client crit');
ok(/שגיאת תוכנה/.test(A.q('#nbox').innerHTML)&&/Cannot read/.test(A.q('#nbox').innerHTML),'4: popup shows crit message');

// 5. dismiss marks seen; same crit no re-pop; new crit re-pops
A.sandbox.noticeDismiss();
ok(A.sandbox._clientCrits.every(c=>c.seen),'5: dismiss marks shown crits seen');
A.sandbox._noticeOpen=false;A.sandbox.checkNotices();
ok(A.sandbox._noticeOpen===false,'5: same crit does NOT re-pop after dismiss');
A.sandbox.critPopupAdd('render','a NEW crash');
A.sandbox._noticeOpen=false;A.sandbox.checkNotices();
ok(A.sandbox._noticeOpen===true,'5: a new crit re-pops');

// 6. non-owner: crits collected but popup gated off
A=loadApp({meta:{bank:100},players:{p:{name:'דנה',feePaid:true,dep:100}}});
A.sandbox.buildState(A.state.tree);A.sandbox.ME='p';
A.sandbox.critPopupAdd('js','participant crash');
A.sandbox._noticeOpen=false;A.sandbox.checkNotices();
ok(A.sandbox._noticeOpen===false,'6: non-owner sees no crit popup');

// 7. crit + integrity + firebase notice together
A=loadApp({meta:{bank:100},players:{n:{name:'ניקולאי פלדמן',feePaid:true,dep:100}},matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'Z'}},bets:{m1:{n:{team:'A',stake:5}}},notices:{np_x:{type:'newplayer',name:'רוני',ts:100,seen:false}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
A.sandbox.intgAutoScan(A.state.tree);
A.sandbox.critPopupAdd('promise','some crash');
A.sandbox._intgDismissedSig='';A.sandbox._noticeOpen=false;
A.sandbox.checkNotices();
let h=A.q('#nbox').innerHTML;
ok(/שגיאת תוכנה/.test(h)&&/בדיקת תקינות/.test(h)&&/משתתף חדש/.test(h),'7: popup shows crit + integrity + new-player together');

// 8. logCrit twice within window -> single buffer entry (logAdd dedup + critPopupAdd dedup)
A=loadApp({meta:{bank:100}},{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.logCrit('state','buildState נכשל');A.sandbox.logCrit('state','buildState נכשל');
ok(A.sandbox._clientCrits.length===1,'8: repeated logCrit -> single buffer entry');

console.log((fail?'❌':'✅')+' critpopuptest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
