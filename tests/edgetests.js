const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;
function ok(c,m){tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);}
const now=Date.now();
const dtL=off=>{const d=new Date(now+off);const p=n=>(n<10?'0':'')+n;return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());};
function comp(home,away,hs,as,hw,aw){return {competitions:[{id:'c',competitors:[
  {id:'h',homeAway:'home',winner:hw,score:hs,team:{id:'1',displayName:home,abbreviation:home.slice(0,3),logo:'x.png'}},
  {id:'a',homeAway:'away',winner:aw,score:as,team:{id:'2',displayName:away,abbreviation:away.slice(0,3),logo:'y.png'}}]}]};}
function evt(id,state,completed,o){return Object.assign({id:id,uid:'s:1~e:'+id,date:new Date(now).toISOString(),season:{year:2026},name:o.name||'M',status:{type:{id:'1',state:state,completed:completed,description:state}}},comp(o.home,o.away,o.hs,o.as,o.hw,o.aw));}

(async()=>{
console.log('===== C. ESPN AUTO-FILL (realistic, end-to-end real aFillResults) =====');
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},
  players:{p0:{name:'A',t:1},p1:{name:'B',t:2}},
  matches:{
    mh:{round:'R32',order:0,t:1,teamA:'Home1',teamB:'Away1',dt:dtL(-3*36e5),settled:false,winner:null,fx:'espn100',fxLeague:'fifa.world'},
    ma:{round:'R32',order:1,t:2,teamA:'Home2',teamB:'Away2',dt:dtL(-3*36e5),settled:false,winner:null,fx:'espn101',fxLeague:'fifa.world'},
    min:{round:'R32',order:2,t:3,teamA:'Home3',teamB:'Away3',dt:dtL(-1*36e5),settled:false,winner:null,fx:'espn102',fxLeague:'fifa.world'},
    mpre:{round:'R32',order:3,t:4,teamA:'Home4',teamB:'Away4',dt:dtL(5*36e5),settled:false,winner:null,fx:'espn103',fxLeague:'fifa.world'},
    mman:{round:'R32',order:4,t:5,teamA:'ManualA',teamB:'ManualB',dt:dtL(-3*36e5),settled:false,winner:null}, // no fx -> must be skipped
    mdone:{round:'R32',order:5,t:6,teamA:'Home6',teamB:'Away6',dt:dtL(-9*36e5),settled:true,winner:'A',fx:'espn105',fxLeague:'fifa.world'}, // already settled
    mold:{round:'R32',order:6,t:7,teamA:'Home7',teamB:'Away7',dt:dtL(-3*36e5),settled:false,winner:null,fx:'espn106'} // NO fxLeague (old data) -> fallback fifa.world
  },
  bets:{mh:{p0:{team:'A',stake:3}},ma:{p1:{team:'B',stake:4}},mman:{p0:{team:'A',stake:2}},mold:{p0:{team:'A',stake:5}}}};
const espn={events:[
  evt('100','post',true,{home:'Home1',away:'Away1',hs:'2',as:'0',hw:true,aw:false}),   // home win -> A
  evt('101','post',true,{home:'Home2',away:'Away2',hs:'1',as:'3',hw:false,aw:true}),    // away win -> B
  evt('102','in',false,{home:'Home3',away:'Away3',hs:'1',as:'1',hw:false,aw:false}),    // in progress -> skip
  evt('103','pre',false,{home:'Home4',away:'Away4',hs:'',as:'',hw:false,aw:false}),     // not started -> skip
  evt('106','post',true,{home:'Home7',away:'Away7',hs:'0',as:'2',hw:false,aw:true})     // away win -> B (old, no fxLeague)
]};
let F=loadApp(seed,{espn}); F.sandbox.buildState(F.state.tree); F.sandbox.MODE='admin';
F.sandbox.aFillResults(); await flush(80);
const T=F.state.tree.matches;
ok(T.mh.settled&&T.mh.winner==='A','ESPN home-win -> settled A');
ok(T.ma.settled&&T.ma.winner==='B','ESPN away-win -> settled B');
ok(!T.min.settled,'ESPN in-progress -> left unsettled');
ok(!T.mpre.settled,'ESPN pre -> left unsettled');
ok(!T.mman.settled,'manual match (no fx) -> NOT touched');
ok(T.mdone.settled&&T.mdone.winner==='A','already-settled -> unchanged');
ok(T.mold.settled&&T.mold.winner==='B','old match w/o fxLeague -> resolved via fifa.world fallback');
// idempotency: snapshot, run again, compare
const snap=JSON.stringify(F.state.tree.matches);
F.sandbox.buildState(F.state.tree); F.sandbox.aFillResults(); await flush(80);
ok(JSON.stringify(F.state.tree.matches)===snap,'fillResults idempotent (2nd press = no change)');

