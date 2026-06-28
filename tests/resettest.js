const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}

(async()=>{
// player with saved session (ME), paid, with an open bet; plus an exited player
let A=loadApp({meta:{bank:100},
  players:{p1:{name:'דנה',pw:'1234',feePaid:true,dep:100},
           gone:{name:'יוסי',pw:'9999',feePaid:true,dep:100,exited:true,exitBal:80,exitReason:'manual'}},
  matches:{m1:{teamA:'A',teamB:'B',settled:false}},
  bets:{m1:{p1:{team:'A',stake:5}}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
A.sandbox.confirm=function(){return true;};
A.sandbox._rkeep={p1:false};            // organizer chose to zero balances
A.sandbox.aResetDo();
await flush();

let pl=await A.sandbox.fbGet("/players");
ok(pl&&pl.p1,'reset: active player still in /players');
ok(pl&&pl.p1&&pl.p1.pw==='1234','reset: password preserved (auto-login keeps working)');
ok(pl&&pl.p1&&pl.p1.exited!==true,'reset: active player stays active');

let mt=await A.sandbox.fbGet("/matches");
ok(!mt||Object.keys(mt).length===0,'reset: matches wiped');
let bt=await A.sandbox.fbGet("/bets");
ok(!bt||Object.keys(bt).length===0,'reset: bets/results wiped');

// auto-login after reset: device remembers ME=p1 -> me() resolves with NO password
A.sandbox.ME='p1';
ok(A.sandbox.me()&&A.sandbox.me().id==='p1','reset: player auto-logs-in via saved ME (no password)');

// exited player: confirm reset keeps the record (id+pw) but it stays exited
ok(pl&&pl.gone&&pl.gone.pw==='9999','reset: exited player record + password kept');
ok(pl&&pl.gone&&pl.gone.exited===true,'reset: exited player REMAINS exited (does NOT auto-rejoin)');

console.log((fail?'❌':'✅')+' resettest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
