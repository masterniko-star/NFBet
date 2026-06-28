// betrowtest.js — строка прогноза/кассы (קופת פרס / אין יריבים — החזר) в карточке ставки
// должна РЕЗЕРВИРОВАТЬ место и без ставки, чтобы при появлении ставки экран не прыгал.
// Раньше она рендерилась только при наличии ставки -> layout shift (особенно на телефоне).
const {loadApp}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const now=Date.now();const dt=new Date(now+8*36e5).toISOString().slice(0,16); // матч в будущем -> ставки открыты
const KOPAT='\u05e7\u05d5\u05e4\u05ea \u05e4\u05e8\u05e1';   // קופת פרס
const NORIV='\u05d0\u05d9\u05df \u05d9\u05e8\u05d9\u05d1\u05d9\u05dd'; // אין יריבים

function mkSeed(withBet){return {meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
  players:{p1:{name:'Me',feePaid:true,dep:100,t:1}},
  matches:{m1:{round:'R32',order:0,t:1,teamA:'H',teamB:'A',dt:dt,settled:false,winner:null,drawOK:true}},
  bets: withBet?{m1:{p1:{team:'A',stake:3}}}:{}};}

function renderBet(withBet){
  const A=loadApp(mkSeed(withBet),{});
  A.sandbox.buildState(A.state.tree);
  A.sandbox.ME='p1';
  A.sandbox.TAB='bet';
  A.sandbox.renderActive();
  return A.mainHTML()||'';
}

console.log('===== bet-card prize row reserves space (no jump) =====');
const noBet=renderBet(false), withBet=renderBet(true);

// 1) контейнер строки присутствует в ОБОИХ состояниях
ok(noBet.indexOf('projrow')>=0 ,'projrow div rendered even WITHOUT a bet (space reserved)');
ok(withBet.indexOf('projrow')>=0,'projrow div rendered WITH a bet');

// 2) высота зарезервирована фиксированно -> оба состояния одинаковой высоты
ok(noBet.indexOf('min-height:20px')>=0 ,'reserved row has fixed min-height (no-bet)');
ok(withBet.indexOf('min-height:20px')>=0,'reserved row has fixed min-height (bet)');

// 3) контент вписывается ВНУТРЬ зарезервированной строки только при ставке
ok(noBet.indexOf(KOPAT)<0 && noBet.indexOf(NORIV)<0,'no-bet: row is blank (no prize text yet)');
ok(withBet.indexOf(KOPAT)>=0,'with-bet: prize text fills into the reserved row');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
