// boardtietest.js — цвет имён на доске (לוח ההימורים) по живому счёту.
// Лидер по счёту -> ставившие на него зелёные (--pitch-d), остальные красные (--red).
// НИЧЬЯ в игре С ничьёй -> X зелёные, 1/2 красные. НИЧЬЯ в игре БЕЗ ничьи -> ВСЕ ЧЁРНЫЕ
// (нейтрально: исхода «ничья» не существует). Нет live / протухший live -> все чёрные.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
const now=Date.now();
function ilWall(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));const g=t=>p.find(x=>x.type===t).value;return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');}

function mkTree(drawOK,live,bets){
  return {meta:{fee:100,bank:100,cur:'₪'},
    players:{p1:{name:'Pa',feePaid:true,dep:100,t:1},p2:{name:'Pb',feePaid:true,dep:100,t:2},p3:{name:'Px',feePaid:true,dep:100,t:3}},
    matches:{m1:{teamA:'TA',teamB:'TB',order:1,settled:false,drawOK:drawOK,dt:ilWall(-30),fx:'e1',t:1}},
    bets:{m1:bets},
    live:live?{e1:live}:{}};
}
const A=loadApp(mkTree(false,null,{}),{});
function render(drawOK,live,bets){A.state.tree=mkTree(drawOK,live,bets);A.sandbox.buildState(A.state.tree);A.sandbox.renderBoardView();return A.mainHTML();}
const green=n=>new RegExp('class="bname" dir="rtl" style="color:var\\(--pitch-d\\)">'+n+'<');
const red=n=>new RegExp('class="bname" dir="rtl" style="color:var\\(--red\\)">'+n+'<');
const black=n=>new RegExp('class="bname" dir="rtl">'+n+'<');
const betsAB={p1:{team:'A',stake:5},p2:{team:'B',stake:5}};
const betsABX={p1:{team:'A',stake:5},p2:{team:'B',stake:5},p3:{team:'X',stake:5}};

console.log('===== лидер по счёту (2:1) =====');
let h=render(false,{st:'STATUS_SECOND_HALF',clk:"60'",a:2,b:1,ts:now},betsAB);
ok(green('Pa').test(h),'ставивший на лидера (A) зелёный');
ok(red('Pb').test(h),'ставивший на отстающего (B) красный');

console.log('===== ничья 1:1 в игре С ничьёй =====');
h=render(true,{st:'STATUS_SECOND_HALF',clk:"60'",a:1,b:1,ts:now},betsABX);
ok(green('Px').test(h),'ставивший на X зелёный');
ok(red('Pa').test(h)&&red('Pb').test(h),'ставившие на 1 и 2 красные');

console.log('===== ничья 1:1 в игре БЕЗ ничьи -> все чёрные =====');
h=render(false,{st:'STATUS_SECOND_HALF',clk:"60'",a:1,b:1,ts:now},betsAB);
ok(black('Pa').test(h)&&black('Pb').test(h),'при ничьей без опции X имена без цвета');
ok(!/bname" dir="rtl" style=/.test(h),'ни одного inline-цвета на именах');

console.log('===== нет live-данных / протухли -> все чёрные =====');
h=render(false,null,betsAB);
ok(black('Pa').test(h)&&black('Pb').test(h),'без live имена чёрные');
h=render(false,{st:'STATUS_SECOND_HALF',clk:"60'",a:2,b:1,ts:now-5*60000},betsAB);
ok(black('Pa').test(h)&&black('Pb').test(h),'live старше LIVE_TTL (4 мин) — имена чёрные');

console.log((fail?'❌':'✅')+' boardtietest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
