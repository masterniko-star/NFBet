// boardalign.js — карточка матча на доске (renderBoardView): названия разнесены к КРАЯМ
// (.mstack по краям, justify-self start/end), касса центрирована ПОД каждым названием
// (внутри того же .mstack, align-items:center); номер приклеен к первому слову (.nw),
// двусловные названия разбиты на 2 строки (<br>); длинное слово ужимается шрифтом
// (fitTitles — визуально на телефоне).
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
// двусловное название: первое слово (с номером) и второе — на ДВУХ строках (<br>), каждое в .nw
ok(/class="nw"><span class="tdot">1<\/span>South<\/span><br><span class="nw">Africa<\/span>/.test(html),'teamTitle: «① South» / «Africa» — два слова на двух строках');
ok(/class="nw"><span class="tdot">2<\/span>Canada<\/span>/.test(html),'единое слово: «② Canada» целиком в .nw, без переноса');
// касса под названием — внутри того же .mstack
ok(/<div class="mstack"[^>]*>[\s\S]*?class="mtitle"[\s\S]*?קופה[\s\S]*?<\/div>\s*<\/div>/.test(html),'касса под названием в том же блоке (.mstack)');
ok(html.indexOf('תיקו')>=0,'ничья (drawOK): касса תיקו в среднем блоке');

// сортировка таблицы ставок по колонке ניחוש: 1 (A) → X → 2 (B)
const C=loadApp({meta:{fee:100,bank:100,cur:'₪'},
  players:{p1:{name:'Bbet',feePaid:true,dep:100,t:1},p2:{name:'Abet',feePaid:true,dep:100,t:2},p3:{name:'Xbet',feePaid:true,dep:100,t:3}},
  matches:{m1:{teamA:'A',teamB:'B',round:'R32',order:1,settled:false,drawOK:true,dt:'2020-01-01T22:00',t:1}},
  bets:{m1:{p1:{team:'B',stake:5},p2:{team:'A',stake:5},p3:{team:'X',stake:5}}}},{});
C.sandbox.buildState(C.state.tree);C.sandbox.renderBoardView();
const ch=C.mainHTML()||'';
const i1=ch.indexOf('bpick num">1<'),iX=ch.indexOf('bpick num">X<'),i2=ch.indexOf('bpick num">2<'); // позиции ячеек ниחуш по порядку строк
ok(i1>=0&&iX>=0&&i2>=0&&i1<iX&&iX<i2,'строки отсортированы по ניחוש: 1 → X → 2');

console.log((fail?'❌':'✅')+' boardalign: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
