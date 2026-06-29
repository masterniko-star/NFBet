// boardalign.js — карточка матча на доске (renderBoardView): названия разнесены к КРАЯМ
// (.mstack по краям, justify-self start/end), касса центрирована ПОД каждым названием
// (внутри того же .mstack, align-items:center); номер приклеен к первому слову (.nw),
// длинное неразбиваемое имя ужимается шрифтом (fitTitles — визуально на телефоне).
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};

const A=loadApp({meta:{fee:100,bank:100,cur:'₪'},players:{},
  matches:{
    m1:{teamA:'South Africa',teamB:'Canada',round:'R32',order:1,settled:false,drawOK:false,t:1},
    m2:{teamA:'Brazil',teamB:'Japan',round:'R32',order:2,settled:false,drawOK:true,t:2}
  },bets:{}},{});
A.sandbox.buildState(A.state.tree);
A.sandbox.renderBoardView();
const html=A.mainHTML()||'';

ok(html.indexOf('Canada')>=0&&html.indexOf('Japan')>=0,'команды отрисованы');
ok(/class="mstack"[^>]*grid-column:1[^>]*justify-self:start/.test(html),'блок A разнесён к левому краю (.mstack justify-self:start)');
ok(/class="mstack"[^>]*grid-column:3[^>]*justify-self:end/.test(html),'блок B разнесён к правому краю (.mstack justify-self:end)');
ok(/align-items:start/.test(html),'названия выровнены по верхней строке');
ok(!/align-items:end/.test(html),'нет старого align-items:end');
// номер приклеен к первому слову (.nw); остальные слова — отдельно (могут перенестись)
ok(/class="nw"><span class="tdot">1<\/span>South<\/span> Africa/.test(html),'teamTitle: «① South» неразрывно (.nw), «Africa» отдельно');
ok(/class="nw"><span class="tdot">2<\/span>Canada<\/span>/.test(html),'единое слово: «② Canada» целиком в .nw');
// касса под названием — внутри того же .mstack
ok(/<div class="mstack"[^>]*>[\s\S]*?class="mtitle"[\s\S]*?קופה[\s\S]*?<\/div>\s*<\/div>/.test(html),'касса под названием в том же блоке (.mstack)');
ok(html.indexOf('תיקו')>=0,'ничья (drawOK): касса תיקו в среднем блоке');

console.log((fail?'❌':'✅')+' boardalign: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
