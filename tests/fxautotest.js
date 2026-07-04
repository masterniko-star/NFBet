// fxautotest.js — чекбокс «טעינת משחקים אוטומטית» на экране משחקים (админка).
// Проверяет: отрисовку по autocfg.newgames.on (включён/выключен/по умолчанию включён),
// fxAutoToggle пишет ТОЛЬКО {on} PATCH-ем в /autocfg/newgames (after/times/last сохраняются,
// results не трогается), чекбокс стоит в одном ряду с кнопкой «טעינת משחקים ידנית».
const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
const J=x=>JSON.stringify(x);

const seed={meta:{fee:100,bank:100,cur:'₪'},players:{},matches:{},bets:{},
  autocfg:{results:{on:true,after:[180],times:['08:00'],last:11},
           newgames:{on:true,after:[210],times:['20:00'],last:22}}};

(async()=>{
console.log('===== отрисовка чекбокса =====');
const A=loadApp(seed,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);
A.sandbox.renderAdminMatches();
let html=A.mainHTML();
ok(/id="fxAuto" checked onchange="fxAutoToggle\(this\.checked\)"/.test(html),'newgames.on=true -> чекбокс отмечен');
ok(html.indexOf('טעינת משחקים אוטומטית')>=0,'подпись טעינת משחקים אוטומטית на месте');
const iBtn=html.indexOf('fxLoadSelected()'),iChk=html.indexOf('id="fxAuto"');
ok(iBtn>=0&&iChk>iBtn&&html.slice(iBtn,iChk).indexOf('</div>')<0,'чекбокс в одном ряду с кнопкой טעינת משחקים ידנית');

console.log('===== fxAutoToggle(false): PATCH только on =====');
A.sandbox.fxAutoToggle(false);await flush(30);
const ng=A.state.tree.autocfg.newgames;
ok(ng.on===false,'on выключен');
ok(J(ng.after)===J([210])&&J(ng.times)===J(['20:00'])&&ng.last===22,'after/times/last сохранены (PATCH, не PUT)');
const rs=A.state.tree.autocfg.results;
ok(rs.on===true&&rs.last===11,'results не тронут');
A.sandbox.renderAdminMatches();html=A.mainHTML();
ok(/id="fxAuto" {2}onchange/.test(html),'после выключения чекбокс не отмечен');

console.log('===== fxAutoToggle(true): обратно =====');
A.sandbox.fxAutoToggle(true);await flush(30);
ok(A.state.tree.autocfg.newgames.on===true,'on включён обратно');
A.sandbox.renderAdminMatches();
ok(/id="fxAuto" checked/.test(A.mainHTML()),'чекбокс снова отмечен');

console.log('===== autocfg отсутствует -> по умолчанию включён =====');
const B=loadApp({meta:{fee:100,bank:100,cur:'₪'},players:{},matches:{},bets:{}},{hash:'ctrl7'});
B.sandbox.buildState(B.state.tree);B.sandbox.renderAdminMatches();
ok(/id="fxAuto" checked/.test(B.mainHTML()),'без autocfg чекбокс отмечен (выключает только on===false)');

console.log((fail?'❌':'✅')+' fxautotest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
