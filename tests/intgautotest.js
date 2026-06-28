const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
const broken={meta:{bank:100},players:{a:{name:'A',feePaid:true,dep:100}},matches:{m1:{teamA:'ברזיל',teamB:'גרמניה',settled:true,winner:'Z'}},bets:{m1:{a:{team:'A',stake:5}}}};
const clean={meta:{bank:100},players:{a:{name:'A',feePaid:true,dep:100}}};
const dup={meta:{bank:100},players:{a:{name:'דנה',feePaid:true,dep:100},b:{name:'דנה',feePaid:true,dep:100}}};

(async()=>{
// 1. integrityScan pure (no fetch)
let A=loadApp(clean,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
ok(A.sandbox.integrityScan(A.state.tree).length===0,'1: integrityScan clean -> 0');
ok(A.sandbox.integrityScan(broken).some(x=>x.level==='err'),'1: integrityScan broken -> err');

// 2. intgAutoScan sets _intgIssues for owner (admin)
A=loadApp(broken,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.intgAutoScan(A.state.tree);
ok(Array.isArray(A.sandbox._intgIssues)&&A.sandbox._intgIssues.some(x=>x.level==='err'),'2: intgAutoScan sets issues for admin');

// 3. intgAutoScan skips non-owner (player, not Niko)
A=loadApp(broken);A.sandbox.buildState(A.state.tree);A.sandbox.ME='a';
A.sandbox._intgIssues=null;
A.sandbox.intgAutoScan(A.state.tree);
ok(A.sandbox._intgIssues===null,'3: intgAutoScan skips non-owner (issues stay null)');

// 4. intgMiniUpdate states
A=loadApp(clean,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox._intgIssues=[{level:'err',msg:'x'},{level:'err',msg:'y'}];A.sandbox.intgMiniUpdate();
ok(A.q('#intgMini').innerHTML.indexOf('🔴 2')>=0,'4: mini shows 🔴 2 for errors');
A.sandbox._intgIssues=[{level:'warn',msg:'w'}];A.sandbox.intgMiniUpdate();
ok(A.q('#intgMini').innerHTML.indexOf('🟡 1')>=0,'4: mini shows 🟡 1 for warns');
A.sandbox._intgIssues=[];A.sandbox.intgMiniUpdate();
ok(A.q('#intgMini').innerHTML.indexOf('✓')>=0,'4: mini shows ✓ when clean');
A.sandbox._intgIssues=null;A.sandbox.intgMiniUpdate();
ok(A.q('#intgMini').innerHTML==='','4: mini empty when not scanned');

// 5. intgErrSig changes with errors
A.sandbox._intgIssues=[{level:'err',msg:'E1'}];let s1=A.sandbox.intgErrSig();
A.sandbox._intgIssues=[{level:'err',msg:'E2'}];let s2=A.sandbox.intgErrSig();
ok(s1!==s2&&s1.length>0,'5: intgErrSig differs when errors differ');

// 6. checkNotices shows integrity item (broken seed -> auto-scan finds error)
A=loadApp(broken,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.intgAutoScan(A.state.tree);
A.sandbox._intgDismissedSig='';A.sandbox._noticeOpen=false;
A.sandbox.checkNotices();
ok(A.sandbox._noticeOpen===true,'6: popup opens for integrity error');
ok(/בדיקת תקינות/.test(A.q('#nbox').innerHTML)&&/תקלות/.test(A.q('#nbox').innerHTML),'6: popup shows integrity errors');

// 7. dismiss records sig; same persistent errors do NOT re-pop
let sig=A.sandbox.intgErrSig();
A.sandbox.noticeDismiss();
ok(A.sandbox._intgDismissedSig===sig&&sig.length>0,'7: dismiss records error signature');
A.sandbox.intgAutoScan(A.state.tree);   // re-scan, same error persists
A.sandbox._noticeOpen=false;
A.sandbox.checkNotices();
ok(A.sandbox._noticeOpen===false,'7: same errors do NOT re-pop after dismiss');

// 8. changed errors re-pop
A.sandbox._intgIssues=[{level:'err',msg:'מאזן כללי לא נשמר: פער 5'}];
A.sandbox._noticeOpen=false;
A.sandbox.checkNotices();
ok(A.sandbox._noticeOpen===true,'8: changed errors re-pop');

// 9. integrity item + firebase notice together
A=loadApp({meta:{bank:100},players:{n:{name:'ניקולאי פלדמן',feePaid:true,dep:100}},matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'Z'}},bets:{m1:{n:{team:'A',stake:5}}},notices:{np_x:{type:'newplayer',name:'רוני',ts:100,seen:false}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
A.sandbox.intgAutoScan(A.state.tree);
A.sandbox._intgDismissedSig='';A.sandbox._noticeOpen=false;
A.sandbox.checkNotices();
ok(/בדיקת תקינות/.test(A.q('#nbox').innerHTML)&&/משתתף חדש/.test(A.q('#nbox').innerHTML),'9: popup shows BOTH integrity + new-player');

// 10. warnings only -> no popup (errors gate)
A=loadApp(dup,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.intgAutoScan(A.state.tree);
ok(A.sandbox._intgIssues.some(x=>x.level==='warn')&&!A.sandbox._intgIssues.some(x=>x.level==='err'),'10: dup names -> warn only');
A.sandbox._intgDismissedSig='';A.sandbox._noticeOpen=false;
A.sandbox.checkNotices();
ok(A.sandbox._noticeOpen===false,'10: warnings alone do NOT trigger popup');

console.log((fail?'❌':'✅')+' intgautotest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
