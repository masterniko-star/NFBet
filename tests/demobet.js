// demobet.js (client) — ЗАКОН ДЕНЕГ: авто-ставка ставится ТОЛЬКО оплатившим игрокам
// с реальными деньгами. Демо (feePaid:false) — НИКОГДА, включая случай, когда у демо-игрока
// остался ненулевой dep (после "ביטול שולם"). Выбывшие — тоже никогда. В минус — никогда.
const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const now=Date.now();
const pastDt=new Date(now-4*36e5).toISOString().slice(0,16); // матч начался 4ч назад

const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
  players:{
    paid :{name:'Paid',     feePaid:true,  dep:100, t:1}, // оплатил -> доступен авто-ставке
    winB :{name:'WinB',     feePaid:true,  dep:100, t:5}, // ставит на победителя B -> касса не пустая
    demo :{name:'Demo',     feePaid:false,          t:2}, // демо, dep=null -> депозит 0
    rdemo:{name:'ResetDemo', feePaid:false, dep:5,   t:3}, // демо, но остался dep=5 (после сброса)
    gone :{name:'Gone',     feePaid:true,  dep:100, exited:true, t:4} // выбыл
  },
  matches:{
    m1:{round:'R32',order:0,t:1,teamA:'H1',teamB:'A1',dt:pastDt,settled:false,winner:null,fx:'espn1',fxLeague:'fifa.world',drawOK:false}
  },
  bets:{m1:{winB:{team:'B',stake:1,t:1}}}};

(async()=>{
console.log('===== AUTO-BET money law: demo/exited excluded =====');
let A=loadApp(seed,{});
A.sandbox.buildState(A.state.tree);
A.sandbox.autoBetFill('m1');
await flush(60);
const b=(A.state.tree.bets&&A.state.tree.bets.m1)||{};

ok(b.paid&&b.paid.auto===true&&b.paid.stake===1,'paid player IS auto-filled (1\u20aa)');
ok(!b.demo ,'demo player (dep=null) NOT auto-filled');
ok(!b.rdemo,'reset-demo with leftover dep=5 NOT auto-filled (feePaid gate)');
ok(!b.gone ,'exited player NOT auto-filled');

console.log('\n===== settle as LOSS (winner=B): demo balances never go negative =====');
// разводим результат: A проигрывает -> авто-ставка на A теряется. Демо не должны иметь ставки -> баланс 0.
A.sandbox.aSettle('m1','B');
await flush(80);
const stPaid =A.sandbox.statsFor('paid');
const stDemo =A.sandbox.statsFor('demo');
const stRdemo=A.sandbox.statsFor('rdemo');
ok(stPaid.balance>=99-1e-9 && stPaid.balance<=99+1e-9,'paid: lost 1\u20aa auto-bet on A -> 99 (got '+stPaid.balance+')');
ok(stDemo.balance>=0-1e-9 ,'demo: balance not negative (got '+stDemo.balance+')');
ok(stRdemo.balance>=0-1e-9,'reset-demo: balance not negative (got '+stRdemo.balance+')');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
