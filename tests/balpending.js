// balpending.js — в טבלה деньги в открытых ставках (pending) показываются «(+N)» зелёным
// в своей выровненной колонке (.hbamt); значок $ убран; сортировка по баланс+pending.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};

// игрок с открытой ставкой 7 на несведённом матче
const A=loadApp({meta:{bank:100,cur:'₪'},
  players:{u:{name:'Better',feePaid:true,dep:100,t:1}},
  matches:{m1:{teamA:'A',teamB:'B',round:'R32',order:1,settled:false,drawOK:false,t:1}},
  bets:{m1:{u:{team:'A',stake:7}}}},{});
A.sandbox.buildState(A.state.tree);
A.sandbox.ME='u';A.sandbox.TAB='all';
A.sandbox.renderAllView();
const html=A.mainHTML()||'';
ok(/<span class="hbamt">\(\+7 ₪\)<\/span>/.test(html),'pending «(+7 ₪)» в своей колонке (.hbamt)');
ok(!/class="hb"/.test(html)&&html.indexOf('$')<0,'значок $ убран');
ok(/class="hbamt">\(\+7 ₪\)<\/span><span class="bal"/.test(html),'pending — отдельная колонка перед балансом');

// без ставки — пустой слот pending (колонка зарезервирована), без скобок
const B=loadApp({meta:{bank:100,cur:'₪'},players:{u:{name:'NoBet',feePaid:true,dep:100,t:1}},matches:{},bets:{}},{});
B.sandbox.buildState(B.state.tree);B.sandbox.ME='u';B.sandbox.renderAllView();
const bh=B.mainHTML()||'';
ok(/<span class="hbamt"><\/span>/.test(bh)&&!/\(\+/.test(bh),'без ставки — пустой слот pending, без скобок');

// сортировка по баланс+pending: тотал важнее голого баланса
const C=loadApp({meta:{bank:100,cur:'₪'},
  players:{a:{name:'Aaa',feePaid:true,dep:100,t:1},b:{name:'Bbb',feePaid:true,dep:104,t:2}},
  matches:{m1:{teamA:'A',teamB:'B',round:'R32',order:1,settled:false,drawOK:false,t:1}},
  bets:{m1:{b:{team:'A',stake:8}}}},{});
C.sandbox.buildState(C.state.tree);
const rk=C.sandbox.ranking();
ok(rk[0].p.id==='b','сортировка по баланс+pending: b (тотал 104) выше a (100), хотя баланс b=96<a=100');

// нумерация в טבלה: реальный (оплативший) — чёрным (var(--tx)); демо — как есть (без инлайн-цвета)
const D=loadApp({meta:{bank:100,cur:'₪'},players:{
  paid:{name:'Paid',feePaid:true,dep:100,t:1},
  demo:{name:'Demo',feePaid:false,dep:0,t:2}},matches:{},bets:{}},{});
D.sandbox.buildState(D.state.tree);D.sandbox.renderAllView();
const dh=D.mainHTML()||'';
ok(/<span class="rk" style="color:var\(--tx\)">/.test(dh),'реальный игрок: номер чёрным (var(--tx))');
ok(/<span class="rk">/.test(dh),'демо-игрок: номер как есть (без инлайн-цвета)');

console.log((fail?'❌':'✅')+' balpending: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
