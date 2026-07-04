const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const has=(s,sub,m)=>ok(typeof s==='string'&&s.indexOf(sub)>=0,m);
const hasnt=(s,sub,m)=>ok(typeof s==='string'&&s.indexOf(sub)<0,m);
(async()=>{
console.log('===== DELETE / ARCHIVE LOGIC =====');
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},
  players:{p0:{name:'Alice',t:1},p1:{name:'Bob',t:2}},
  matches:{
    mUns:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:'',settled:false,winner:null},
    mSet:{round:'R32',order:1,t:2,teamA:'C',teamB:'D',dt:'',settled:true,winner:'A'}
  },
  bets:{mUns:{p0:{team:'A',stake:3}},mSet:{p0:{team:'A',stake:4},p1:{team:'B',stake:6}}}};

// delete UNSETTLED -> gone everywhere
let U=loadApp(seed,{});U.sandbox.buildState(U.state.tree);U.sandbox.MODE='admin';
U.sandbox.aDelMatch('mUns');await flush();
ok(!U.state.tree.matches.mUns,'unsettled del: match removed from DB');
ok(!U.state.tree.bets.mUns,'unsettled del: bets removed from DB');

// delete SETTLED -> archived (hidden), data kept
let A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);A.sandbox.MODE='admin';
A.sandbox.aDelMatch('mSet');await flush();
ok(!!A.state.tree.matches.mSet,'settled del: match data KEPT in DB');
ok(A.state.tree.matches.mSet.hidden===true,'settled del: marked hidden');
ok(!!A.state.tree.bets.mSet,'settled del: bets KEPT (for history)');

// after archive: admin matches list excludes it; history still shows it; balances still count it
A.sandbox.buildState(A.state.tree);
A.sandbox.MODE='admin';A.sandbox.TAB='matches';A.sandbox.renderActive();
hasnt(A.mainHTML(),'value="C"','admin list: archived match (team C) hidden from admin');
// history for p0 (bet on mSet team A, won) still shows it
A.sandbox.ME='p0';A.sandbox.MODE='player';A.sandbox.TAB='hist';A.sandbox.renderActive();
has(A.mainHTML(),'C','history: archived settled match still shown');
// balance reflects the win (p0 bet A stake4, pool 10, A wins sumA4 coef2.5 payout10 net+6 -> >100)
const bal=A.sandbox.statsFor('p0').balance;
ok(bal>100,'balance: archived settled win still counts ('+bal.toFixed(2)+')');

// fxLeague now carried through buildState (latent fix)
const ls={meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{},matches:{m1:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:'',settled:false,winner:null,fx:'espn9',fxLeague:'eng.1'}},bets:{}};
let L=loadApp(ls,{});L.sandbox.buildState(L.state.tree);
ok(L.sandbox.S.matches[0].fxLeague==='eng.1','buildState now carries fxLeague (was dropped before)');

// UI checks: section header removed, single dropdown field, sticky present, no count line
let V=loadApp(seed,{});V.sandbox.buildState(V.state.tree);V.sandbox.MODE='admin';V.sandbox.TAB='matches';V.sandbox.renderActive();
const h=V.mainHTML();
hasnt(h,'חושבו','admin: count line "חושבו" removed');
has(h,'בחר/י טורנירים','admin: tournament picker present');
has(h,'position:sticky','admin: search block is sticky');
console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
