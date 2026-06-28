const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}

(async()=>{
// ===== isOwnerView: admin / Niko-player / other-player =====
const seedBase={meta:{bank:100,cur:'\u20aa'},players:{
  niko:{name:'ניקולאי פלדמן',feePaid:true,dep:100,t:1},
  other:{name:'דנה',feePaid:true,dep:100,t:2}
}};
let AD=loadApp(seedBase,{hash:'ctrl7'}); AD.sandbox.buildState(AD.state.tree);
ok(AD.sandbox.MODE==='admin','admin mode set');
ok(AD.sandbox.isOwnerView()===true,'admin -> isOwnerView true');

let PL=loadApp(seedBase); PL.sandbox.buildState(PL.state.tree);
ok(PL.sandbox.MODE==='player','player mode set');
PL.sandbox.ME='niko';
ok(PL.sandbox.isOwnerView()===true,'player Niko -> isOwnerView true');
PL.sandbox.ME='other';
ok(PL.sandbox.isOwnerView()===false,'player other -> isOwnerView false');

// ===== noticeUnseen filters + sorts =====
let A=loadApp({meta:{bank:100,cur:'\u20aa'},players:{niko:{name:'ניקולאי פלדמן',feePaid:true,dep:100,t:1}},notices:{
  a:{type:'newplayer',name:'X',ts:100,seen:false},
  b:{type:'crit',reason:'fetch failed',ts:300,seen:false},
  c:{type:'newplayer',name:'Y',ts:200,seen:true}
}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
let un=A.sandbox.noticeUnseen();
ok(un.length===2,'noticeUnseen: 2 unseen (1 seen filtered)');
ok(un[0].id==='b'&&un[1].id==='a','noticeUnseen sorted by ts desc');

// ===== noticeItemHtml per type =====
ok(/משתתף חדש/.test(A.sandbox.noticeItemHtml({type:'newplayer',name:'X'})),'newplayer item text');
ok(/יוסר.*מחר/.test(A.sandbox.noticeItemHtml({type:'idle_warn',name:'X',amount:50})),'idle_warn item text');
ok(/הוסר עקב 7/.test(A.sandbox.noticeItemHtml({type:'idle_removed',name:'X',amount:50})),'idle_removed item text');
ok(/שגיאת שרת/.test(A.sandbox.noticeItemHtml({type:'crit',reason:'boom'})),'crit item text');

// ===== checkNotices shows for owner =====
A.sandbox.checkNotices();
ok(A.sandbox._noticeOpen===true,'checkNotices: modal opened for admin');
ok(/מידע דחוף/.test(A.q('#nbox').innerHTML),'modal body has header');
ok(/fetch failed/.test(A.q('#nbox').innerHTML),'modal body lists crit notice');

A.sandbox.noticeDismiss(); await flush();
ok(A.sandbox._noticeOpen===false,'dismiss closes modal');
ok(A.state.tree.notices.a.seen===true&&A.state.tree.notices.b.seen===true,'dismiss marks notices seen in DB');

// non-owner: no modal
let B=loadApp({meta:{bank:100,cur:'\u20aa'},players:{other:{name:'דנה',feePaid:true,dep:100,t:1}},notices:{a:{type:'newplayer',name:'X',ts:100,seen:false}}});
B.sandbox.buildState(B.state.tree); B.sandbox.ME='other';
B.sandbox.checkNotices();
ok(B.sandbox._noticeOpen===false,'checkNotices: no modal for non-owner');

// ===== registerMe creates np_ notice =====
let C=loadApp({meta:{bank:100,cur:'\u20aa'},players:{}});
C.sandbox.buildState(C.state.tree);
C.q('#regN').value='רוני'; C.q('#regPw').value='abc';
C.sandbox.registerMe(); await flush();
let notices=C.state.tree.notices||{};
let npKeys=Object.keys(notices).filter(k=>k.indexOf('np_')===0);
ok(npKeys.length===1,'registerMe created one np_ notice');
ok(notices[npKeys[0]].type==='newplayer'&&notices[npKeys[0]].name==='רוני','notice = newplayer with name');
ok(notices[npKeys[0]].seen===false,'new notice unseen');

// ===== pPick stamps lastBet =====
let D=loadApp({meta:{bank:100,cur:'\u20aa',minBet:1},players:{p1:{name:'P',feePaid:true,dep:100,t:1}},matches:{m1:{teamA:'A',teamB:'B',settled:false,order:1,t:1}}});
D.sandbox.buildState(D.state.tree); D.sandbox.ME='p1';
D.sandbox.pPick('m1','A'); await flush();
ok((D.state.tree.players.p1.lastBet||0)>0,'pPick stamps player.lastBet');
ok(!!(D.state.tree.bets&&D.state.tree.bets.m1&&D.state.tree.bets.m1.p1),'pPick wrote the bet');

// ===== stats: idle7 exit reason + yellow balance =====
let E=loadApp({meta:{bank:100,cur:'\u20aa'},players:{
  ex:{name:'יצא',feePaid:true,dep:100,exited:true,exitedAt:1000,exitBal:73,exitReason:'idle7',t:1}
}},{hash:'ctrl7'});
E.sandbox.buildState(E.state.tree);
E.sandbox._statsPid='ex'; E.sandbox._statsTab='dep';
let h=E.sandbox.statsContentHtml();
ok(/7 ימי אי-פעילות/.test(h),'stats shows idle7 reason');
ok(/fff3a0/.test(h),'stats highlights return-balance yellow');
ok(/להחזיר 73/.test(h),'stats shows return amount 73');
let rep=E.sandbox.statsReport('ex');
ok(/7 ימי אי-פעילות/.test(rep)&&/להחזיר 73/.test(rep),'report includes idle7 reason + amount');

console.log((fail?'❌':'✅')+' noticetest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
