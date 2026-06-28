const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const now=Date.now();const iso=h=>new Date(now+h*36e5).toISOString();
function ev(id,hw,aw,hs,as){return {id:id,date:iso(-3),status:{type:{state:'post',completed:true}},competitions:[{competitors:[
  {homeAway:'home',winner:hw,score:hs,team:{displayName:'H'+id}},{homeAway:'away',winner:aw,score:as,team:{displayName:'A'+id}}]}]};}
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},players:{p0:{name:'P',t:1}},
  matches:{
    m1:{round:'R32',order:0,t:1,teamA:'H1',teamB:'A1',dt:new Date(now-3*36e5).toISOString().slice(0,16),settled:false,winner:null,fx:'espn1',fxLeague:'fifa.world'},
    m2:{round:'R32',order:1,t:2,teamA:'H2',teamB:'A2',dt:new Date(now-3*36e5).toISOString().slice(0,16),settled:false,winner:null,fx:'espn2',fxLeague:'fifa.world'}},
  bets:{m1:{p0:{team:'A',stake:3}}}};
const espn={events:[ev('1',true,false,'2','0'),ev('2',false,true,'0','1')]};

(async()=>{
console.log('===== AUTO-FILL silent mode (background 4h check) =====');
// run on a NON-matches tab (no #fillMsg in real DOM) -> must still settle, no throw, no msg dependency
let A=loadApp(seed,{espn});A.sandbox.buildState(A.state.tree);A.sandbox.MODE='admin';A.sandbox.TAB='players';A.sandbox.renderActive();
let err=null;try{A.sandbox.aFillResults(true);}catch(e){err=e;}
await flush(80);
ok(!err,'auto: aFillResults(true) off-tab runs without throw');
ok(A.state.tree.matches.m1.settled&&A.state.tree.matches.m1.winner==='A','auto: settled home-win m1=A in background');
ok(A.state.tree.matches.m2.settled&&A.state.tree.matches.m2.winner==='B','auto: settled away-win m2=B in background');

console.log('\n===== auto mode is SILENT when nothing pending =====');
let B=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{},matches:{},bets:{}},{espn:{events:[]}});
B.sandbox.buildState(B.state.tree);B.sandbox.MODE='admin';B.sandbox.TAB='matches';B.sandbox.renderActive();
const before=B.q('#fillMsg').innerHTML;
B.sandbox.aFillResults(true); await flush(20);
ok(B.q('#fillMsg').innerHTML===before,'auto: no "nothing pending" message spam (silent)');
// manual mode DOES show the message
B.sandbox.aFillResults(false); await flush(20);
ok(B.q('#fillMsg').innerHTML.indexOf('אין משחקים')>=0,'manual: still shows "no pending" message');

console.log('\n===== auto-fill is idempotent (re-run does nothing) =====');
const snap=JSON.stringify(A.state.tree.matches);
A.sandbox.aFillResults(true); await flush(60);
ok(JSON.stringify(A.state.tree.matches)===snap,'auto: second run leaves state unchanged');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
