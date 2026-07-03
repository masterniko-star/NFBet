'use strict';
// Section tests: Phase-2 client — two dashboards (results/newgames, Ч:ММ offsets + fixed times) + 365 Israeli league.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const fails=[];
function ok(c,m){if(c){pass++;}else{fail++;fails.push(m);console.log('  ✗ '+m);}}
function eq(a,b,m){ok(JSON.stringify(a)===JSON.stringify(b),m+' (got '+JSON.stringify(a)+' want '+JSON.stringify(b)+')');}
const tick=()=>new Promise(r=>setTimeout(r,25));

(async function(){

// ---------- 1. acMig: migration old->new, new passthrough, defaults ----------
{
  const A=loadApp({},{});
  const mig=A.sandbox.acMig;
  // empty -> defaults
  const d=mig(undefined);
  ok(d.results&&d.newgames,'acMig empty returns results+newgames');
  eq(d.results.on,true,'acMig default results.on=true');
  eq(d.results.after,[180],'acMig default results.after=[180]');
  eq(d.results.times,[],'acMig default results.times=[]');
  eq(d.newgames.after,[210],'acMig default newgames.after=[210]');
  eq(d.newgames.times,['08:00','20:00'],'acMig default newgames.times=AC_DEF_TIMES');
  // OLD shape -> migrate
  const o=mig({enabled:true,times:['09:00','21:00'],add35:true,lastFill:111,lastAdd:222,srvLast:333});
  eq(o.results.after,[180],'acMig old->results.after [180]');
  eq(o.results.last,111,'acMig old lastFill->results.last');
  eq(o.newgames.after,[210],'acMig old add35->newgames.after [210]');
  eq(o.newgames.times,['09:00','21:00'],'acMig old times->newgames.times');
  eq(o.newgames.last,222,'acMig old lastAdd->newgames.last');
  // OLD add35 false -> newgames.after empty
  const o2=mig({enabled:true,times:['10:00'],add35:false});
  eq(o2.newgames.after,[],'acMig old add35=false -> newgames.after []');
  // OLD enabled false -> newgames.times empty
  const o3=mig({enabled:false,times:['10:00'],add35:true});
  eq(o3.newgames.times,[],'acMig old enabled=false -> newgames.times []');
  // NEW shape passthrough (clean)
  const n=mig({results:{on:false,after:[5,180],times:['07:00'],last:9},newgames:{on:true,after:[210],times:[],last:0}});
  eq(n.results.on,false,'acMig new results.on passthrough');
  eq(n.results.after,[5,180],'acMig new results.after passthrough');
  eq(n.results.times,['07:00'],'acMig new results.times passthrough');
  eq(n.results.last,9,'acMig new results.last passthrough');
  // NEW with junk after -> filtered
  const n2=mig({results:{on:true,after:[5,-3,'x',180.4],times:['07:00','bad','25:00']},newgames:{on:true}});
  eq(n2.results.after,[5,180],'acMig new filters bad/neg offsets, rounds');
  eq(n2.results.times,['07:00'],'acMig new filters bad times (bad,25:00)');
}

// ---------- 2. hmToMin / minToHm ----------
{
  const A=loadApp({},{});
  const h2m=A.sandbox.hmToMin, m2h=A.sandbox.minToHm;
  eq(h2m('0:05'),5,'hmToMin 0:05=5');
  eq(h2m('3:30'),210,'hmToMin 3:30=210');
  eq(h2m('15:30'),930,'hmToMin 15:30=930');
  eq(h2m('00:00'),0,'hmToMin 00:00=0');
  eq(h2m('23:59'),1439,'hmToMin 23:59=1439');
  eq(h2m('24:00'),null,'hmToMin 24:00 invalid');
  eq(h2m('3:60'),null,'hmToMin 3:60 invalid');
  eq(h2m('abc'),null,'hmToMin abc invalid');
  eq(h2m(''),null,'hmToMin empty invalid');
  eq(m2h(5),'00:05','minToHm 5=00:05');
  eq(m2h(210),'03:30','minToHm 210=03:30');
  eq(m2h(930),'15:30','minToHm 930=15:30');
  eq(m2h(0),'00:00','minToHm 0=00:00');
  // round-trip
  [0,5,60,125,210,930,1439].forEach(function(min){eq(h2m(m2h(min)),min,'round-trip '+min);});
}

// ---------- 3. acDashStatus ----------
{
  const A=loadApp({autocfg:{results:{on:false,after:[180],times:['08:00','20:00']},newgames:{on:true}}},{});
  A.sandbox.refresh(); // build S.autocfg from tree
  // give it a tick for refresh's fbGet
  await tick();
  const st=A.sandbox.acDashStatus;
  eq(st('results'),'כבוי','acDashStatus off -> כבוי');
  ok(/מופעל/.test(st('newgames')),'acDashStatus on -> מופעל');
  ok(st('newgames').indexOf('185')>=0,'newgames status = results offset +5 (185)');
  ok(st('newgames').indexOf('08:05')>=0&&st('newgames').indexOf('20:05')>=0,'newgames status = results times +5');
}

// ---------- 4. renderSettings: two dashboards render ----------
{
  const A=loadApp({meta:{bank:100},autocfg:{results:{on:true,after:[180],times:['08:00']},newgames:{on:true}},players:{},matches:{},bets:{}},{hash:'#ctrl7'});
  A.sandbox.MODE='admin';
  A.sandbox.refresh();
  await tick();
  A.sandbox.renderSettings();
  const h=A.mainHTML();
  ok(h.indexOf('בדיקת תוצאות')>=0,'settings renders results dashboard title');
  ok(h.indexOf('טעינת משחקים')>=0,'settings renders newgames dashboard title');
  ok(h.indexOf('id="ac_results_on"')>=0,'results on/off checkbox present');
  ok(h.indexOf('id="ac_newgames_on"')>=0,'newgames on/off checkbox present');
  ok(h.indexOf('acDashSave(\'results\')')>=0||h.indexOf('acDashSave("results")')>=0,'results save wired');
  ok(h.indexOf('id="acAfter_results"')>=0,'results offset editor div present');
  ok(h.indexOf('בדיקת תוצאות + 5')>=0,'newgames panel shows derived (results+5) note instead of own editor');
  ok(h.indexOf('id="acTimes_newgames"')<0,'newgames has NO independent times editor (derived)');
  // results editor chips render via acDashInit
  const after=A.q('#acAfter_results').innerHTML;
  ok(after.indexOf('180')>=0,'results offset chip shows 180 as minutes');
  // newgames preview = results +5 (185 ד׳ · 08:05)
  ok(h.indexOf('185')>=0&&h.indexOf('08:05')>=0,'newgames preview = results offsets/times +5');
}

// ---------- 5. acDashSave writes /autocfg/<kind> with on/after/times, preserves last ----------
{
  const A=loadApp({meta:{bank:100},autocfg:{results:{on:true,after:[180],times:[],last:777},newgames:{on:true,after:[210],times:['08:00']}},players:{},matches:{},bets:{}},{hash:'#ctrl7'});
  A.sandbox.MODE='admin';
  A.sandbox.refresh();
  await tick();
  // set editor state + checkbox, then save
  A.sandbox.ac2.results={after:[5,180,210],times:['07:30']};
  A.q('#ac_results_on').checked=true;
  A.sandbox.acDashSave('results');
  await tick();
  const saved=A.state.tree.autocfg.results;
  eq(saved.on,true,'acDashSave results.on=true');
  eq(saved.after,[5,180,210],'acDashSave results.after sorted');
  eq(saved.times,['07:30'],'acDashSave results.times');
  eq(saved.last,777,'acDashSave preserves last (PATCH)');
  // turn off
  A.q('#ac_results_on').checked=false;
  A.sandbox.acDashSave('results');
  await tick();
  eq(A.state.tree.autocfg.results.on,false,'acDashSave can turn results off');
}

// ---------- 6. load365Games parses Hebrew games ----------
{
  const future=new Date(Date.now()+3*864e5).toISOString();
  const future2=new Date(Date.now()+4*864e5).toISOString();
  const past=new Date(Date.now()-3*864e5).toISOString();
  const s365={games:[
    {id:9001,startTime:future,statusGroup:1,homeCompetitor:{name:'מכבי חיפה'},awayCompetitor:{name:'הפועל באר שבע'}},
    {id:9002,startTime:future2,statusGroup:1,homeCompetitor:{name:'מכבי תל אביב'},awayCompetitor:{name:'בית"ר ירושלים'}},
    {id:9003,startTime:past,statusGroup:4,homeCompetitor:{name:'הפועל תל אביב'},awayCompetitor:{name:'בני סכנין'}}
  ]};
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7',s365});
  A.sandbox.MODE='admin';
  A.sandbox.refresh();
  await tick();
  await A.sandbox.load365Games('42');
  await tick();
  const res=A.q('#fxRes').innerHTML;
  ok(res.indexOf('מכבי חיפה')>=0,'load365Games shows Hebrew home team');
  ok(res.indexOf('הפועל באר שבע')>=0,'load365Games shows Hebrew away team');
  ok(res.indexOf('class="fxc"')>=0,'load365Games renders checkboxes');
  // fxData populated, only upcoming (2 future, past excluded)
  eq(A.sandbox.fxData.length,2,'load365Games fxData = 2 upcoming (past ended excluded)');
  eq(A.sandbox.fxData[0].slug,'365:42','load365Games fxData slug=365:42');
}

// ---------- 7. aAddSelectedFixtures adds 365 match (fx 365..., fxLeague 365:42, drawOK true) ----------
{
  const future=new Date(Date.now()+3*864e5).toISOString();
  const s365={games:[
    {id:9001,startTime:future,statusGroup:1,homeCompetitor:{name:'מכבי חיפה'},awayCompetitor:{name:'הפועל באר שבע'}}
  ]};
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7',s365});
  A.sandbox.MODE='admin';
  A.sandbox.refresh();
  await tick();
  await A.sandbox.load365Games('42');
  await tick();
  // simulate one checked checkbox at data-i=0
  const fake={length:1,0:{getAttribute:()=>'0'},forEach:Array.prototype.forEach};
  // patch $$ to return our fake checked list
  A.sandbox.$$=function(sel){return sel.indexOf('.fxc:checked')>=0?[{getAttribute:()=>'0'}]:[];};
  A.sandbox.aAddSelectedFixtures();
  await tick();
  const ms=A.state.tree.matches;
  const keys=Object.keys(ms||{});
  ok(keys.length===1,'aAddSelectedFixtures added 1 match');
  const m=ms[keys[0]];
  ok(m.fx==='3659001','365 match fx=365+id (got '+m.fx+')');
  eq(m.fxLeague,'365:42','365 match fxLeague=365:42');
  eq(m.drawOK,true,'365 match drawOK=true (league)');
  eq(m.teamA,'מכבי חיפה','365 match teamA Hebrew');
  eq(m.teamB,'הפועל באר שבע','365 match teamB Hebrew');
}

// ---------- 8. parity: client acMig vs server migrateCfg (spot-check shapes) ----------
{
  const A=loadApp({},{});
  const cm=A.sandbox.acMig({enabled:true,times:['08:00','20:00'],add35:true});
  // expected canonical new shape
  eq(Object.keys(cm).sort(),['newgames','results'],'acMig produces {results,newgames}');
  eq(Object.keys(cm.results).sort(),['after','last','on','times'],'results has on/after/times/last');
  eq(Object.keys(cm.newgames).sort(),['after','last','leagues','on','times','want'],'newgames has on/after/times/last + want/leagues');
}

// ---------- 9. aFillResults settles an ended 365 match (manual fill, bug #1 fix) ----------
{
  const past=new Date(Date.now()-3*864e5).toISOString();
  const s365={games:[
    {id:999,startTime:past,statusGroup:4,homeCompetitor:{name:'מכבי חיפה',score:2},awayCompetitor:{name:'הפועל באר שבע',score:1}}
  ]};
  const A=loadApp({meta:{bank:100},players:{},matches:{m1:{round:'R32',teamA:'מכבי חיפה',teamB:'הפועל באר שבע',fx:'365999',fxLeague:'365:42',dt:past.slice(0,16),drawOK:true,settled:false,winner:null,order:1,t:1}},bets:{}},{hash:'#ctrl7',s365});
  A.sandbox.MODE='admin';
  A.sandbox.refresh();
  await tick();
  A.sandbox.aFillResults();
  await tick();await tick();
  const m=A.state.tree.matches.m1;
  eq(m.settled,true,'aFillResults settled the 365 match');
  eq(m.winner,'A','aFillResults 365 winner=A (2>1 home)');
}
// ---------- 10. aFillResults 365 draw (X) settles because league drawOK=true ----------
{
  const past=new Date(Date.now()-3*864e5).toISOString();
  const s365={games:[
    {id:777,startTime:past,statusGroup:4,homeCompetitor:{name:'בני סכנין',score:1},awayCompetitor:{name:'עירוני קריית שמונה',score:1}}
  ]};
  const A=loadApp({meta:{bank:100},players:{},matches:{m1:{round:'R32',teamA:'בני סכנין',teamB:'עירוני קריית שמונה',fx:'365777',fxLeague:'365:42',dt:past.slice(0,16),drawOK:true,settled:false,winner:null,order:1,t:1}},bets:{}},{hash:'#ctrl7',s365});
  A.sandbox.MODE='admin';
  A.sandbox.refresh();
  await tick();
  A.sandbox.aFillResults();
  await tick();await tick();
  const m=A.state.tree.matches.m1;
  eq(m.settled,true,'aFillResults settled the drawn 365 match');
  eq(m.winner,'X','aFillResults 365 draw winner=X (1-1, drawOK)');
}

// ---------- 11. renderAdminMatches: tournament checklist includes Israeli league (routes to 365) ----------
{
  const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{hash:'#ctrl7'});
  A.sandbox.MODE='admin';
  A.sandbox.refresh();
  await tick();
  A.sandbox.renderAdminMatches();
  const h=A.mainHTML();
  ok(h.indexOf('id="fxTourneys"')>=0,'admin matches view has tournament checklist');
  ok(h.indexOf("fxToggleOne('365:42')")>=0,'checklist has Israeli league row (365:42)');
  ok(h.indexOf('ליגת העל')>=0,'checklist row labeled ליגת העל');
  ok(typeof A.sandbox.load365Games==='function','load365Games still available (compat wrapper)');
}

console.log('\n'+(fail===0?'✅':'❌')+' dash365test: '+pass+' passed, '+fail+' failed');
if(fail)process.exit(1);
})();
