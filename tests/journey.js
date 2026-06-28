const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;
function ok(c,m){tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);}
(async()=>{
console.log('===== F1. USER JOURNEY: join -> bet -> settle -> standings =====');
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},
  players:{p0:{name:'Existing',t:1}},
  matches:{m1:{round:'R32',order:0,t:1,teamA:'TeamA',teamB:'TeamB',dt:'',settled:false,winner:null}},
  bets:{m1:{p0:{team:'B',stake:4}}}};   // existing opponent pool on B
let J=loadApp(seed,{});J.sandbox.buildState(J.state.tree);
// simulate registration (fbSet a new player), then refresh
await J.sandbox.fbSet('/players/pNew',{name:'Newbie',pw:'x',feePaid:true,t:99});
await J.sandbox.refresh(); await flush();
ok(!!J.sandbox.S.players.find(p=>p.id==='pNew'),'journey: new player present after register+refresh');
// new player bets A
J.sandbox.ME='pNew';J.sandbox.TAB='bet';
J.sandbox.pPick('m1','A'); await flush();
ok(!!(J.state.tree.bets.m1&&J.state.tree.bets.m1.pNew&&J.state.tree.bets.m1.pNew.team==='A'),'journey: bet placed on A');
// admin settles A (pNew wins, takes from B pool)
J.sandbox.MODE='admin'; J.sandbox.aSettle('m1','A'); await flush();
J.sandbox.buildState(J.state.tree);
const st=J.sandbox.statsFor('pNew');
ok(J.state.tree.matches.m1.settled&&J.state.tree.matches.m1.winner==='A','journey: match settled A');
ok(st.balance>100,'journey: winner balance grew above bank ('+st.balance.toFixed(2)+')');
ok(st.correct===1,'journey: winner counted correct');
// existing p0 lost
ok(J.sandbox.statsFor('p0').balance<100,'journey: opponent balance dropped');
// conservation across the pair (+ any auto-bets)
let sum=0;J.sandbox.S.players.forEach(p=>sum+=J.sandbox.statsFor(p.id).balance);
ok(Math.abs(sum-J.sandbox.S.players.length*100)<1e-7,'journey: Σbalances == N*bank');

console.log('\n===== F2. renderActive natural routing =====');
function route(mode,me){const a=loadApp(seed,{});a.sandbox.buildState(a.state.tree);a.sandbox.MODE=mode;a.sandbox.ME=me;let e=null;try{a.sandbox.renderActive();}catch(x){e=x;}return {e,nav:a.q('#nav').innerHTML,main:a.mainHTML()};}
let r=route('player',null); ok(!r.e,'route: player+no-me no throw');
r=route('player','p0'); ok(!r.e && r.nav.indexOf('להמר')>=0,'route: player shows bet nav');
r=route('admin',null); ok(!r.e && r.nav.indexOf('משחקים')>=0,'route: admin shows matches nav');
r=route('admin',null); ok(r.nav.indexOf('טבלה')<0,'route: admin nav has NO טבלה tab');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));
process.exit(fails?1:0);
})();
