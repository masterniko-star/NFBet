// gameclock.js — живые часы матча: ⏳ обратный отсчёт (за час до старта) →
// ⏱ красный секундомер с начала игры → «הסתיים» (красный) когда игра окончена.
// На לוח ההימורים дефис убран, часы на островке; в להמר часы в строке ההימור נסגר.
const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};
const S=loadApp({meta:{}},{}).sandbox;
const start=1700000000000;

// --- состояния часов (детерминированно по now) ---
ok(S.gameClockState(start,false,start-90*60000).html==='','>1ч до старта → пусто (часы не показаны)');
const cd=S.gameClockState(start,false,start-5*60000);
ok(/⏳ 05:00/.test(cd.html),'за 5 мин → ⏳ 05:00 (обратный отсчёт)');
ok(cd.color.indexOf('pitch')>=0,'обратный отсчёт — зелёный (pitch)');
ok(/⏳ 59:59/.test(S.gameClockState(start,false,start-(59*60000+59000)).html),'за ~час → ⏳ 59:59');
const run=S.gameClockState(start,false,start+47*60000+23000);
ok(/⏱ 47:23/.test(run.html),'через 47:23 → ⏱ секундомер');
ok(run.color.indexOf('red')>=0,'идущая игра → красный');
const ov=S.gameClockState(start,false,start+200*60000);
ok(ov.html==='הסתיים'&&ov.color.indexOf('red')>=0,'после длительности → «הסתיים» красный (доска)');
ok(S.gameClockState(start,false,start+200*60000,'המשחק הסתיים').html==='המשחק הסתיים','over с кастомной надписью (להמר)');
ok(S.gameClockState(start,true,start+5*60000).html==='הסתיים','settled → «הסתיים» сразу');
ok(S.gameClockState(start,false,start).html.indexOf('⏱ 00:00')>=0,'в момент старта → ⏱ 00:00');

// --- gameClockHtml: span с data + переданный размер ---
const html=S.gameClockHtml({dt:'2020-01-01T22:00'},'font-size:12px');
ok(/class="gameclk"/.test(html)&&/data-start=/.test(html)&&/data-settled=/.test(html),'gameClockHtml: span.gameclk c data-атрибутами');
ok(/font-size:12px/.test(html),'gameClockHtml: размер прокинут');
ok(S.gameClockHtml({},'')==='','без dt → пустая строка');
ok(typeof S.tickClocks==='function','tickClocks существует');
try{S.tickClocks();ok(true,'tickClocks не падает без элементов');}catch(e){ok(false,'tickClocks упал');}

// --- доска: дефиса нет, часы на островке ---
const B=loadApp({meta:{fee:100,bank:100,cur:'₪'},players:{},
  matches:{m1:{teamA:'South Africa',teamB:'Canada',round:'R32',order:1,settled:false,drawOK:false,dt:'2020-01-01T22:00',t:1}},bets:{}},{});
B.sandbox.buildState(B.state.tree);B.sandbox.renderBoardView();
const bh=B.mainHTML()||'';
ok(bh.indexOf('class="gameclk"')>=0,'доска: часы (gameclk) на островке');
ok(!/>-<\/div>/.test(bh),'доска: дефиса между названиями нет');

// --- bet view: часы в строке ההימור נסגר ---
(async()=>{
  const C=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{me:{name:'Me',feePaid:true,dep:100,t:1}},
    matches:{m1:{teamA:'A',teamB:'B',round:'R32',order:1,settled:false,winner:null,drawOK:false,dt:'2020-01-01T22:00',t:1}},bets:{}},{});
  C.sandbox.ME='me';C.sandbox.MODE='play';C.sandbox.refresh();await flush();
  C.sandbox.renderBetView();
  const ch=C.mainHTML()||'';
  ok(ch.indexOf('המשחק הסתיים')>=0,'bet: окончена → «המשחק הסתיים»');
  ok(ch.indexOf('🔒 ההימור נסגר')<0,'bet: при окончании замок-бейдж «🔒 ההימור נסגר» НЕ показывается');
  ok(/data-over="המשחק הסתיים"/.test(ch),'bet: data-over проставлен (живой тик сохранит надпись)');
  ok(ch.indexOf('class="gameclk"')>=0,'bet: часы (gameclk) присутствуют');
  console.log((fail?'❌':'✅')+' gameclock: '+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