console.log('\n===== D. ADVERSARIAL / EDGE =====');
// matchLocked boundaries
const ml=loadApp({},{}).sandbox.matchLocked;
ok(ml({dt:dtL(-1000)})===true,'lock: 1s after start = locked');
ok(ml({dt:dtL(60000)})===false,'lock: 1m before start = open');
ok(ml({dt:''})===false,'lock: empty dt = open');
ok(ml({dt:'garbage'})===false,'lock: malformed dt = open');
ok(ml({})===false,'lock: missing dt = open');

// pStep / pStake guards on a locked match
const lk={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},players:{p0:{name:'A',t:1}},
  matches:{mlk:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:dtL(-36e5),settled:false,winner:null}},bets:{mlk:{p0:{team:'A',stake:3}}}};
let G=loadApp(lk,{});G.sandbox.buildState(G.state.tree);G.sandbox.ME='p0';G.sandbox.TAB='bet';
const b4=JSON.stringify(G.state.tree.bets.mlk);
G.sandbox.pStep('mlk',1); await flush(); G.sandbox.pStake('mlk',8); await flush();
ok(JSON.stringify(G.state.tree.bets.mlk)===b4,'lock: pStep/pStake on started match did NOT change stake');

// confirm=false blocks destructive ops
let X=loadApp(lk,{confirm:false});X.sandbox.buildState(X.state.tree);X.sandbox.ME='p0';
X.sandbox.closeMyAccount(); await flush();
ok(!!X.state.tree.players.p0,'closeAccount with confirm=NO -> player kept');

// auto-bet skipped when availFor < 1
const ab={meta:{fee:100,bank:2,minBet:1,maxBet:10,cur:'₪'},
  players:{p0:{name:'A',t:1},pBroke:{name:'Broke',t:2}},
  matches:{
    mA:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:'',settled:false,winner:null},
    mOther:{round:'R32',order:1,t:2,teamA:'C',teamB:'D',dt:'',settled:false,winner:null}},
  bets:{mA:{p0:{team:'A',stake:1}},mOther:{pBroke:{team:'A',stake:2}}}}; // pBroke used full bank(2) elsewhere
let H=loadApp(ab,{});H.sandbox.buildState(H.state.tree);H.sandbox.MODE='admin';
H.sandbox.aSettle('mA','A'); await flush();
ok(!(H.state.tree.bets.mA.pBroke),'auto-bet: broke player (avail<1) gets NO auto-bet');
ok(!!(H.state.tree.bets.mA.p0&&!H.state.tree.bets.mA.p0.auto),'auto-bet: actual bettor p0 unchanged');

// betLockSignature transitions when a match crosses start
let S2=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{p0:{name:'A',t:1}},
  matches:{mx:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:dtL(-1000),settled:false,winner:null}},bets:{}},{});
S2.sandbox.buildState(S2.state.tree);
const sigLocked=S2.sandbox.betLockSignature();
ok(/mx L/.test(sigLocked.replace('mxL','mx L'))||/L/.test(sigLocked),'lockSignature marks started match as L');

// board with zero bets renders without throw
let Z=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{p0:{name:'A',t:1}},
  matches:{mz:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:'',settled:false,winner:null}},bets:{}},{});
Z.sandbox.buildState(Z.state.tree);Z.sandbox.ME='p0';Z.sandbox.MODE='player';Z.sandbox.TAB='board';
let zerr=null;try{Z.sandbox.renderActive();}catch(e){zerr=e;}
ok(!zerr,'board with zero bets renders no throw'+(zerr?' ['+zerr+']':''));

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));
process.exit(fails?1:0);
})();
