'use strict';
// NEW features: league dropdown in fixtures search + dollar column for open bets in טבלה
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const fails=[];
function ok(c,m){if(c){pass++;}else{fail++;fails.push(m);console.log('  ✗ '+m);}}
const tick=()=>new Promise(r=>setTimeout(r,25));

(async function(){

// ---------- 1. League dropdown renders with all main leagues + free text input ----------
{
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7'});
  A.sandbox.MODE='admin';
  A.sandbox.refresh();
  await tick();
  A.sandbox.renderAdminMatches();
  const h=A.mainHTML();
  ok(h.indexOf('id="fxSelect"')>=0,'dropdown present');
  ok(h.indexOf('fxSelectGo(this.value)')>=0,'dropdown wired to fxSelectGo');
  ok(h.indexOf('id="fxQ"')<0,'free-text input merged into dropdown (removed)');
  ok(h.indexOf('fxReloadSel()')>=0,'reload button (טען) present');
  // main leagues in options
  ok(h.indexOf('value="365:42"')>=0,'option: Israeli league (365:42)');
  ok(h.indexOf('value="eng.1"')>=0,'option: English Premier League');
  ok(h.indexOf('value="esp.1"')>=0,'option: Spanish La Liga');
  ok(h.indexOf('value="ita.1"')>=0,'option: Italian Serie A');
  ok(h.indexOf('value="ger.1"')>=0,'option: German Bundesliga');
  ok(h.indexOf('value="fra.1"')>=0,'option: French Ligue 1');
  ok(h.indexOf('value="fifa.world"')>=0,'option: World Cup');
  ok(h.indexOf('value="uefa.champions"')>=0,'option: Champions League');
  ok(h.indexOf('ליגת העל')>=0,'Hebrew label ליגת העל present');
  // placeholder
  ok(h.indexOf('בחר ליגה')>=0,'placeholder option present');
  // Israeli league appears before the rest (prominent)
  const iIsr=h.indexOf('value="365:42"'), iEpl=h.indexOf('value="eng.1"');
  ok(iIsr>=0&&iEpl>=0&&iIsr<iEpl,'Israeli league listed before EPL (prominent first)');
}

// ---------- 2. fxSelectGo routes 365 vs ESPN correctly ----------
{
  const future=new Date(Date.now()+3*864e5).toISOString();
  const s365={games:[{id:5001,startTime:future,statusGroup:1,homeCompetitor:{name:'מכבי חיפה'},awayCompetitor:{name:'בית"ר ירושלים'}}]};
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7',s365});
  A.sandbox.MODE='admin'; A.sandbox.refresh(); await tick();
  A.sandbox.renderAdminMatches();
  // pick Israeli league -> 365 path (fxSlug set synchronously)
  A.sandbox.fxSelectGo('365:42');
  ok(A.sandbox.fxSlug==='365:42','fxSelectGo(365:42) -> 365 path (fxSlug=365:42)');
  await tick();
  ok(A.q('#fxRes').innerHTML.indexOf('מכבי חיפה')>=0,'365 league loaded Hebrew games via dropdown');
  // pick EPL -> ESPN path
  A.sandbox.fxSelectGo('eng.1');
  ok(A.sandbox.fxSlug==='eng.1','fxSelectGo(eng.1) -> ESPN path (fxSlug=eng.1)');
  // dropdown persists the selection so it stays shown after re-render
  ok(A.sandbox.localStorage.getItem('fxslug')==='eng.1','fxSelectGo persists selected league (fxslug)');
}

// ---------- 3. Table columns: 2-line name + deposited(📥)/withdrawn(📤)/balance(💰) ----------
{
  const A=loadApp({
    meta:{bank:100,cur:'\u20aa'},
    players:{p1:{name:'אלפא',feePaid:true,t:1},p2:{name:'בטא',feePaid:false,t:2},p3:{name:'ניקולאי פלדמן',feePaid:true,dep:150,wd:30,t:3}},
    matches:{}, bets:{}
  },{});
  A.sandbox.ME='p3'; A.sandbox.MODE='play';
  A.sandbox.refresh(); await tick();
  A.sandbox.renderAllView();
  const h=A.mainHTML();
  ok(h.indexOf('קופה כללית')>=0,'table summary (קופה כללית) present');
  ok(/class="nmtxt"/.test(h),'name in 2-line nmtxt span (RTL)');
  ok(/class="io dep"><span class="ic">📥<\/span>/.test(h),'deposited column with 📥');
  ok(/class="io wd"><span class="ic">📤<\/span>/.test(h),'withdrawn column with 📤');
  ok(/class="bal"/.test(h)&&!/💰/.test(h),'balance cell present, 💰 icon removed');
  ok(h.indexOf('class="bet"')<0&&h.indexOf('class="dm"')<0,'old bet/dm columns removed');
  ok(/📥<\/span>100/.test(h),'paid player -> deposited 100');
  ok(/📥<\/span>0/.test(h),'demo player -> deposited 0');
  ok(/📥<\/span>150/.test(h)&&/📤<\/span>30/.test(h),'explicit dep=150 / wd=30 rendered');
}

console.log('\n'+(fail===0?'✅':'❌')+' features2test: '+pass+' passed, '+fail+' failed');
if(fail)process.exit(1);
})();
