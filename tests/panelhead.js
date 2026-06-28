// panelhead.js — складные «полки» в настройках: заголовок и стрелка в верхней строке
// (top-align длинных названий), а статус/инфо — отдельной строкой НИЖЕ (от начала строки,
// с переносом), вместо обрезанной строки сбоку. Проверяется структура panelCard.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};

const A=loadApp({meta:{}},{});
A.sandbox.panelOpen={};

const withStatus=A.sandbox.panelCard('k1','כותרת ארוכה מאוד של פאנל',"מופעל · 180 ד' · 8:00,08:30,09:00,21:00",'גוף');
ok(/class="panel-top"/.test(withStatus),'есть верхний ряд .panel-top (заголовок+стрелка)');
ok(/class="panel-chev"/.test(withStatus),'стрелка в .panel-chev (верхний ряд)');
ok(/class="panel-status"><span class="tiny muted">מופעל/.test(withStatus),'статус — в отдельной строке .panel-status');
ok(withStatus.indexOf('panel-status')>withStatus.indexOf('panel-top'),'статус расположен НИЖЕ верхнего ряда');
ok(!/class="panel-r"/.test(withStatus),'старый .panel-r убран');

const noStatus=A.sandbox.panelCard('k2','כותרת','','גוף');
ok(!/class="panel-status"/.test(noStatus),'без статуса строки .panel-status нет');
ok(/class="panel-top"/.test(noStatus),'без статуса .panel-top всё равно есть');

console.log((fail?'❌':'✅')+' panelhead: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
