const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const has=(s,sub,m)=>ok(s.indexOf(sub)>=0,m+(s.indexOf(sub)<0?' [missing '+sub+']':''));
const localHHMM=off=>{const d=new Date(Date.now()+off*60000);const p=n=>(n<10?'0':'')+n;return p(d.getHours())+':'+p(d.getMinutes());};
const J=x=>JSON.stringify(x);
// new model: autocfg = {results,newgames}, each {on,after:[min],times:[HH:MM],last}. invalid filtered.
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'\u20aa'},players:{},matches:{},bets:{},
  autocfg:{results:{on:true,after:[180,'x',-5,5.4],times:['14:00','bad','25:99','08:00'],last:555},newgames:{on:false,after:[210],times:['20:00'],last:222}}};
(async()=>{
let A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);
const S=A.sandbox.S;
console.log('===== buildState parses new autocfg (filters invalid) =====');
ok(S.autocfg.results.on===true,'results.on parsed');
ok(J(S.autocfg.results.after)===J([180,5]),'results.after filters bad/neg, rounds ('+S.autocfg.results.after.join(',')+')');
ok(J(S.autocfg.results.times)===J(['14:00','08:00']),'results.times filters invalid ('+S.autocfg.results.times.join(',')+')');
ok(S.autocfg.newgames.on===false,'newgames.on=false parsed');
ok(J(S.autocfg.newgames.times)===J(['20:00']),'newgames.times parsed');
ok(S.autocfg.results.last===555&&S.autocfg.newgames.last===222,'last preserved per subsystem');

console.log('\n===== acParse (pure helper) =====');
ok(A.sandbox.acParse('09:30')===570,'acParse 09:30=570');
ok(A.sandbox.acParse('99:00')===null,'acParse invalid -> null');

console.log('\n===== hmToMin / minToHm (Ч:ММ offsets) =====');
ok(A.sandbox.hmToMin('0:05')===5&&A.sandbox.hmToMin('3:30')===210&&A.sandbox.hmToMin('15:30')===930,'hmToMin parses durations');
ok(A.sandbox.hmToMin('24:00')===null&&A.sandbox.hmToMin('3:60')===null,'hmToMin rejects invalid');
ok(A.sandbox.minToHm(5)==='00:05'&&A.sandbox.minToHm(210)==='03:30'&&A.sandbox.minToHm(930)==='15:30','minToHm formats');

console.log('\n===== settings UI renders two dashboards =====');
A.sandbox.MODE='admin';A.sandbox.renderSettings();
const h=A.mainHTML();
has(h,'בדיקת תוצאות','results dashboard title');
has(h,'טעינת משחקים','newgames dashboard title');
has(h,'id="ac_results_on"','results on/off toggle');
has(h,'id="ac_newgames_on"','newgames on/off toggle');
has(h,'id="acAfter_results"','results offset editor');
has(h,'בדיקת תוצאות + 5','newgames panel shows derived (results+5) note');
ok(h.indexOf('id="acTimes_newgames"')<0,'newgames has NO independent times editor (derived from results+5)');
has(h,'acDashSave','save buttons');
ok(J(A.sandbox.ac2.results.after)===J([180,5]),'ac2.results.after seeded from config');
ok(J(A.sandbox.ac2.newgames.times)===J(['20:00']),'ac2.newgames.times seeded');

console.log('\n===== acDashStatus =====');
ok(/מופעל/.test(A.sandbox.acDashStatus('results')),'status results on -> מופעל');
ok(A.sandbox.acDashStatus('results').indexOf('180')>=0,'status shows offset 180 as minutes');
ok(/כבוי/.test(A.sandbox.acDashStatus('newgames')),'status newgames off -> כבוי');

console.log('\n===== chip add / edit / del =====');
A.sandbox.ac2.results={after:[180],times:['08:00']};
A.q('#acAfterNew_results').value='5';A.sandbox.acAfterAdd('results');
ok(J(A.sandbox.ac2.results.after)===J([5,180]),'acAfterAdd adds+sorts (5 min)');
A.sandbox.acAfterEdit('results',0,'60');ok(A.sandbox.ac2.results.after[0]===60,'acAfterEdit ->60 min');
A.sandbox.acAfterEdit('results',0,'abc');ok(A.sandbox.ac2.results.after[0]===60,'acAfterEdit ignores invalid');
A.sandbox.acAfterDel('results',0);ok(J(A.sandbox.ac2.results.after)===J([180]),'acAfterDel removes');
A.q('#acTimesNew_results').value='21:30';A.sandbox.acTimesAdd('results');
ok(J(A.sandbox.ac2.results.times)===J(['08:00','21:30']),'acTimesAdd adds+sorts');
A.q('#acTimesNew_results').value='bad';A.sandbox.acTimesAdd('results');
ok(J(A.sandbox.ac2.results.times)===J(['08:00','21:30']),'acTimesAdd rejects invalid');
A.sandbox.acTimesDel('results',0);ok(J(A.sandbox.ac2.results.times)===J(['21:30']),'acTimesDel removes');

console.log('\n===== acDashToggle =====');
A.sandbox.ac2Open.results=false;A.sandbox.acDashToggle('results');ok(A.sandbox.ac2Open.results===true,'toggle opens results');
A.sandbox.acDashToggle('results');ok(A.sandbox.ac2Open.results===false,'toggle closes results');

console.log('\n===== acDashSave writes /autocfg/<kind>, preserves last, independent =====');
A.state.tree.autocfg={results:{on:true,after:[180],times:[],last:555},newgames:{on:false,after:[210],times:['20:00'],last:222}};
A.sandbox.buildState(A.state.tree);A.sandbox.renderSettings();
A.sandbox.ac2.results={after:[5,180],times:['07:30']};A.q('#ac_results_on').checked=true;
A.sandbox.acDashSave('results');await flush(20);
ok(A.state.tree.autocfg.results.on===true&&J(A.state.tree.autocfg.results.after)===J([5,180])&&J(A.state.tree.autocfg.results.times)===J(['07:30']),'saved results on/after/times');
ok(A.state.tree.autocfg.results.last===555,'acDashSave preserves results.last (PATCH)');
ok(A.state.tree.autocfg.newgames.on===false&&A.state.tree.autocfg.newgames.last===222,'newgames untouched by results save');
A.q('#ac_newgames_on').checked=true;
A.sandbox.acDashSave('newgames');await flush(20);
ok(A.state.tree.autocfg.newgames.on===true,'newgames save toggles on');
ok(J(A.state.tree.autocfg.newgames.times)===J(['20:00']),'newgames save does NOT overwrite times (derived from results+5)');
ok(A.state.tree.autocfg.newgames.last===222,'acDashSave preserves newgames.last');

console.log('\n===== clientAutoTick present (gate on results.on) =====');
ok(typeof A.sandbox.clientAutoTick==='function','clientAutoTick present');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
