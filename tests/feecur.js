// feecur.js — нормализация валюты-очки → ₪ (фикс данных очкового режима) + ИНВАРИАНТ галочки שולם.
const {loadApp,flush}=require('./applib.js');
let tests=0,fails=0; const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
(async()=>{
  const points='\u05e0\u05e7\u05f3'; // נק׳
  const ld=(cur)=>{const m={bank:100};if(cur!==undefined)m.cur=cur;const A=loadApp({meta:m,players:{},matches:{},bets:{}});A.sandbox.buildState(A.state.tree);return A.sandbox;};
  ok(ld(points).cur()==='\u20aa','валюта-очки נק׳ нормализуется в ₪');
  ok(ld(points).S.meta.cur==='\u20aa','  meta.cur стал ₪');
  ok(ld(undefined).cur()==='\u20aa','отсутствующая валюта → ₪');
  ok(ld('').cur()==='\u20aa','пустая валюта → ₪');
  ok(ld('$').cur()==='$','легитимная валюта $ сохраняется');
  ok(ld('\u20aa').cur()==='\u20aa','₪ остаётся ₪');

  // --- ИНВАРИАНТ галочки שולם: только feePaid этого игрока + касса; ничего больше ---
  const seed={meta:{bank:100,fee:100,cur:points},players:{niko:{name:'N',t:1},amir:{name:'A',t:2}},matches:{m1:{teamA:'A',teamB:'B',round:'R32',t:1}},bets:{m1:{niko:{team:'A',stake:5},amir:{team:'B',stake:3}}}};
  const B=loadApp(seed); const S=B.sandbox; S.buildState(seed); S.MODE='admin';
  const cur0=S.cur(), amir0=(B.state.tree.players.amir||{}).feePaid, bets0=JSON.stringify(B.state.tree.bets), nb0=S.statsFor('niko').balance, ab0=S.statsFor('amir').balance;
  B.q('#bf-niko').value='100';
  S.aToggleFee('niko'); await flush(120); S.buildState(B.state.tree);
  ok(B.state.tree.players.niko.feePaid===true,'клик ON: niko.feePaid=true');
  ok((B.state.tree.players.amir||{}).feePaid===amir0,'  feePaid amir НЕ изменился');
  ok(S.cur()===cur0,'  валюта НЕ изменилась');
  ok(JSON.stringify(B.state.tree.bets)===bets0,'  ставки НЕ изменились');
  ok(S.statsFor('niko').balance===nb0&&S.statsFor('amir').balance===ab0,'  балансы НЕ изменились');
  ok(S.S.players.filter(p=>p.feePaid).length*100===100,'  касса учла 1 оплату (×fee)');
  S.aToggleFee('niko'); await flush(120); S.buildState(B.state.tree);
  ok(!B.state.tree.players.niko.feePaid,'клик OFF: niko снова не оплачено');
  ok(S.S.players.filter(p=>p.feePaid).length===0,'  касса вернулась к 0 оплат');

  // --- ГЕЙТ מצב דמו: неоплативший НЕ может ставить, оплативший — может ---
  const gseed={meta:{bank:100,fee:100,cur:'\u20aa'},players:{u:{name:'U',feePaid:false,t:1}},matches:{g1:{teamA:'A',teamB:'B',round:'R32',t:1}},bets:{}};
  const G=loadApp(gseed); const GS=G.sandbox; GS.buildState(gseed); GS.ME='u';
  const betOf=()=>{var t=G.state.tree.bets;return t&&t.g1&&t.g1.u;};
  GS.pPick('g1','A'); await flush(120);
  ok(!betOf(),'неоплаченный игрок (מצב דמו): ставка ЗАБЛОКИРОВАНА — нет записи в дереве');
  G.state.tree.players.u.feePaid=true; GS.buildState(G.state.tree); GS.ME='u';
  GS.pPick('g1','A'); await flush(120);
  ok(!!betOf(),'после отметки שולם: ставка ПРОШЛА — запись появилась');
  ok(betOf()&&betOf().team==='A','  записан верный исход (A)');

  // --- БЕЙДЖ «מצב דמו» в РЕНДЕРЕ: таблица (טבלה) + экран ставок (להמר) ---
  const DEMO='\u05de\u05e6\u05d1 \u05d3\u05de\u05d5'; // מצב דמו
  const mkAll=(paid)=>{const s={meta:{bank:100,cur:'\u20aa'},players:{u:{name:'Uri',feePaid:paid,t:1}},matches:{},bets:{}};const X=loadApp(s);X.sandbox.buildState(s);X.sandbox.renderAllView();return X.mainHTML();};
  ok(/class="unpaidName">Uri<\/span>/.test(mkAll(false)),'таблица: имя неоплатившего подсвечено жёлтым (unpaidName)');
  ok(!/class="unpaidName"/.test(mkAll(true)),'  оплативший — без подсветки');
  ok(mkAll(false).indexOf(DEMO)<0,'  бейджа מצב דמו в таблице больше нет');
  ok(!/class="unpaid"/.test(mkAll(false))&&!/class="dmc"/.test(mkAll(false)),'  класс-бейдж .unpaid и колонка .dmc убраны');
  const mkBet=(paid)=>{const s={meta:{bank:100,cur:'\u20aa'},players:{u:{name:'Uri',feePaid:paid,t:1}},matches:{},bets:{}};const X=loadApp(s);X.sandbox.buildState(s);X.sandbox.ME='u';X.sandbox.MODE='player';X.sandbox.TAB='bet';X.sandbox.renderHeader();return X.q('#hTitle').innerHTML;};
  ok(mkBet(false).indexOf(DEMO)>=0,'шапка להמר: неоплативший видит бейдж מצב דמו в строке имя+יתרה');
  ok(mkBet(false).indexOf('#fde047')>=0,'  бейдж на жёлтой подложке #fde047');
  ok(mkBet(true).indexOf(DEMO)<0,'  оплативший — БЕЗ бейджа в шапке');

  if(fails)console.log('feecur FAILED '+fails+'/'+tests);
  else console.log('\u2705 feecur: '+tests+' passed, 0 failed');
})().catch(e=>{console.log('FAIL uncaught',e);process.exit(1);});
