// lockedholdtest.js — ЗАКОН ДЕНЕГ: после закрытия ставок (matchLocked) НИКАКИХ записей ставки,
// включая отпускание долгого нажатия ▲/▼ (pHold/pHoldEnd -> pStepCommit).
// Баг был: матч стартовал, пока палец на кнопке, отпускание записывало новую сумму в БД.
const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
const now=Date.now();
function ilWall(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));const g=t=>p.find(x=>x.type===t).value;return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');}

const seed={meta:{fee:100,bank:100,minBet:1,maxBet:50,cur:'₪'},
  players:{p1:{name:'P',feePaid:true,dep:100,t:1}},
  matches:{m1:{teamA:'TA',teamB:'TB',order:1,settled:false,drawOK:false,dt:ilWall(30),t:1}},
  bets:{m1:{p1:{team:'A',stake:5}}}};

(async()=>{
const A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);A.sandbox.ME='p1';
const M=()=>A.sandbox.S.matches.find(x=>x.id==='m1'); // refresh после записи пересобирает S -> матч брать заново

// легитимный путь: матч открыт, нажатие+отпускание -> одна запись нового значения
A.sandbox.pHold(null,'m1',1);
ok(A.sandbox.stakeOf.m1===6,'pHold на открытом матче: локальный шаг 5->6');
A.sandbox.pHoldEnd();await flush(30);
ok(A.state.tree.bets.m1.p1.stake===6,'отпускание на открытом матче записывает 6 в БД');

// одиночный pStep на закрытом матче -> без записи
A.state.tree.matches.m1.dt=ilWall(-10);A.sandbox.buildState(A.state.tree);
ok(A.sandbox.matchLocked(M())===true,'матч стартовал -> matchLocked');
A.sandbox.pStep('m1',1);await flush(30);
ok(A.state.tree.bets.m1.p1.stake===6,'pStep на закрытом матче не пишет');

// БАГ-СЦЕНАРИЙ: нажатие до старта, старт во время удержания, отпускание после
A.state.tree.matches.m1.dt=ilWall(30);A.sandbox.buildState(A.state.tree);
A.sandbox.pHold(null,'m1',1);                 // палец лёг: локальный шаг вверх
ok(A.sandbox.stakeOf.m1===7,'pHold до старта: локально 7');
M().dt=ilWall(-1);                            // свисток во время удержания (мутируем живой S)
A.sandbox.pHoldEnd();await flush(30);          // палец отпущен после закрытия
ok(A.state.tree.bets.m1.p1.stake===6,'отпускание ПОСЛЕ закрытия ставок НЕ пишет в БД (осталось 6)');

// и разгон (pHoldTick) при закрытии тоже не дописывает
A.state.tree.matches.m1.dt=ilWall(30);A.sandbox.buildState(A.state.tree);
A.sandbox.pHold(null,'m1',1);
M().dt=ilWall(-1);
A.sandbox.pHoldTick('m1',1,40);               // тик разгона упирается в lock
A.sandbox.pHoldEnd();await flush(30);
ok(A.state.tree.bets.m1.p1.stake===6,'разгон, прерванный закрытием, не пишет в БД');

console.log((fail?'❌':'✅')+' lockedholdtest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
