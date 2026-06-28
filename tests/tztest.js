// tztest.js — критический баг: на устройстве вне Израиля закрытие ставок (matchLocked) и
// "матч созрел для проверки" (matchMature) должны считаться по ИЗРАИЛЬСКОМУ времени матча,
// а не по локальной зоне устройства. Запускаем процесс в зоне Нью-Йорка (UTC-4/-5) и проверяем.
process.env.TZ='America/New_York';
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};

// форматирует момент (now+offMin) в израильское настенное время "YYYY-MM-DDTHH:MM" (как хранит приложение)
function ilFmt(offMin){
  const d=new Date(Date.now()+offMin*60000);
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
  const g=t=>p.find(x=>x.type===t).value;
  return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');
}

const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{});
const ML=A.sandbox.matchLocked, MM=A.sandbox.matchMature;

ok(Intl.DateTimeFormat().resolvedOptions().timeZone==='America/New_York','process TZ = New York (non-Israel device)');

// матч начался 90 мин назад по Израилю -> ставки ЗАКРЫТЫ (независимо от зоны устройства)
ok(ML({dt:ilFmt(-90)})===true,'kickoff 90min ago (Israel) -> LOCKED on a NY device');
// матч через 90 мин -> ставки открыты
ok(ML({dt:ilFmt(90)})===false,'kickoff in 90min (Israel) -> open');
// "созрел" (>3ч после старта)
ok(MM({dt:ilFmt(-240)})===true,'started 240min ago -> mature');
ok(MM({dt:ilFmt(-90)})===false,'started 90min ago -> not yet mature (<180)');

// КОНТРОЛЬ: наивный парс (как было до фикса) на NY-устройстве трактовал бы прошедший
// израильский старт как БУДУЩЕЕ -> ставки остались бы открыты после начала матча.
const naivePast=new Date(ilFmt(-90)).getTime();
ok(Date.now()<naivePast,'control: naive device-local parse WOULD wrongly treat a past Israel kickoff as future (bug the fix prevents)');

console.log((fail?'❌':'✅')+' tztest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
