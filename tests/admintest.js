const {loadApp}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
  players:{p1:{name:'\u05d3\u05e0\u05d9',t:1}},matches:{},bets:{}};

console.log('===== admin gate: #ctrl7 -> admin, otherwise player =====');
ok(loadApp(seed,{hash:'ctrl7'}).sandbox.MODE==='admin','hash "ctrl7" -> MODE=admin');
ok(loadApp(seed,{hash:'#ctrl7'}).sandbox.MODE==='admin','hash "#ctrl7" (leading #) -> MODE=admin');
ok(loadApp(seed,{hash:''}).sandbox.MODE==='player','no hash -> MODE=player');
ok(loadApp(seed,{hash:'admin'}).sandbox.MODE==='player','wrong code -> MODE=player (gate holds)');
ok(loadApp(seed,{hash:'ctrl7x'}).sandbox.MODE==='player','near-miss code -> MODE=player');

console.log('\n===== admin mode renders admin UI =====');
{
  const A=loadApp(seed,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);A.sandbox.TAB='players';A.sandbox.renderActive();
  const main=(A.q('#main')||{}).innerHTML||'';
  ok(main.indexOf('\u05d4\u05d3\u05d1\u05e7 \u05e8\u05e9\u05d9\u05de\u05d4')>=0,'admin players view rendered (bulk-add button)');
  ok(main.indexOf('\u05e9\u05d5\u05dc\u05dd')>=0,'admin-only "שולם" paid checkbox present');
}

console.log('\n===== player mode: no admin leakage =====');
{
  const A=loadApp(seed,{hash:''});A.sandbox.buildState(A.state.tree);A.sandbox.renderActive(); // no ME -> identify screen
  const main=(A.q('#main')||{}).innerHTML||'';
  ok(main.indexOf('\u05e9\u05d5\u05dc\u05dd')<0,'player view has NO admin "שולם" checkbox');
}

console.log('\n===== participant row: field+החל money UI =====');
{
  const A=loadApp(seed,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);A.sandbox.TAB='players';A.sandbox.renderActive();
  const main=(A.q('#main')||{}).innerHTML||'';
  ok(/class="p-collrow"/.test(main)&&/id="pexp-p1"/.test(main),'row = collapsed row (p-collrow) + expandable card (pexp)');
  ok(/class="bf"/.test(main)&&/id="bf-p1"/.test(main),'collapsed row has bf input field id=bf-{id}');
  ok(main.indexOf('החל')>=0&&/aApply\('p1'\)/.test(main),'expanded card has החל apply button (aApply)');
  ok(!/am-step/.test(main)&&main.indexOf('הוסף ₪')<0,'old stepper [− + הוסף ₪] gone');
  ok((main.match(/הקלד סכום ולחץ/g)||[]).length===0,'addinfo instruction line removed');
}

