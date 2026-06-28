const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
function has(issues,level,sub){return issues.some(x=>x.level===level&&x.msg.indexOf(sub)>=0);}

(async()=>{
// ---- CLEAN tree: conserving settled match + open match, no problems ----
let A=loadApp({meta:{bank:100},
  players:{a:{name:'A',feePaid:true,dep:100,t:1},b:{name:'B',feePaid:true,dep:100,t:1}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'A'},m2:{teamA:'P',teamB:'Q',settled:false}},
  bets:{m1:{a:{team:'A',stake:10},b:{team:'B',stake:10}},m2:{a:{team:'A',stake:5}}}
},{hash:'ctrl7'});
let iss=await A.sandbox.integrityRun();
ok(iss.length===0,'clean tree -> 0 issues ('+iss.map(x=>x.msg).join(' | ')+')');

// ---- E1: settled match invalid winner ----
let B=loadApp({meta:{bank:100},players:{a:{name:'A',feePaid:true,dep:100}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'Z'}},bets:{m1:{a:{team:'A',stake:5}}}},{hash:'ctrl7'});
iss=await B.sandbox.integrityRun();
ok(has(iss,'err','ללא תוצאה תקינה'),'E1: invalid winner flagged');

// ---- E3: orphan bet on deleted match ----
let C=loadApp({meta:{bank:100},players:{a:{name:'A',feePaid:true,dep:100}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:false}},
  bets:{m1:{a:{team:'A',stake:5}},mGhost:{a:{team:'A',stake:5}}}},{hash:'ctrl7'});
iss=await C.sandbox.integrityRun();
ok(has(iss,'err','משחק שכבר נמחק'),'E3: orphan bet on deleted match flagged');

// ---- E3: orphan bet by deleted player ----
let D=loadApp({meta:{bank:100},players:{a:{name:'A',feePaid:true,dep:100}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:false}},
  bets:{m1:{a:{team:'A',stake:5},ghost:{team:'B',stake:5}}}},{hash:'ctrl7'});
iss=await D.sandbox.integrityRun();
ok(has(iss,'err','משתתף שלא קיים'),'E3: orphan bet by deleted player flagged');

// ---- E5: exited with open bet (not cancelled) ----
let E=loadApp({meta:{bank:100},players:{x:{name:'X',feePaid:true,dep:100,exited:true,exitBal:95}},
  matches:{m2:{teamA:'P',teamB:'Q',settled:false}},bets:{m2:{x:{team:'A',stake:5}}}},{hash:'ctrl7'});
iss=await E.sandbox.integrityRun();
ok(has(iss,'err','הימור פתוח שלא בוטל'),'E5: exited with open bet flagged');

// ---- E5: exited with wrong stored exitBal ----
let F=loadApp({meta:{bank:100},players:{y:{name:'Y',feePaid:true,dep:100,exited:true,exitBal:999}}},{hash:'ctrl7'});
iss=await F.sandbox.integrityRun();
ok(has(iss,'warn','יתרת יציאה שמורה'),'E5: wrong stored exitBal flagged (warn)');

// ---- W1: negative balance (corrupt over-bet) ----
let G=loadApp({meta:{bank:100},players:{z:{name:'Z',feePaid:true,dep:10},w:{name:'W',feePaid:true,dep:100}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'A'}},
  bets:{m1:{z:{team:'B',stake:50},w:{team:'A',stake:50}}}},{hash:'ctrl7'});
iss=await G.sandbox.integrityRun();
ok(has(iss,'warn','יתרה שלילית'),'W1: negative balance flagged');
ok(!has(iss,'err','מאזן כללי'),'W1: money still conserves globally (no E2)');

// ---- W2: duplicate active names ----
let H=loadApp({meta:{bank:100},players:{a:{name:'דנה',feePaid:true,dep:100},b:{name:'דנה',feePaid:true,dep:100}}},{hash:'ctrl7'});
iss=await H.sandbox.integrityRun();
ok(has(iss,'warn','שם כפול'),'W2: duplicate names flagged');

// ---- W6: demo (un-paid) player with an open bet — root cause of negative balances ----
let DM=loadApp({meta:{bank:100},players:{d:{name:'דמו',feePaid:false,dep:0},w:{name:'W',feePaid:true,dep:100}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{d:{team:'A',stake:5}}}},{hash:'ctrl7'});
iss=await DM.sandbox.integrityRun();
ok(has(iss,'warn','מצב דמו עם הימור פתוח'),'W6: demo (un-paid) player with open bet flagged');
let CLp=loadApp({meta:{bank:100},players:{p:{name:'P',feePaid:true,dep:100}},matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{p:{team:'A',stake:5}}}},{hash:'ctrl7'});
iss=await CLp.sandbox.integrityRun();
ok(!has(iss,'warn','מצב דמו עם הימור פתוח'),'W6: paid player with open bet is NOT flagged (no false positive)');

// ---- W4: bad stake (zero) ----
let I=loadApp({meta:{bank:100},players:{a:{name:'A',feePaid:true,dep:100}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{a:{team:'A',stake:0}}}},{hash:'ctrl7'});
iss=await I.sandbox.integrityRun();
ok(has(iss,'warn','סכום לא תקין'),'W4: bad stake flagged');

// ---- W5: knockout draw X (drawOK=false) ----
let J=loadApp({meta:{bank:100},players:{a:{name:'A',feePaid:true,dep:100},b:{name:'B',feePaid:true,dep:100}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'X',drawOK:false}},
  bets:{m1:{a:{team:'X',stake:10},b:{team:'A',stake:10}}}},{hash:'ctrl7'});
iss=await J.sandbox.integrityRun();
ok(has(iss,'warn','תיקו (X) במשחק נוקאאוט'),'W5: knockout draw flagged');
ok(!has(iss,'err','מאזן משחק'),'W5: knockout X still conserves (no E1)');

// ---- exited player clean: settled bet kept, exitBal matches ----
let K=loadApp({meta:{bank:100},players:{
  e:{name:'E',feePaid:true,dep:100,exited:true,exitBal:110},
  o:{name:'O',feePaid:true,dep:100}},
  matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'A'}},
  bets:{m1:{e:{team:'A',stake:10},o:{team:'B',stake:10}}}},{hash:'ctrl7'});
iss=await K.sandbox.integrityRun();
ok(iss.length===0,'exited with correct exitBal=110 -> 0 issues ('+iss.map(x=>x.msg).join(' | ')+')');

console.log((fail?'❌':'✅')+' integritytest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
