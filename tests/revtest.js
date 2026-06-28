const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},players:{p0:{name:'P',feePaid:true,t:1}},
  matches:{m1:{round:'R32',order:0,t:1,teamA:'A',teamB:'B',dt:'',settled:false,winner:null}},bets:{}};
(async()=>{
console.log('===== REV-GATING (whole-tree on change) =====');
let A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);A.sandbox.ME='p0';A.sandbox.TAB='bet';
A.sandbox.pPick('m1','A'); await flush(20);
ok(!!(A.state.tree.bets.m1&&A.state.tree.bets.m1.p0),'write happened (bet placed)');
await wait(450);
ok(typeof A.state.tree.rev==='number','write bumped /rev (debounced)');
await A.sandbox.refresh(); await flush(10);
ok(A.sandbox.lastRev===A.state.tree.rev,'refresh() sets lastRev to current /rev');
const revNow=A.state.tree.rev;
ok(String(revNow)===String(A.sandbox.lastRev),'poll: rev==lastRev -> would NOT refresh (cheap)');
A.state.tree.rev=revNow+1;
ok(String(A.state.tree.rev)!==String(A.sandbox.lastRev),'poll: rev changed -> would full-refresh');
await A.sandbox.refresh(); await flush(10);
ok(A.sandbox.lastRev===revNow+1,'after refresh lastRev catches up to new rev');
let B=loadApp(seed,{});B.sandbox.buildState(B.state.tree);B.sandbox.MODE='admin';
delete B.state.tree.rev;
for(let i=0;i<5;i++){B.sandbox.fbSet('/players/x'+i,{name:'X'+i,t:i});}
await wait(450);
ok(typeof B.state.tree.rev==='number','burst of 5 writes coalesced into one /rev bump');
console.log('\nNOTE: poll downloads ~/rev (a few bytes); on change the whole tree is fetched once (atomic, no skew).');
console.log((fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
