// gamescore.js — счёт матча рядом с часами на доске (לוח ההימורים).
// Показываем ТОЛЬКО реальный счёт из ESPN-live (a/b), пока данные свежие (≤ LIVE_TTL = 4 мин).
// До первых реальных данных — ничего (никаких 0:0). Пропадание ≤4 мин — держим последний счёт; дольше — убираем.
// a = teamA (домашняя, слева), b = teamB (гостевая, справа), всегда красный.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};
const S=loadApp({meta:{}},{}).sandbox;
const now=Date.now();
function ilWall(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));const g=t=>p.find(x=>x.type===t).value;return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');}

// 1) ДО реальных данных (нет live) — НИЧЕГО, даже в окне обратного отсчёта
ok(S.liveScoreHtml({dt:ilWall(30),settled:false,live:null},'')==='','до игры без live-данных: счёта нет (никаких 0:0)');
// 2) старт уже прошёл, но реальных данных ещё нет — всё равно НИЧЕГО
ok(S.liveScoreHtml({dt:ilWall(-5),settled:false,live:null},'')==='','игра идёт, но live-данных нет: счёта нет');

// 3) свежий live-счёт 2:1 -> 2:1 красным
const lh=S.liveScoreHtml({dt:ilWall(-30),settled:false,live:{st:'STATUS_SECOND_HALF',clk:"67'",a:2,b:1,ts:now}},'');
ok(/class="livescore"/.test(lh)&&lh.indexOf('2:1')>=0&&lh.indexOf('red')>=0,'свежий live: реальный счёт 2:1 красным');
ok(/data-ts="/.test(lh),'счёт несёт data-ts (для скрытия при протухании)');

// 4) свежий live 0:0 в начале игры (реальные данные) -> 0:0 показываем
ok(S.liveScoreHtml({dt:ilWall(-2),settled:false,live:{st:'STATUS_FIRST_HALF',clk:"2'",a:0,b:0,ts:now}},'').indexOf('0:0')>=0,'свежий live 0:0 (реальные данные старта) — показываем');

// 5) короткое пропадание (≤4 мин) -> держим последний счёт
ok(S.liveScoreHtml({dt:ilWall(-30),settled:false,live:{st:'STATUS_SECOND_HALF',clk:"67'",a:2,b:1,ts:now-3*60000}},'').indexOf('2:1')>=0,'пропадание 3 мин (≤4): последний счёт 2:1 ещё показан');

// 6) долгое пропадание (>4 мин) -> НИЧЕГО
ok(S.liveScoreHtml({dt:ilWall(-30),settled:false,live:{st:'STATUS_SECOND_HALF',clk:"67'",a:2,b:1,ts:now-5*60000}},'')==='','пропадание 5 мин (>4): счёт убран');

// 7) частичный счёт (b отсутствует) -> показываем, недостающее = 0
ok(S.liveScoreHtml({dt:ilWall(-30),settled:false,live:{st:'STATUS_FIRST_HALF',clk:"10'",a:2,ts:now}},'').indexOf('2:0')>=0,'есть только a=2 -> 2:0');

// 8) сведённый матч -> НИЧЕГО
ok(S.liveScoreHtml({dt:ilWall(-30),settled:true,live:{a:2,b:1,ts:now}},'')==='','сведённый матч: счёта нет');

// 9) доска: при свежем live счёт показан рядом с часами
const A=loadApp({meta:{fee:100,bank:100,cur:'₪'},players:{},
  matches:{m1:{teamA:'Netherlands',teamB:'Morocco',round:'R32',order:1,settled:false,drawOK:false,dt:ilWall(-30),fx:'espn1',t:1}},
  bets:{},live:{espn1:{st:'STATUS_SECOND_HALF',clk:"67'",a:1,b:0,ts:now}}},{});
A.sandbox.buildState(A.state.tree);A.sandbox.renderBoardView();
const bh=A.mainHTML()||'';
ok(/class="livescore"/.test(bh)&&bh.indexOf('1:0')>=0,'доска: счёт 1:0 показан');
ok(/class="liveclk"/.test(bh),'доска: часы тоже на месте (счёт рядом с часами)');

// 10) доска: до реальных данных (нет live) счёта НЕТ
const B=loadApp({meta:{fee:100,bank:100,cur:'₪'},players:{},
  matches:{m1:{teamA:'Netherlands',teamB:'Morocco',round:'R32',order:1,settled:false,drawOK:false,dt:ilWall(20),fx:'espn1',t:1}},bets:{}},{});
B.sandbox.buildState(B.state.tree);B.sandbox.renderBoardView();
ok((B.mainHTML()||'').indexOf('livescore')<0,'доска: без live-данных счёта нет (никаких 0:0)');

console.log((fail?'❌':'✅')+' gamescore: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
