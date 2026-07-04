'use strict';
// NEW features: league dropdown in fixtures search + dollar column for open bets in טבלה
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const fails=[];
function ok(c,m){if(c){pass++;}else{fail++;fails.push(m);console.log('  ✗ '+m);}}
const tick=()=>new Promise(r=>setTimeout(r,25));

(async function(){

// ---------- 1. Tournament checklist renders with all main leagues + select-all ----------
{
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7'});
  A.sandbox.MODE='admin';
  A.sandbox.refresh();
  await tick();
  A.sandbox.renderAdminMatches();
  const h=A.mainHTML();
  ok(h.indexOf('id="fxTourneys"')>=0,'tournament checklist present');
  ok(h.indexOf('fxLoadSelected()')>=0,'load button wired to fxLoadSelected');
  ok(h.indexOf('fxToggleAll()')>=0,'select-all control present');
  ok(h.indexOf('id="fxCount"')>=0,'games-count field present');
  ok(h.indexOf('fxCountChange(this.value)')>=0,'count field wired to fxCountChange');
  ok(h.indexOf('id="fxQ"')<0,'no free-text input');
  ok(h.indexOf('id="fxSelect"')<0,'old single-select dropdown removed');
  // main leagues as checklist rows
  ok(h.indexOf("fxToggleOne('365:42')")>=0,'row: Israeli league (365:42)');
  ok(h.indexOf("fxToggleOne('eng.1')")>=0,'row: English Premier League');
  ok(h.indexOf("fxToggleOne('esp.1')")>=0,'row: Spanish La Liga');
  ok(h.indexOf("fxToggleOne('ita.1')")>=0,'row: Italian Serie A');
  ok(h.indexOf("fxToggleOne('ger.1')")>=0,'row: German Bundesliga');
  ok(h.indexOf("fxToggleOne('fra.1')")>=0,'row: French Ligue 1');
  ok(h.indexOf("fxToggleOne('fifa.world')")>=0,'row: World Cup');
  ok(h.indexOf("fxToggleOne('uefa.champions')")>=0,'row: Champions League');
  ok(h.indexOf('ליגת העל')>=0,'Hebrew label ליגת העל present');
  // Israeli league appears before EPL in the list
  const iIsr=h.indexOf("fxToggleOne('365:42')"), iEpl=h.indexOf("fxToggleOne('eng.1')");
  ok(iIsr>=0&&iEpl>=0&&iIsr<iEpl,'Israeli league listed before EPL');
}

// ---------- 2. multi-select: toggle + load routes 365 correctly, persists ordered selection ----------
{
  const future=new Date(Date.now()+3*864e5).toISOString();
  const s365={games:[{id:5001,startTime:future,statusGroup:1,homeCompetitor:{name:'מכבי חיפה'},awayCompetitor:{name:'בית"ר ירושלים'}}]};
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7',s365});
  A.sandbox.MODE='admin'; A.sandbox.refresh(); await tick();
  A.sandbox.renderAdminMatches();
  // select Israeli league, then load
  A.sandbox.fxToggleOne('365:42');
  A.sandbox.fxLoadSelected();
  await tick();
  ok(A.q('#fxRes').innerHTML.indexOf('מכבי חיפה')>=0,'selected 365 league loaded Hebrew games');
  // ordered selection persisted to fxslugs (JSON array)
  const saved=A.sandbox.localStorage.getItem('fxslugs');
  ok(saved&&saved.indexOf('365:42')>=0,'selection persisted to fxslugs');
  // toggle off removes it
  A.sandbox.fxToggleOne('365:42');
  const saved2=A.sandbox.localStorage.getItem('fxslugs');
  ok(saved2&&saved2.indexOf('365:42')<0,'unchecking removes league from fxslugs');
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
  ok(/class="bt"/.test(h)&&!/💰/.test(h),'total cell present, 💰 icon removed');
  ok(h.indexOf('class="bet"')<0&&h.indexOf('class="dm"')<0,'old bet/dm columns removed');
  ok(/📥<\/span>100/.test(h),'paid player -> deposited 100');
  ok(/📥<\/span>0/.test(h),'demo player -> deposited 0');
  ok(/📥<\/span>150/.test(h)&&/📤<\/span>30/.test(h),'explicit dep=150 / wd=30 rendered');
}

console.log('\n'+(fail===0?'✅':'❌')+' features2test: '+pass+' passed, '+fail+' failed');
if(fail)process.exit(1);
})();
