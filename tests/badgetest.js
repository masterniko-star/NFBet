const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
(async()=>{
let A=loadApp({meta:{bank:100},players:{
  u:{name:'עמרי גרינברג',feePaid:false,dep:0},
  p:{name:'דנה לוי',feePaid:true,dep:100},
  lng:{name:'abcdefghijklmnopqrstuvwxyz',feePaid:true,dep:100}}},{hash:''});
A.sandbox.buildState(A.state.tree);
A.sandbox.ME='p';A.sandbox.TAB='all';
A.sandbox.renderAllView();
let html=A.q('#main').innerHTML;
ok(/class="nmtxt"[^>]*><span class="unpaidName">עמרי גרינברג<\/span>/.test(html),'имя демо подсвечено жёлтым (unpaidName) в ячейке имени');
ok(html.indexOf('מצב דמו')<0,'бейджа מצב דמו больше нет');
ok(!/class="dmc"/.test(html)&&!/class="unpaid"/.test(html),'колонка .dmc и класс-бейдж .unpaid убраны');
ok(!/<br>/.test(html),'names on ONE line (no <br> split)');
ok((html.match(/class="unpaidName"/g)||[]).length===1,'ровно один демо подсвечен (только неоплативший)');
ok(html.indexOf('abcdefghijklmnopqr…')>=0,'длинное имя обрезано до 18 + …');
ok(html.indexOf('abcdefghijklmnopqrs')<0,'19-й символ длинного имени НЕ показан (лимит 18)');
console.log((fail?'❌':'✅')+' badgetest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
