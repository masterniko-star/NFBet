'use strict';
// AUDIT: new games are published WITH draw (leagues/group) and WITHOUT draw (knockouts).
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const fails=[];
function ok(c,m){if(c){pass++;}else{fail++;fails.push(m);console.log('  ✗ '+m);}}
const tick=()=>new Promise(r=>setTimeout(r,25));

(async function(){

// ---------- A. detectDrawOK: leagues -> true, knockouts -> false ----------
{
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{});
  const d=A.sandbox.detectDrawOK;
  // top European + others leagues (slug .1) -> draw allowed
  ['eng.1','esp.1','ita.1','ger.1','fra.1','ned.1','por.1','bra.1','ksa.1','mex.1'].forEach(s=>ok(d(s,'')===true,'league '+s+' -> drawOK true'));
  // explicit league-ish stages
  ok(d('uefa.champions','Matchday 1')===true,'UCL matchday -> draw true (group/league phase)');
  ok(d('fifa.world','Group A')===true,'WC group stage -> draw true');
  ok(d('fifa.world','group stage')===true,'WC "group stage" -> draw true');
  // knockout stages -> no draw
  ok(d('fifa.world','Round of 16')===false,'WC R16 -> draw false');
  ok(d('fifa.world','Round of 32')===false,'WC R32 -> draw false');
  ok(d('fifa.world','Quarterfinal')===false,'WC QF -> draw false');
  ok(d('fifa.world','Semifinal')===false,'WC SF -> draw false');
  ok(d('fifa.world','Final')===false,'WC Final -> draw false');
  ok(d('uefa.champions','Round of 16')===false,'UCL R16 -> draw false');
  ok(d('','playoff')===false,'playoff -> draw false');
  ok(d('','1/8 final')===false,'1/8 final -> draw false');
  // cups default to knockout (no league signal)
  ok(d('eng.fa','')===false,'FA Cup (no stage) -> draw false (knockout default)');
  ok(d('esp.copa_del_rey','')===false,'Copa del Rey -> draw false');
  ok(d('ger.dfb_pokal','')===false,'DFB Pokal -> draw false');
}

// ---------- B. client creation paths set drawOK correctly ----------
// B1: ESPN league fixture -> drawOK true
{
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7'});
  A.sandbox.MODE='admin'; A.sandbox.refresh(); await tick();
  A.sandbox.fxData=[{id:'L1',home:'Arsenal',away:'Chelsea',date:'2026-08-20T18:00',state:'pre',slug:'eng.1',stage:'Matchday 3'}];
  A.sandbox.fxSlug='eng.1';
  A.sandbox.$$=function(sel){return sel.indexOf('.fxc:checked')>=0?[{getAttribute:()=>'0'}]:[];};
  A.sandbox.aAddSelectedFixtures(); await tick();
  const m=Object.values(A.state.tree.matches)[0];
  ok(m&&m.drawOK===true,'ESPN league (eng.1) added with drawOK=true');
}
// B2: ESPN WC knockout -> drawOK false
{
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7'});
  A.sandbox.MODE='admin'; A.sandbox.refresh(); await tick();
  A.sandbox.fxData=[{id:'K1',home:'Brazil',away:'Spain',date:'2026-07-10T18:00',state:'pre',slug:'fifa.world',stage:'Round of 16'}];
  A.sandbox.fxSlug='fifa.world';
  A.sandbox.$$=function(sel){return sel.indexOf('.fxc:checked')>=0?[{getAttribute:()=>'0'}]:[];};
  A.sandbox.aAddSelectedFixtures(); await tick();
  const m=Object.values(A.state.tree.matches)[0];
  ok(m&&m.drawOK===false,'ESPN WC knockout (Round of 16) added with drawOK=false');
}
// B3: 365 Israeli league -> drawOK true
{
  const future=new Date(Date.now()+3*864e5).toISOString();
  const s365={games:[{id:7700,startTime:future,statusGroup:1,homeCompetitor:{name:'מכבי חיפה'},awayCompetitor:{name:'הפועל ת"א'}}]};
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7',s365});
  A.sandbox.MODE='admin'; A.sandbox.refresh(); await tick();
  await A.sandbox.load365Games('42'); await tick();
  A.sandbox.$$=function(sel){return sel.indexOf('.fxc:checked')>=0?[{getAttribute:()=>'0'}]:[];};
  A.sandbox.aAddSelectedFixtures(); await tick();
  const m=Object.values(A.state.tree.matches)[0];
  ok(m&&m.drawOK===true,'365 Israeli league added with drawOK=true');
}
// B4: manual add -> defaults drawOK false (knockout); admin can toggle
{
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7'});
  A.sandbox.MODE='admin'; A.sandbox.refresh(); await tick();
  A.q('#nmA').value='Team A'; A.q('#nmB').value='Team B'; A.q('#nmDt').value='';
  A.sandbox.aCreateMatch(); await tick();
  const m=Object.values(A.state.tree.matches)[0];
  ok(m&&!m.drawOK,'manual match defaults drawOK=false (knockout default)');
}
// B5: generated bracket -> all knockout (drawOK falsy)
{
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7'});
  A.sandbox.MODE='admin'; A.sandbox.refresh(); await tick();
  A.sandbox.aGenBracket(); await tick();
  const ms=Object.values(A.state.tree.matches);
  ok(ms.length>0,'bracket generated some matches');
  ok(ms.every(m=>!m.drawOK),'every bracket match drawOK falsy (knockout)');
}

// ---------- C. bet UI: draw option shown only when drawOK ----------
{
  const A=loadApp({
    meta:{bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
    players:{me:{name:'Me',t:1}},
    matches:{
      mDraw:{round:'R32',order:1,t:1,teamA:'Maccabi',teamB:'Hapoel',settled:false,winner:null,drawOK:true},
      mKO:{round:'R32',order:2,t:2,teamA:'Brazil',teamB:'Spain',settled:false,winner:null,drawOK:false}
    },bets:{}
  },{});
  A.sandbox.ME='me'; A.sandbox.MODE='play'; A.sandbox.refresh(); await tick();
  A.sandbox.renderBetView();
  const h=A.mainHTML();
  // draw match shows the תיקו (X) button
  ok(h.indexOf('תיקו')>=0,'draw match shows תיקו option');
  ok(h.indexOf('>X<')>=0,'draw match shows X tnum');
  // The b3 (3-row) layout is used for the draw match
  ok(h.indexOf('betrow b3')>=0,'draw match uses 3-row layout (b3)');
  // pPick rejects X on knockout match
  A.sandbox.pPick('mKO','X'); await tick();
  const koBets=(A.state.tree.bets&&A.state.tree.bets.mKO)||{};
  ok(Object.keys(koBets).length===0,'pPick X on knockout match -> rejected (no bet created)');
  // pPick A on knockout works
  A.sandbox.pPick('mKO','A'); await tick();
  // (bet creation goes through stake flow; just ensure X stays blocked, A is allowed path)
  ok(A.sandbox.S.matches.find(m=>m.id==='mKO').drawOK===false,'knockout match drawOK stays false');
}

// ---------- C2. knockout bet card omits תיקו ----------
{
  const A=loadApp({
    meta:{bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
    players:{me:{name:'Me',t:1}},
    matches:{mKO:{round:'R32',order:1,t:1,teamA:'Brazil',teamB:'Spain',settled:false,winner:null,drawOK:false}},bets:{}
  },{});
  A.sandbox.ME='me'; A.sandbox.MODE='play'; A.sandbox.refresh(); await tick();
  A.sandbox.renderBetView();
  const h=A.mainHTML();
  ok(h.indexOf('תיקו')<0,'knockout-only bet view has NO תיקו option');
  ok(h.indexOf('betrow b3')<0,'knockout match uses 2-row layout (no b3)');
}

// ---------- E. aSetDraw toggles drawOK (and refunds X bets when turned off) ----------
{
  const A=loadApp({
    meta:{bank:100,cur:'\u20aa'},
    players:{p1:{name:'P1',t:1}},
    matches:{m1:{round:'R32',order:1,t:1,teamA:'A',teamB:'B',settled:false,winner:null,drawOK:false}},bets:{}
  },{hash:'#ctrl7'});
  A.sandbox.MODE='admin'; A.sandbox.refresh(); await tick();
  // turn draw ON
  A.sandbox.aSetDraw('m1',true); await tick();
  ok(A.state.tree.matches.m1.drawOK===true,'aSetDraw(true) enables draw');
  // place an X bet, then turn draw OFF -> X bet refunded (removed)
  A.state.tree.bets={m1:{p1:{team:'X',stake:3}}}; A.sandbox.refresh(); await tick();
  A.sandbox.aSetDraw('m1',false); await tick();
  ok(A.state.tree.matches.m1.drawOK===false,'aSetDraw(false) disables draw');
  const b=(A.state.tree.bets&&A.state.tree.bets.m1)||{};
  ok(!b.p1,'turning draw OFF removed the X bet (refunded)');
}

console.log('\n'+(fail===0?'✅':'❌')+' drawpubtest: '+pass+' passed, '+fail+' failed');
if(fail)process.exit(1);
})();
