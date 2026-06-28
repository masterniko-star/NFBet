const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const now=Date.now();
(async()=>{
console.log('===== back-compat (client): buildState ignores legacy strat/astake/fav =====');
const seed={meta:{bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
  autocfg:{enabled:true,times:['03:00','21:00']},                 // old shape, no add35 key
  players:{p0:{name:'A',feePaid:true,strat:'strong',astake:9},p1:{name:'B',feePaid:true},p2:{name:'C',feePaid:true}},
  matches:{m1:{round:'R32',order:0,t:1,teamA:'H',teamB:'A',dt:new Date(now+8*36e5).toISOString().slice(0,16),settled:false,winner:null,fav:'B'}},
  bets:{m1:{p0:{team:'A',stake:3}}}};
const A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);
const S=A.sandbox.S;
ok(S.players[0].strat===undefined&&S.players[0].astake===undefined,'client drops legacy player.strat/astake');
ok(S.matches[0].fav===undefined,'client drops legacy match.fav');
ok(JSON.stringify(S.autocfg.newgames.after)===JSON.stringify([210]),'add35 absent -> newgames.after=[210] (3.5h ON by default)');
ok(JSON.stringify(S.autocfg.newgames.times)===JSON.stringify(['03:00','21:00']),'existing times preserved in newgames.times');
// auto-fill must target home A, not stale fav='B'
A.sandbox.autoBetFill('m1');await flush(60);
const mb=A.state.tree.bets.m1||{};
const autos=Object.keys(mb).filter(k=>mb[k].auto);
ok(autos.length===2,'2 non-bettors auto-filled (p1,p2): '+autos.length);
ok(autos.every(k=>mb[k].team==='A'&&mb[k].stake===1),'auto-fill ₪1 on A — stale fav=B ignored');
ok(mb.p0&&mb.p0.team==='A'&&!mb.p0.auto,'p0 manual bet untouched');
console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
