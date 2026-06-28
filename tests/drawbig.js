// ============ DRAWBIG — comprehensive 1-X-2 (draw) feature test ============
const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0,sec='';
const ok=(c,m)=>{tests++;if(!c){fails++;console.log('  \x1b[31mFAIL ['+sec+']: '+m+'\x1b[0m');}else console.log('  ok   '+m);};
const close=(a,b,e=1e-6)=>Math.abs(a-b)<e;
const SEC=s=>{sec=s;console.log('\n===== '+s+' =====');};
const baseMeta={fee:100,bank:100,minBet:1,maxBet:10,cur:'\u20aa'};
function app(seed,opts){const A=loadApp(seed,opts||{});A.sandbox.buildState(A.state.tree);A.sandbox.MODE='admin';return A;}
const sum=o=>Object.keys(o).reduce((s,k)=>s+o[k],0);

(async()=>{

// ---------- A: calcMatch 1-X-2 money math ----------
SEC('A \u00b7 calcMatch payout math (1-X-2 + VOID)');
{
  const A=app({meta:baseMeta,players:{},matches:{},bets:{}},{});
  const calc=A.sandbox.calcMatch;
  const M=(d,w,b)=>({drawOK:d,settled:!!w,winner:w||null,bets:b});
  const b={p1:{team:'A',stake:30},p2:{team:'X',stake:6},p3:{team:'X',stake:4},p4:{team:'B',stake:60}};
  let c=calc(M(true,'X',b)); // pool=100 sumX=10 coefX=10
  ok(close(c.pool,100),'pool = Σ all stakes (100)');
  ok(close(c.sumX,10)&&close(c.coefX,10),'sumX=10, coefX = pool/sumX = 10');
  ok(close(c.payouts.p2,60)&&close(c.payouts.p3,40),'X-bettors split pool by stake (6\u219260, 4\u219240)');
  ok(c.payouts.p1===0&&c.payouts.p4===0,'A/B bettors get 0 on a draw');
  ok(close(sum(c.payouts),c.pool),'paid draw: \u03a3 payouts == pool (money conserved, no leak)');
  c=calc(M(true,'A',b)); // sumA=30 pool=100
  ok(close(c.payouts.p1,100)&&c.payouts.p2===0&&c.payouts.p3===0&&c.payouts.p4===0,'A wins: lone A-bettor takes whole pool (X stakes feed it)');
  c=calc(M(true,'VOID',b));
  ok(c.refunded&&c.payouts.p1===30&&c.payouts.p2===6&&c.payouts.p3===4&&c.payouts.p4===60,'VOID: everyone refunded exact stake');
  const b2={p1:{team:'A',stake:5},p2:{team:'B',stake:7}};
  c=calc(M(true,'X',b2));
  ok(c.refunded&&c.payouts.p1===5&&c.payouts.p2===7,'draw but NO X-bettors \u2192 refund all (empty winning bucket)');
  c=calc(M(false,'X',b2));
  ok(c.refunded&&c.payouts.p1===5&&c.payouts.p2===7,'knockout winner=X, no X bets \u2192 refund (backward-compatible)');
  // a single X bettor wins back exactly the pool (others fund it)
  c=calc(M(true,'X',{p1:{team:'X',stake:2},p2:{team:'A',stake:8}}));
  ok(close(c.payouts.p1,10)&&c.payouts.p2===0,'sole X-bettor (stake2) takes pool 10 (net +8)');
}

// ---------- B: standings / balance / availFor / conservation ----------
SEC('B \u00b7 standings, balance, availFor (X & VOID)');
{
  const seed={meta:baseMeta,
    players:{p1:{name:'A'},p2:{name:'B'},p3:{name:'C'},p4:{name:'D'}},
    matches:{
      g1:{round:'GRP',order:0,drawOK:true,settled:true,winner:'X',teamA:'X1',teamB:'Y1'},
      g2:{round:'GRP',order:1,drawOK:true,settled:true,winner:'VOID',teamA:'X2',teamB:'Y2'}},
    bets:{
      g1:{p1:{team:'X',stake:4},p2:{team:'A',stake:4},p3:{team:'B',stake:2}}, // X wins: p1 takes pool 10
      g2:{p1:{team:'A',stake:5},p4:{team:'X',stake:3}}}}; // VOID -> refund
  const A=app(seed,{});const st=id=>A.sandbox.statsFor(id);
  ok(close(st('p1').balance,baseMeta.bank+6),'p1 won draw: balance bank+6 (pool10 - stake4)');
  ok(st('p1').correct===1,'p1: draw guess counts as CORRECT');
  ok(close(st('p2').balance,baseMeta.bank-4)&&st('p2').lost===1,'p2 lost to draw: bank-4, counted lost');
  ok(close(st('p4').balance,baseMeta.bank)&&st('p4').push===1,'p4: VOID match \u2192 balance unchanged (push)');
  ok(st('p1').push===1,'p1 VOID bet on g2 also counted push');
  const totBal=['p1','p2','p3','p4'].reduce((s,id)=>s+st(id).balance,0);
  ok(close(totBal,4*baseMeta.bank),'CONSERVATION: \u03a3 balances == 4\u00d7bank (nothing created/destroyed)');
  ok(close(A.sandbox.availFor('p1','gNEW'),baseMeta.bank+6),'availFor p1 credits draw winnings (bank+6)');
  ok(close(A.sandbox.availFor('p2','gNEW'),baseMeta.bank-4),'availFor p2 debits draw loss (bank-4)');
  ok(A.sandbox.ranking()[0].p.id==='p1','ranking: draw-winner p1 is 1st');
}

// ---------- C: KNOCKOUT-X GATE (critical) via auto-settle ----------
SEC('C \u00b7 knockout-X gate (CRITICAL fix) via "\u05de\u05dc\u05d0" auto-settle');
{
  const now=Date.now();const iso=h=>new Date(now+h*36e5).toISOString();const dtl=new Date(now-3*36e5).toISOString().slice(0,16);
  const ev=(id,hw,aw,hs,as)=>({id,date:iso(-3),status:{type:{state:'post',completed:true}},competitions:[{competitors:[
    {homeAway:'home',winner:hw,score:hs,team:{displayName:'H'+id}},{homeAway:'away',winner:aw,score:as,team:{displayName:'A'+id}}]}]});
  const seed={meta:baseMeta,players:{p0:{name:'P'},p1:{name:'Q'},p2:{name:'R'}},
    matches:{
      mk:{round:'R32',order:0,settled:false,winner:null,teamA:'Hk',teamB:'Ak',dt:dtl,fx:'espn1',fxLeague:'fifa.world'}, // knockout (drawOK absent=false)
      mg:{round:'GRP',order:1,settled:false,winner:null,teamA:'Hg',teamB:'Ag',dt:dtl,fx:'espn2',fxLeague:'eng.1',drawOK:true}}, // draw-enabled
    bets:{mk:{p1:{team:'A',stake:3},p2:{team:'B',stake:3}}, mg:{p0:{team:'X',stake:4},p1:{team:'A',stake:2}}}};
  // both report a level 1-1 with NO winner flag
  const A=app(seed,{espn:{events:[ev('1',false,false,'1','1'),ev('2',false,false,'1','1')]}});
  A.sandbox.TAB='players';A.sandbox.renderActive();
  A.sandbox.aFillResults(true); await flush(120);
  ok(A.state.tree.matches.mk.settled===false&&A.state.tree.matches.mk.winner==null,
     'CRITICAL: knockout 1-1 (no advance flag) NOT settled \u2014 gate prevents wrong refund');
  ok(A.state.tree.matches.mg.settled===true&&A.state.tree.matches.mg.winner==='X',
     'draw-enabled 1-1 IS settled as X (draw wins)');
  A.sandbox.buildState(A.state.tree);
  ok(close(A.sandbox.statsFor('p0').balance,baseMeta.bank+2),'mg X-bettor p0 paid: bank+2 (pool6 - stake4), p0 isolated to mg');
  // ESPN later sets the advance flag for the knockout -> settles on next poll
  A.state.espn={events:[ev('1',true,false,'2','1'),ev('2',false,false,'1','1')]};
  A.sandbox.aFillResults(true); await flush(120);
  ok(A.state.tree.matches.mk.settled===true&&A.state.tree.matches.mk.winner==='A',
     'knockout settles A once ESPN exposes advance flag (no data lost)');
  // a draw-enabled match with a DECISIVE result settles to the team
  const seed2={meta:baseMeta,players:{p0:{name:'P'}},matches:{md:{round:'GRP',order:0,settled:false,winner:null,teamA:'Hd',teamB:'Ad',dt:dtl,fx:'espn9',fxLeague:'eng.1',drawOK:true}},bets:{md:{p0:{team:'B',stake:3}}}};
  const B=app(seed2,{espn:{events:[ev('9',false,true,'0','2')]}});
  B.sandbox.aFillResults(true); await flush(80);
  ok(B.state.tree.matches.md.settled===true&&B.state.tree.matches.md.winner==='B','draw-enabled decisive 0-2 settles to winning team (B)');
}

// ---------- D: VOID integrity / valid-winner check ----------
SEC('D \u00b7 VOID integrity (no false "invalid winner" warning)');
{
  const A=app({meta:baseMeta,players:{p1:{name:'A'}},
    matches:{v:{round:'GRP',order:0,drawOK:true,settled:true,winner:'VOID',teamA:'X',teamB:'Y'},
             x:{round:'GRP',order:1,drawOK:true,settled:true,winner:'X',teamA:'X',teamB:'Y'}},
    bets:{v:{p1:{team:'X',stake:3}},x:{p1:{team:'X',stake:3}}}},{});
  const X=A.sandbox; X.logClear(); X._diagSeen={};
  A.sandbox.buildState(A.state.tree); X.runDiagnostics();
  const w1=X.logRead().filter(e=>(e.msg||'').indexOf('\u05dc\u05d0 \u05ea\u05e7\u05d9\u05df')>=0);
  ok(w1.length===0,'no false "invalid winner" warning for VOID or X matches');
  A.state.tree.matches.bad={round:'GRP',order:2,settled:true,winner:'Q',teamA:'X',teamB:'Y'};
  X.logClear(); X._diagSeen={}; A.sandbox.buildState(A.state.tree); X.runDiagnostics();
  const w2=X.logRead().filter(e=>(e.msg||'').indexOf('\u05dc\u05d0 \u05ea\u05e7\u05d9\u05df')>=0);
  ok(w2.length===1,'genuinely invalid winner (Q) STILL warns (check is alive)');
}

// ---------- E: aSetDraw clears stranded X bets on disable ----------
SEC('E \u00b7 aSetDraw removes stranded invisible X bets on disable');
{
  const mk=()=>({meta:baseMeta,players:{p1:{name:'A'},p2:{name:'B'}},
    matches:{m:{round:'GRP',order:0,drawOK:true,settled:false,teamA:'X',teamB:'Y'}},
    bets:{m:{p1:{team:'X',stake:4},p2:{team:'A',stake:3}}}});
  const A=app(mk(),{confirm:true});
  A.sandbox.aSetDraw('m',false); await flush(60);
  ok(A.state.tree.matches.m.drawOK===false,'disable: drawOK \u2192 false');
  ok(!(A.state.tree.bets.m||{}).p1,'disable: stranded X bet (p1) removed/refunded');
  ok((A.state.tree.bets.m||{}).p2&&A.state.tree.bets.m.p2.team==='A','disable: A/B bets untouched');
  const B=app(mk(),{confirm:false});
  B.sandbox.aSetDraw('m',false); await flush(40);
  ok(B.state.tree.matches.m.drawOK===true&&(B.state.tree.bets.m||{}).p1,'decline confirm: nothing changes (drawOK & X bet kept)');
  const seedS={meta:baseMeta,players:{p1:{name:'A'}},matches:{m:{round:'GRP',order:0,drawOK:true,settled:true,winner:'X',teamA:'X',teamB:'Y'}},bets:{m:{p1:{team:'X',stake:4}}}};
  const C=app(seedS,{confirm:true});
  C.sandbox.aSetDraw('m',false); await flush(40);
  ok((C.state.tree.bets.m||{}).p1,'settled match: X bets preserved on disable (result not corrupted)');
  const D=app({meta:baseMeta,players:{p1:{name:'A'}},matches:{m:{round:'R32',order:0,settled:false,teamA:'X',teamB:'Y'}},bets:{}},{confirm:true});
  D.sandbox.aSetDraw('m',true); await flush(40);
  ok(D.state.tree.matches.m.drawOK===true,'enable: drawOK \u2192 true (no side effects)');
}

// ---------- F: full integration — draw-enabled league round ----------
SEC('F \u00b7 integration: full draw-enabled league round + conservation');
{
  const now=Date.now();const dtl=new Date(now-3*36e5).toISOString().slice(0,16);
  const ev=(id,hw,aw,hs,as)=>({id,date:new Date(now-3*36e5).toISOString(),status:{type:{state:'post',completed:true}},competitions:[{competitors:[
    {homeAway:'home',winner:hw,score:hs,team:{displayName:'H'+id}},{homeAway:'away',winner:aw,score:as,team:{displayName:'A'+id}}]}]});
  const seed={meta:baseMeta,players:{a:{name:'a'},b:{name:'b'},c:{name:'c'},d:{name:'d'},e:{name:'e'}},
    matches:{
      r1:{round:'GRP',order:0,settled:false,teamA:'H1',teamB:'A1',dt:dtl,fx:'espn1',fxLeague:'eng.1',drawOK:true},
      r2:{round:'GRP',order:1,settled:false,teamA:'H2',teamB:'A2',dt:dtl,fx:'espn2',fxLeague:'eng.1',drawOK:true},
      r3:{round:'GRP',order:2,settled:false,teamA:'H3',teamB:'A3',dt:dtl,fx:'espn3',fxLeague:'eng.1',drawOK:true}},
    bets:{
      r1:{a:{team:'A',stake:5},b:{team:'X',stake:5},c:{team:'B',stake:5}}, // 1-1 -> X: b wins
      r2:{a:{team:'A',stake:4},b:{team:'A',stake:6},c:{team:'B',stake:2}}, // 2-0 -> A
      r3:{d:{team:'X',stake:3},e:{team:'X',stake:3}}}};                    // 0-1 -> B (no B bettor -> refund)
  const A=app(seed,{espn:{events:[ev('1',false,false,'1','1'),ev('2',true,false,'2','0'),ev('3',false,true,'0','1')]}});
  A.sandbox.aFillResults(true); await flush(160);
  ok(A.state.tree.matches.r1.winner==='X'&&A.state.tree.matches.r2.winner==='A'&&A.state.tree.matches.r3.winner==='B',
     'round settled: r1=X(draw), r2=A, r3=B');
  A.sandbox.buildState(A.state.tree);
  const st=id=>A.sandbox.statsFor(id);
  const tot=['a','b','c','d','e'].reduce((s,id)=>s+st(id).balance,0);
  ok(close(tot,5*baseMeta.bank),'CONSERVATION: \u03a3 balances == 5\u00d7bank after full round (auto-bets incl)');
  ok(st('b').correct>=1,'b guessed r1 draw \u2192 correct++');
  ok(st('d').push>=1&&st('e').push>=1,'r3 decisive B with empty B-bucket \u2192 X-bettors d,e refunded (push)');
  // no balance can ever exceed total pot or go negative in a sane settle
  const anyNeg=['a','b','c','d','e'].some(id=>st(id).balance<0);
  ok(!anyNeg,'no negative balances after settlement');
}

console.log('\n'+(fails?('\x1b[31m===== FAILED '+fails+'/'+tests+' =====\x1b[0m'):('\x1b[32m===== ALL PASS '+tests+'/'+tests+' =====\x1b[0m')));
process.exit(fails?1:0);
})();