console.log('\n===== money model: check=deposit, החל=±, uncheck=zero =====');
function freshPaidNo(){const A=loadApp(seed,{hash:'ctrl7'});A.state.tree.players.p1.feePaid=false;A.sandbox.buildState(A.state.tree);A.sandbox.TAB='players';A.sandbox.renderActive();return A;}
// check + empty field => NO auto-deposit, not paid (red prompt instead)
{
  const A=freshPaidNo();A.q('#bf-p1').value='';
  A.sandbox.aToggleFee('p1');A.sandbox.buildState(A.state.tree);
  const p=A.state.tree.players.p1;
  ok(p.feePaid===false&&!(p.dep>0),'check + empty => NOT paid, no deposit (feePaid='+p.feePaid+', dep='+p.dep+')');
}
// check + field 250 => deposit 250, field cleared
{
  const A=freshPaidNo();A.q('#bf-p1').value='250';
  A.sandbox.aToggleFee('p1');A.sandbox.buildState(A.state.tree);
  const p=A.state.tree.players.p1;
  ok(p.feePaid===true&&p.dep===250,'check + 250 => dep=250 (got '+p.dep+')');
  ok(A.q('#bf-p1').value==='','  field cleared after check');
  ok(A.sandbox.statsFor('p1').balance===250,'  balance=250');
}
// already paid: +50 via החל => dep+50, wd untouched; then -30 => wd+30 dep unchanged; then uncheck => zero
{
  const A=loadApp(seed,{hash:'ctrl7'});A.state.tree.players.p1.feePaid=true;A.state.tree.players.p1.dep=250;A.state.tree.players.p1.wd=0;A.sandbox.buildState(A.state.tree);A.sandbox.TAB='players';A.sandbox.renderActive();
  A.q('#bf-p1').value='50';A.sandbox.aApply('p1');A.sandbox.buildState(A.state.tree);
  const p=A.state.tree.players.p1;
  ok(p.dep===300&&(p.wd||0)===0,'+50 => dep 250->300, wd=0 (got dep='+p.dep+' wd='+(p.wd||0)+')');
  ok(A.sandbox.statsFor('p1').balance===300,'  balance=300');
  ok(A.q('#bf-p1').value==='','  field cleared after החל (+)');
  // -30 via החל => wd+30, dep UNCHANGED (введено не трогаем, выводим из программы)
  A.q('#bf-p1').value='-30';A.sandbox.aApply('p1');A.sandbox.buildState(A.state.tree);
  const p2=A.state.tree.players.p1;
  ok(p2.dep===300&&p2.wd===30,'-30 => dep stays 300, wd 0->30 (got dep='+p2.dep+' wd='+p2.wd+')');
  ok(A.sandbox.statsFor('p1').balance===270,'  balance=270 (dep-wd)');
  // uncheck => everything zero
  A.sandbox.aToggleFee('p1');A.sandbox.buildState(A.state.tree);
  const p3=A.state.tree.players.p1;
  ok(p3.feePaid===false&&p3.dep===0&&(p3.wd||0)===0,'uncheck => feePaid=false, dep=0, wd=0');
  ok(A.sandbox.statsFor('p1').balance===0,'  balance=0');
}


// master "all" row: הכל label + visible שולם checkbox on the right, p-fill spacer (two-row layout)
{
  const seed2={meta:{bank:100,cur:'\u20aa'},players:{p1:{name:'A',t:1},p2:{name:'B',t:2},p3:{name:'C',t:3}}};
  const A=loadApp(seed2,{hash:'ctrl7'});
  A.state.tree.players.p1.feePaid=true; // p2,p3 unpaid -> mixed
  A.sandbox.buildState(A.state.tree);A.sandbox.TAB='players';A.sandbox.renderActive();
  const H=()=>A.q('#main').innerHTML;
  const h=H();
  ok(/class="p-allhead"/.test(h),'master "all" header row present');
  ok(/class="pname allname"[^>]*>הכל</.test(h),'  master row labeled הכל');
  ok(/p-allhead[\s\S]*?<span>שולם<\/span>/.test(h),'  master row shows visible שולם label next to checkbox');
  ok(/p-allhead[\s\S]*?<span class="p-fill">/.test(h),'  master row uses p-fill spacer (two-row layout)');
  const mcb=()=>{const m=H().match(/p-allhead[\s\S]*?<div class="checkbox ([^"]*)"/);return m?m[1].trim():'?';};
  ok(mcb()==='','  mixed state -> master unchecked');
  A.sandbox.aMarkAllPaid();A.sandbox.buildState(A.state.tree);A.sandbox.renderActive();
  ok(['p1','p2','p3'].every(id=>A.state.tree.players[id].feePaid),'click master -> all marked paid');
  ok(mcb()==='on','  master now checked (all paid)');
  A.sandbox.aMarkAllPaid();A.sandbox.buildState(A.state.tree);A.sandbox.renderActive();
  ok(['p1','p2','p3'].every(id=>!A.state.tree.players[id].feePaid),'click master again -> all unpaid');
}

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
