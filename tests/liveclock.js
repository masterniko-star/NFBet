// liveclock.js — реальное время матча из ESPN (/live). Сервер пишет /live/{fx}={clk,per,st,ts};
// клиент показывает живую минуту/«מחצית»/«הסתיים» когда данные свежие (моложе LIVE_TTL),
// иначе fallback на расчётный секундомер (gameclk). buildState привязывает live к матчу по fx.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};
const S=loadApp({meta:{}},{}).sandbox;

// --- liveLabel: статусы (перерыв/конец) — статичный текст, секунды НЕ докручиваем (live:false) ---
const hl=S.liveLabel({st:'STATUS_HALFTIME',clk:"45'+4'"});
ok(hl.html==='מחצית'&&hl.live===false,'HALFTIME → מחצית, без докрута');
ok(S.liveLabel({st:'STATUS_HALFTIME',clk:''}).color.indexOf('pitch')>=0,'перерыв — зелёный (pitch)');
ok(S.liveLabel({st:'STATUS_FULL_TIME',clk:"90'"}).html==='הסתיים','FULL_TIME → הסתיים');
ok(S.liveLabel({st:'STATUS_SHOOTOUT',clk:''}).html==='פנדלים','SHOOTOUT → פנדלים');
ok(hl.html.indexOf('זמן משחק')<0,'перерыв: подписи «זמן משחק» нет');

// --- liveLabel: идёт игра → «минута:секунды» + подпись «זמן משחק» (live:true), секунды докручиваются локально ---
const now0=1700000000000;
const li=S.liveLabel({st:'STATUS_FIRST_HALF',clk:"23'",ts:now0},now0);
ok(li.html.indexOf('23:00')>=0&&li.color.indexOf('red')>=0&&li.live===true,'идёт игра → 23:00 красным (live)');
ok(li.html.indexOf('זמן משחק')>=0,'под игровым временем подпись «זמן משחק»');
const li5=S.liveLabel({st:'STATUS_FIRST_HALF',clk:"23'",ts:now0},now0+5000);
ok(li5.html.indexOf('23:05')>=0,'докрут секунд: +5с → 23:05');
const li59=S.liveLabel({st:'STATUS_FIRST_HALF',clk:"23'",ts:now0},now0+90000);
ok(li59.html.indexOf('23:59')>=0,'докрут секунд ограничен 59 (ждём следующую минуту от ESPN)');
const li2=S.liveLabel({st:'STATUS_SECOND_HALF',clk:"90'+6'",ts:now0},now0);
ok(li2.html.indexOf('90+6:00')>=0,'добавленное время в минуте (90+6:00)');

// --- liveClockHtml: свежесть и fallback ---
const dt='2020-01-01T22:00';
const freshM={dt:dt,settled:false,live:{st:'STATUS_FIRST_HALF',clk:"30'",ts:Date.now()}};
const fh=S.liveClockHtml(freshM,'');
ok(/class="liveclk"/.test(fh)&&fh.indexOf('30:')>=0,'свежий live → liveclk с минутой 30:SS');
ok(/data-clk=/.test(fh)&&/data-ts=/.test(fh)&&/data-st=/.test(fh),'liveclk: data-атрибуты для живого тика секунд');
ok(fh.indexOf('זמן משחק')>=0,'свежий live (идёт) → подпись «זמן משחק» под временем');
const oldM={dt:dt,settled:false,live:{st:'STATUS_FIRST_HALF',clk:"30'",ts:Date.now()-10*60000}};
ok(/class="gameclk"/.test(S.liveClockHtml(oldM,'')),'устаревший live (10 мин) → fallback gameclk');
const noM={dt:dt,settled:false,live:null};
ok(/class="gameclk"/.test(S.liveClockHtml(noM,'')),'нет live → fallback gameclk');
const settledM={dt:dt,settled:true,live:{st:'STATUS_FIRST_HALF',clk:"30'",ts:Date.now()}};
ok(/class="gameclk"/.test(S.liveClockHtml(settledM,'')),'сведённый матч → fallback (не live)');

// --- buildState: live привязан к матчу по fx; доска показывает реальное время ---
const A=loadApp({meta:{fee:100,bank:100,cur:'₪'},players:{},
  matches:{m1:{teamA:'Brazil',teamB:'Japan',round:'R32',order:1,settled:false,drawOK:false,dt:dt,fx:'espn1',t:1}},
  bets:{},live:{espn1:{st:'STATUS_HALFTIME',clk:"45'+4'",per:1,ts:Date.now()}}},{});
A.sandbox.buildState(A.state.tree);
const mm=A.sandbox.S.matches.find(function(x){return x.id==='m1';});
ok(mm&&mm.live&&mm.live.st==='STATUS_HALFTIME','buildState: live привязан к матчу по fx (espn1)');
A.sandbox.renderBoardView();
const bh=A.mainHTML()||'';
ok(/class="liveclk"/.test(bh)&&bh.indexOf('מחצית')>=0,'доска: live-перерыв показан как מחצית');
ok(bh.indexOf('class="gameclk"')<0,'доска: при свежем live расчётный секундомер не используется');

// доска: идущая игра → минута:секунды + «זמן משחק»
const B=loadApp({meta:{fee:100,bank:100,cur:'₪'},players:{},
  matches:{m1:{teamA:'Brazil',teamB:'Japan',round:'R32',order:1,settled:false,drawOK:false,dt:dt,fx:'espn1',t:1}},
  bets:{},live:{espn1:{st:'STATUS_SECOND_HALF',clk:"67'",per:2,ts:Date.now()}}},{});
B.sandbox.buildState(B.state.tree);B.sandbox.renderBoardView();
const bh2=B.mainHTML()||'';
ok(/class="liveclk"/.test(bh2)&&bh2.indexOf('67:')>=0&&bh2.indexOf('זמן משחק')>=0,'доска: идёт игра → 67:SS + זמן משחק');

console.log((fail?'❌':'✅')+' liveclock: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
