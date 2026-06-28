// boardalign.js — в «לוח ההימורים» (renderBoardView) названия команд при разной
// высоте (1 vs 2 строки) выравниваются по ВЕРХНЕЙ строке, а кассы (קופה) — отдельной
// нижней строкой остаются на одном уровне. Реализовано двухстрочным grid'ом.
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

ok(html.indexOf('South Africa')>=0&&html.indexOf('Canada')>=0,'обе команды отрисованы');
ok(/align-items:start/.test(html),'ряд названий выровнен по ВЕРХУ (align-items:start)');
ok(!/align-items:end/.test(html),'нет старого align-items:end (регрессия)');
ok(/grid-row:1;grid-column:1/.test(html)&&/grid-row:1;grid-column:3/.test(html),'названия команд — в строке 1 (верх)');
ok(/grid-row:2;grid-column:1/.test(html)&&/grid-row:2;grid-column:3/.test(html),'кассы (קופה) — в строке 2 (один уровень)');
// у матча с ничьёй касса תיקו — в средней колонке нижней строки
ok(/grid-row:2;grid-column:2/.test(html),'תיקו (ничья) — строка 2, средняя колонка');

console.log((fail?'❌':'✅')+' boardalign: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
