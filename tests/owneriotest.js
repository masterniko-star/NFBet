const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
(async()=>{
function allView(meId){
  let A=loadApp({meta:{bank:100},players:{
    n:{name:'ניקולאי פלדמן',feePaid:true,dep:100},
    a:{name:'דנה לוי',feePaid:true,dep:100}}},{hash:''});
  A.sandbox.buildState(A.state.tree);
  A.sandbox.ME=meId;A.sandbox.TAB='all';A.sandbox.renderAllView();
  return {h:A.q('#main').innerHTML,own:A.sandbox.isOwnerView()};
}
let o=allView('n');
ok(o.own===true,'isOwnerView true for ניקולאי פלדמן');
ok(/📥/.test(o.h)&&/📤/.test(o.h),'owner: deposit/withdraw arrows visible');
ok(!/lbwrap noio/.test(o.h),'owner: full 7-col grid (no noio class)');
let p=allView('a');
ok(p.own===false,'isOwnerView false for a normal participant');
ok(!/📥/.test(p.h)&&!/📤/.test(p.h),'participant: deposit/withdraw arrows HIDDEN');
ok(/lbwrap noio/.test(p.h),'participant: 5-col noio grid (alignment preserved)');
// second Niko account also owner
let A2=loadApp({meta:{bank:100},players:{n2:{name:'ניקולאי פלדמן 2',feePaid:true,dep:100}}},{hash:''});
A2.sandbox.buildState(A2.state.tree);A2.sandbox.ME='n2';
ok(A2.sandbox.isOwnerView()===true,'ניקולאי פלדמן 2 is also owner');
// admin mode is owner
let adm=loadApp({meta:{bank:100},players:{a:{name:'דנה לוי',feePaid:true,dep:100}}},{hash:'ctrl7'});
adm.sandbox.buildState(adm.state.tree);
ok(adm.sandbox.isOwnerView()===true,'admin mode is owner too');

// колонка (+N) (ожидающие ставки) выровнена по ПРАВОЙ скобке (text-align:right), а не по левой
const _src=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
ok(/\.lb \.hbamt\{[^}]*text-align:right/.test(_src),'таблица: колонка (+N) выровнена по правой скобке (text-align:right)');
ok(!/\.lb \.hbamt\{[^}]*text-align:left/.test(_src),'нет старого text-align:left у .hbamt (регрессия выравнивания)');
// (+N) реально рендерится для игрока с открытой ставкой
let pend=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},
  players:{a:{name:'דנה לוי',feePaid:true,dep:100}},
  matches:{m1:{teamA:'H',teamB:'A',round:'R32',order:1,settled:false,t:1}},
  bets:{m1:{a:{team:'A',stake:5}}}},{hash:'ctrl7'});
pend.sandbox.buildState(pend.state.tree);pend.sandbox.ME='a';pend.sandbox.TAB='all';pend.sandbox.renderAllView();
ok(/hbamt">\(\+5\)/.test(pend.q('#main').innerHTML||''),'открытая ставка ₪5 -> (+5) в колонке hbamt');

console.log((fail?'❌':'✅')+' owneriotest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
