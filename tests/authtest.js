// authtest.js — пароли (login/смена/сброс), гейт админки, список админов,
// стоп-регистрация, запрет дублей имён, алфавитная сортировка, сброс жёлтого возврата (task 8),
// отключение авто-newgames при איפוס (task 7, клиентская сторона).
const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
const SA='ניקולאי פלדמן'; // ניקולאי פלדמן

(async()=>{

// ===== pwHash / pwOk =====
{
  let A=loadApp({meta:{bank:100},players:{p1:{name:'דנה',pw:'1234',feePaid:true,dep:100}}},{});
  A.sandbox.buildState(A.state.tree);
  ok(A.sandbox.pwHash('abc')===A.sandbox.pwHash('abc'),'pwHash deterministic');
  ok(A.sandbox.pwHash('abc')!==A.sandbox.pwHash('abd'),'pwHash differs by input');
  let p=A.sandbox.pById2('p1');
  ok(A.sandbox.pwOk(p,'1234'),'pwOk: legacy plaintext match');
  ok(!A.sandbox.pwOk(p,'xxxx'),'pwOk: wrong rejected');
}

// ===== login enforces password + migrates legacy pw -> pwh =====
{
  let A=loadApp({meta:{bank:100},players:{p1:{name:'דנה',pw:'1234',feePaid:true,dep:100}}},{});
  A.sandbox.buildState(A.state.tree);
  A.q('#logN').value='דנה';A.q('#logPw').value='wrong';
  A.sandbox.loginMe();await flush();
  ok(A.sandbox.ME!=='p1','wrong password rejected (not logged in)');
  A.q('#logN').value='דנה';A.q('#logPw').value='1234';
  A.sandbox.loginMe();await flush();
  ok(A.sandbox.ME==='p1','correct password logs in');
  let pl=await A.sandbox.fbGet('/players/p1');
  ok(pl&&pl.pwh&&pl.pw==null,'legacy pw migrated to pwh (plaintext cleared)');
}

// ===== first login (no password yet) sets it =====
{
  let A=loadApp({meta:{bank:100},players:{p1:{name:'דנה',feePaid:true,dep:100}}},{});
  A.sandbox.buildState(A.state.tree);
  A.q('#logN').value='דנה';A.q('#logPw').value='newpass';
  A.sandbox.loginMe();await flush();
  ok(A.sandbox.ME==='p1','first login (no pw) logs in');
  let pl=await A.sandbox.fbGet('/players/p1');
  ok(pl&&pl.pwh===A.sandbox.pwHash('newpass'),'first login stored pwh');
}

// ===== admin gate: lock OFF -> open; lock ON + not authed -> login form =====
{
  let A=loadApp({meta:{bank:100,adminLock:false},players:{p1:{name:'דנה',t:1}}},{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);A.sandbox.TAB='players';A.sandbox.renderActive();
  ok(A.q('#main').innerHTML.indexOf('הדבק רשימה')>=0,'lock OFF -> admin UI open');

  let B=loadApp({meta:{bank:100,adminLock:true},players:{p1:{name:'דנה',t:1}}},{hash:'ctrl7'});
  B.sandbox.buildState(B.state.tree);B.sandbox.renderActive();
  let mh=B.q('#main').innerHTML;
  ok(mh.indexOf('כניסת ניהול')>=0&&mh.indexOf('הדבק רשימה')<0,'lock ON + not authed -> admin login (no admin UI)');
}

// ===== adminLogin: super-admin ok, non-admin & wrong-pw rejected =====
{
  let A=loadApp({meta:{bank:100,adminLock:true},players:{nk:{name:SA,pw:'pass1',t:1},p2:{name:'דנה',pw:'x',t:2}}},{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);
  A.q('#admN').value='דנה';A.q('#admPw').value='x';
  A.sandbox.adminLogin();await flush();
  ok(!A.sandbox.adminAuthed(),'non-admin name rejected at admin login');
  A.q('#admN').value=SA;A.q('#admPw').value='pass1';
  A.sandbox.adminLogin();await flush();
  ok(A.sandbox.ADMIN_ME==='nk'&&A.sandbox.adminAuthed(),'super-admin logs into admin');

  let B=loadApp({meta:{bank:100,adminLock:true},players:{nk:{name:SA,pw:'pass1',t:1}}},{hash:'ctrl7'});
  B.sandbox.buildState(B.state.tree);
  B.q('#admN').value=SA;B.q('#admPw').value='nope';
  B.sandbox.adminLogin();await flush();
  ok(!B.sandbox.adminAuthed(),'super-admin wrong password rejected');
}

// ===== add / remove admin; super-admin un-removable =====
{
  let A=loadApp({meta:{bank:100,admins:[]},players:{nk:{name:SA,t:1},p2:{name:'דנה',t:2}}},{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);
  A.q('#admAddSel').value='p2';
  A.sandbox.aAddAdmin();await flush();
  ok((A.state.tree.meta.admins||[]).indexOf('דנה')>=0,'admin added to meta.admins');
  ok(A.sandbox.isAdminName('דנה'),'isAdminName true after add');
  A.sandbox.aRemoveAdmin(encodeURIComponent('דנה'));await flush();
  ok((A.state.tree.meta.admins||[]).indexOf('דנה')<0,'admin removed from meta.admins');
  A.sandbox.aRemoveAdmin(encodeURIComponent(SA));await flush();
  ok(A.sandbox.isAdminName(SA),'super-admin still admin (un-removable)');
  ok(A.sandbox.isSuperAdmin(SA)&&!A.sandbox.isSuperAdmin('דנה'),'isSuperAdmin only for Niko');
}

// ===== regClosed blocks registerMe but login still works =====
{
  let A=loadApp({meta:{bank:100,regClosed:true},players:{p1:{name:'דנה',pw:'1234',feePaid:true,dep:100}}},{});
  A.sandbox.buildState(A.state.tree);
  A.q('#regN').value='חדש';A.q('#regPw').value='abc';
  A.sandbox.registerMe();await flush();
  let names=Object.keys(A.state.tree.players).map(k=>A.state.tree.players[k].name);
  ok(names.indexOf('חדש')<0,'regClosed: registerMe blocked');
  A.q('#logN').value='דנה';A.q('#logPw').value='1234';
  A.sandbox.loginMe();await flush();
  ok(A.sandbox.ME==='p1','regClosed: existing player can still log in');
}

// ===== duplicate name prevention =====
{
  let A=loadApp({meta:{bank:100},players:{p1:{name:'דנה',t:1}}},{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);
  ok(A.sandbox.nameTaken('דנה'),'nameTaken exact');
  ok(A.sandbox.nameTaken('  דנה  '),'nameTaken trims whitespace');
  ok(!A.sandbox.nameTaken('דנה','p1'),'nameTaken excludes self id');
  A.q('#np').value='דנה';
  A.sandbox.aCommitPlayer();await flush();
  ok(Object.keys(A.state.tree.players).length===1,'aCommitPlayer blocks duplicate name');
  A.q('#regN').value='דנה';A.q('#regPw').value='abc';
  A.sandbox.registerMe();await flush();
  ok(Object.keys(A.state.tree.players).length===1,'registerMe blocks duplicate name');
}

// ===== admin players sort: unpaid on top (alphabetical), paid at bottom (alphabetical) =====
{
  let A=loadApp({meta:{bank:100},players:{
    paidZ:{name:'תמר',feePaid:true,dep:100,t:1},
    paidA:{name:'בני',feePaid:true,dep:100,t:2},
    unpZ:{name:'דנה',feePaid:false,t:3},
    unpA:{name:'אבי',feePaid:false,t:4}}},{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);A.sandbox.TAB='players';A.sandbox.renderActive();
  let h=A.q('#main').innerHTML;
  let iUnpA=h.indexOf('אבי'),iUnpZ=h.indexOf('דנה'),iPaidA=h.indexOf('בני'),iPaidZ=h.indexOf('תמר');
  ok(iUnpA<iUnpZ,'unpaid block alphabetical (אבי<דנה)');
  ok(iUnpZ<iPaidA,'ALL unpaid above ALL paid (unpaid דנה before paid בני, despite alphabet)');
  ok(iPaidA<iPaidZ,'paid block alphabetical (בני<תמר)');
}

// ===== player changes own password =====
{
  let A=loadApp({meta:{bank:100},players:{p1:{name:'דנה',pw:'1234',feePaid:true,dep:100}}},{});
  A.sandbox.buildState(A.state.tree);A.sandbox.ME='p1';
  A.q('#myOldPw').value='1234';A.q('#myNewPw').value='5678';A.q('#myNewPw2').value='5678';
  A.sandbox.changeMyPw();await flush();
  let pl=await A.sandbox.fbGet('/players/p1');
  ok(pl&&pl.pwh===A.sandbox.pwHash('5678')&&pl.pw==null,'player changed password (pwh updated, legacy cleared)');
  A.q('#myOldPw').value='bad';A.q('#myNewPw').value='9999';A.q('#myNewPw2').value='9999';
  A.sandbox.changeMyPw();await flush();
  let pl2=await A.sandbox.fbGet('/players/p1');
  ok(pl2.pwh===A.sandbox.pwHash('5678'),'wrong current password -> change rejected');
  A.q('#myOldPw').value=A.sandbox.S.players.find(x=>x.id==='p1')?'5678':'5678';A.q('#myNewPw').value='1';A.q('#myNewPw2').value='2';
  A.sandbox.changeMyPw();await flush();
  let pl3=await A.sandbox.fbGet('/players/p1');
  ok(pl3.pwh===A.sandbox.pwHash('5678'),'mismatched confirm -> change rejected');
}

// ===== admin resets a player's password =====
{
  let A=loadApp({meta:{bank:100},players:{p1:{name:'דנה',pwh:'hZZZ',feePaid:true,dep:100}}},{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);A.sandbox.confirm=function(){return true;};
  A.sandbox.aResetPlayerPw('p1');await flush();
  let pl=await A.sandbox.fbGet('/players/p1');
  ok(pl&&pl.pwh==null&&pl.pw==null,'admin reset clears player password (next login sets new)');
}

// ===== task 8: dismiss yellow refund marker =====
{
  let A=loadApp({meta:{bank:100},players:{
    a:{name:'אבי',feePaid:false,dep:0,resetBal:40,resetAt:200},
    x:{name:'גיל',exited:true,exitBal:60,exitedAt:300,exitReason:'idle7'}}},{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);A.sandbox.confirm=function(){return true;};
  ok(A.sandbox.resetList().length===2,'refund list has 2 before dismiss');
  // החזר button: есть возвраты -> жёлтая + имена + лейбл "החזר"
  var rb=A.sandbox.refundBtnHtml();
  ok(rb.indexOf('>החזר<')>=0,'refund button labeled "החזר"');
  ok(rb.indexOf('#fff3a0')>=0,'refund button YELLOW when refunds exist');
  ok(rb.indexOf('אבי')>=0&&rb.indexOf('גיל')>=0,'refund button lists names to refund');
  ok(rb.indexOf('id="refundNames"')>=0,'refund button has names grid (columns/rows)');
  A.sandbox.dismissReset('a','reset');await flush();
  let pa=await A.sandbox.fbGet('/players/a');
  ok(pa&&pa.resetBal==null&&pa.resetAt==null,'dismiss reset clears resetBal/resetAt');
  A.sandbox.buildState(A.state.tree);
  ok(A.sandbox.resetList().length===1,'refund list shrinks to 1');
  A.sandbox.dismissReset('x','exit');await flush();
  let px=await A.sandbox.fbGet('/players/x');
  ok(px&&px.exitBal==null,'dismiss exit clears exitBal');
  A.sandbox.buildState(A.state.tree);
  ok(A.sandbox.resetList().length===0,'refund list empty after both dismissed');
  // החזר button: нет возвратов -> белая + "אין החזרים"
  var rb2=A.sandbox.refundBtnHtml();
  ok(rb2.indexOf('#ffffff')>=0&&rb2.indexOf('#fff3a0')<0,'refund button WHITE when no refunds');
  ok(rb2.indexOf('אין החזרים')>=0,'refund button shows "אין החזרים" when empty');
}

// ===== task 7 (client): איפוס disables auto-newgames + wipes matches =====
{
  let A=loadApp({meta:{bank:100},players:{p1:{name:'דנה',pw:'1',feePaid:true,dep:100}},
    matches:{m1:{teamA:'A',teamB:'B',settled:false}},bets:{},
    autocfg:{results:{on:true,after:[180],times:[]},newgames:{on:true,after:[210],times:['08:00','20:00']}}},{hash:'ctrl7'});
  A.sandbox.buildState(A.state.tree);A.sandbox.confirm=function(){return true;};
  A.sandbox._rkeep={p1:false};
  A.sandbox.aResetDo();await flush();
  let ac=await A.sandbox.fbGet('/autocfg');
  ok(ac&&ac.newgames&&ac.newgames.on===false,'reset: auto-newgames turned OFF (no resurrection)');
  ok(ac&&ac.newgames&&ac.newgames.last>0,'reset: newgames.last stamped (no immediate time-trigger)');
  ok(ac&&ac.newgames&&Array.isArray(ac.newgames.times)&&ac.newgames.times.length===2,'reset: newgames schedule preserved for later re-enable');
  let mt=await A.sandbox.fbGet('/matches');
  ok(!mt||Object.keys(mt).length===0,'reset: matches wiped');
}

console.log((fail?'❌':'✅')+' authtest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
