// ===== seentest — participant entry (/seen) tracking =====
const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('  \x1b[31mFAIL: '+m+'\x1b[0m');}else console.log('  ok   '+m);};
const baseMeta={fee:100,bank:100,minBet:1,maxBet:10,cur:'\u20aa'};

(async()=>{
console.log('===== markEntry writes /seen =====');
{
  const A=loadApp({meta:baseMeta,players:{p1:{name:'Dan',t:1}},matches:{},bets:{}},{});
  A.sandbox.buildState(A.state.tree); A.sandbox.ME='p1';
  A.sandbox.markEntry(); await flush(50);
  const sv=(A.state.tree.seen||{}).p1;
  ok(sv&&sv.c===1,'markEntry writes /seen/{id} with c=1');
  ok(sv&&sv.t>0,'/seen entry carries a timestamp');
}

console.log('\n===== once-per-session (no double count) =====');
{
  const A=loadApp({meta:baseMeta,players:{p1:{name:'Dan',t:1}},matches:{},bets:{}},{});
  A.sandbox.buildState(A.state.tree); A.sandbox.ME='p1';
  A.sandbox.markEntry(); await flush(30); A.sandbox.markEntry(); await flush(30);
  ok((A.state.tree.seen||{}).p1.c===1,'markEntry idempotent within a session (c stays 1)');
}

console.log('\n===== THE BUG: placing a bet marks participant entered =====');
{
  const now=Date.now();const dt=new Date(now+5*36e5).toISOString().slice(0,16);
  const A=loadApp({meta:baseMeta,players:{p1:{name:'Dan',feePaid:true,t:1}},
    matches:{m1:{round:'R32',order:0,settled:false,teamA:'A',teamB:'B',dt:dt}},bets:{}},{});
  A.sandbox.buildState(A.state.tree); A.sandbox.ME='p1'; A.sandbox.MODE='player';
  ok(!(A.state.tree.seen||{}).p1,'precondition: p1 has NO /seen before betting (red)');
  A.sandbox.pPick('m1','A'); await flush(70);
  ok((A.state.tree.bets.m1||{}).p1&&A.state.tree.bets.m1.p1.team==='A','bet recorded in /bets');
  ok((A.state.tree.seen||{}).p1&&A.state.tree.seen.p1.c>=1,'FIX: betting writes /seen \u2192 participant turns green');
}

console.log('\n===== a second participant betting also gets /seen =====');
{
  const now=Date.now();const dt=new Date(now+5*36e5).toISOString().slice(0,16);
  const A=loadApp({meta:baseMeta,players:{p1:{name:'A',t:1},p2:{name:'B',feePaid:true,t:2}},
    matches:{m1:{round:'R32',order:0,settled:false,teamA:'A',teamB:'B',dt:dt}},bets:{}},{});
  A.sandbox.buildState(A.state.tree); A.sandbox.ME='p2'; A.sandbox.MODE='player';
  A.sandbox.pPick('m1','B'); await flush(60);
  ok((A.state.tree.seen||{}).p2&&!(A.state.tree.seen||{}).p1,'only the betting participant (p2) is marked entered, not p1');
}

console.log('\n'+(fails?('\x1b[31mFAILED '+fails+'/'+tests+'\x1b[0m'):('\x1b[32mALL PASS '+tests+'/'+tests+'\x1b[0m')));
process.exit(fails?1:0);
})();
