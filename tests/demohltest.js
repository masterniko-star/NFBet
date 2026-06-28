// demohltest.js — подсветка имени демо-участника жёлтым в таблице (renderAllView),
// ТОЛЬКО для админа/владельца (פלדמן). Оплаченные — без подсветки. Не-владелец — без подсветки.
// Смена статуса на оплаченного убирает подсветку (условие demo=!feePaid -> false при перерисовке).
const {loadApp}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const ADMIN='\u05e0\u05d9\u05e7\u05d5\u05dc\u05d0\u05d9 \u05e4\u05dc\u05d3\u05de\u05df'; // ניקולאי פלדמן
const DEMO='\u05d5\u05d9\u05e7\u05d8\u05d5\u05e8';   // ויקטור (демо)
const PAID='\u05d3\u05d9\u05de\u05d4';               // דימה (оплачен)

function seed(){return {meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
  players:{adm:{name:ADMIN,feePaid:true,dep:100,t:1},
           dm:{name:DEMO,feePaid:false,t:2},
           pd:{name:PAID,feePaid:true,dep:100,t:3}},
  matches:{},bets:{}};}

function render(meId){
  const A=loadApp(seed(),{});
  A.sandbox.buildState(A.state.tree);
  A.sandbox.ME=meId;
  A.sandbox.renderAllView();
  return A.mainHTML()||'';
}

console.log('===== admin/owner view: demo name highlighted =====');
const adminHtml=render('adm');
const demoHi=(adminHtml.match(/class="unpaidName"/g)||[]).length;
ok(demoHi===1,'ровно один демо-игрок подсвечен (unpaidName ×'+demoHi+')');
// подсветка обёрнута вокруг ИМЕНИ демо-игрока
ok(/class="unpaidName">\u05d5\u05d9\u05e7\u05d8\u05d5\u05e8</.test(adminHtml),'подсвечено именно имя демо (ויקטור)');
// оплаченные НЕ подсвечены
ok(adminHtml.indexOf('unpaidName">\u05d3\u05de\u05d4')<0 && adminHtml.indexOf('unpaidName">\u05d3\u05d9\u05de\u05d4')<0,'оплаченный (דימה) НЕ подсвечен');
ok(adminHtml.indexOf('unpaidName">'+ADMIN)<0,'админ (оплачен) НЕ подсвечен');
// бейдж מצב דמו в проекции владельца СНЯТ (демо обозначен жёлтой подсветкой имени)
ok(adminHtml.indexOf('\u05de\u05e6\u05d1 \u05d3\u05de\u05d5')<0,'у владельца бейдж מצב דמו НЕ показывается');

console.log('\n===== non-owner view: no highlight, badge stays =====');
const playerHtml=render('dm'); // смотрит обычный игрок (сам демо) -> own=false
ok((playerHtml.match(/class="unpaidName"/g)||[]).length===0,'у не-владельца подсветки нет вообще');
ok(playerHtml.indexOf('\u05de\u05e6\u05d1 \u05d3\u05de\u05d5')>=0,'бейдж מצב דמו виден обычному участнику (как раньше)');

console.log('\n===== status change removes highlight =====');
// тот же владелец, но демо-игрок теперь оплачен -> подсветки быть не должно
const A=loadApp(seed(),{});A.state.tree.players.dm.feePaid=true;
A.sandbox.buildState(A.state.tree);A.sandbox.ME='adm';A.sandbox.renderAllView();
const afterPaid=A.mainHTML()||'';
ok((afterPaid.match(/class="unpaidName"/g)||[]).length===0,'после смены статуса на оплаченного подсветка снята');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
