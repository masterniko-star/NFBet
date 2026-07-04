// balcharttest.js — график баланса на странице טבלה (клик по имени → SVG-график).
// Проверяет: balSeriesPts (порядок по времени, накопление, in/out/zero, нетто сведённых игр),
// balSparkHtml (заглушка <2 точек, зелёный/красный по итогу, подписи min/max, SVG),
// интеграцию в renderAllView (lbToggle на имени, lbexp скрыт по умолчанию, клик по графику сворачивает),
// автооткрытие СВОЕГО графика при первом входе (localStorage lbFirstSeen, ровно один раз),
// и ИНВАРИАНТ на фаззе: последняя точка серии == statsFor.balance + statsFor.pending.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
const J=x=>JSON.stringify(x);

// матчи без dt -> время события = m.t (управляемый порядок)
const seed={
  meta:{fee:100,bank:100,cur:'₪'},
  players:{
    p1:{name:'Alpha',feePaid:true,dep:100,t:1},
    p2:{name:'Beta',feePaid:true,dep:100,t:2},
    p3:{name:'Gamma',feePaid:true,dep:100,t:3},
    p4:{name:'Delta',feePaid:true,dep:100,t:4},   // нет cashlog и ставок -> нет графика
    p5:{name:'Echo',feePaid:true,dep:100,t:5},    // одна точка -> нет графика
    p6:{name:'Zeta',feePaid:true,dep:100,t:6},    // события в cashlog не по порядку ts
    p7:{name:'Eta',feePaid:true,dep:100,t:7}      // zero-событие обнуляет
  },
  matches:{m1:{teamA:'TA',teamB:'TB',settled:true,winner:'B',order:1,t:2000}},
  bets:{m1:{p1:{team:'A',stake:10},p3:{team:'A',stake:10},p2:{team:'B',stake:10}}},
  cashlog:{
    p1:{e1:{ts:1000,type:'in',amount:100},e2:{ts:3000,type:'out',amount:30}},
    p2:{e1:{ts:1500,type:'in',amount:100}},
    p3:{e1:{ts:1200,type:'in',amount:100}},
    p5:{e1:{ts:1000,type:'in',amount:100}},
    p6:{a:{ts:5000,type:'in',amount:50},b:{ts:100,type:'in',amount:10}},
    p7:{e1:{ts:1000,type:'in',amount:100},e2:{ts:2500,type:'zero',amount:100},e3:{ts:3000,type:'in',amount:40}}
  }
};

console.log('===== balSeriesPts: точки серии =====');
const A=loadApp(seed,{}); A.sandbox.buildState(A.state.tree);
// m1: pool=30, победил B (ставка p2=10) -> выплата p2=30 (нетто +20); p1/p3 теряют по 10
ok(J(A.sandbox.balSeriesPts('p1'))===J([100,90,60]),'p1: депозит 100 -> проигрыш -10 -> вывод -30 = [100,90,60]');
ok(J(A.sandbox.balSeriesPts('p2'))===J([100,120]),'p2: депозит 100 -> выигрыш +20 = [100,120]');
ok(J(A.sandbox.balSeriesPts('p3'))===J([100,90]),'p3: депозит 100 -> проигрыш -10 = [100,90]');
ok(J(A.sandbox.balSeriesPts('p4'))===J([]),'p4: нет событий -> пустая серия');
ok(J(A.sandbox.balSeriesPts('p6'))===J([10,60]),'p6: события сортируются по ts, не по порядку ключей');
ok(J(A.sandbox.balSeriesPts('p7'))===J([100,0,40]),'p7: zero-событие обнуляет баланс');

console.log('===== balSparkHtml: SVG и подписи =====');
const s1=A.sandbox.balSparkHtml('p1');
ok(s1.indexOf('<svg')>=0&&s1.indexOf('viewBox="0 0 320 76"')>=0,'график = SVG 320x76');
ok(s1.indexOf('#d64545')>=0&&s1.indexOf('#178a4c')<0,'итог вниз (100->60) -> красный');
ok(s1.indexOf('>100 ₪</span>')>=0&&s1.indexOf('>60 ₪</span>')>=0,'подписи max=100 и min=60 с валютой');
const s2=A.sandbox.balSparkHtml('p2');
ok(s2.indexOf('#178a4c')>=0&&s2.indexOf('#d64545')<0,'итог вверх (100->120) -> зелёный');
ok(s2.indexOf('>120 ₪</span>')>=0&&s2.indexOf('>100 ₪</span>')>=0,'подписи max=120 и min=100');
ok(s2.indexOf('vector-effect="non-scaling-stroke"')>=0,'линия не искажается при растяжении');
const emp='אין מספיק נתונים לגרף';
ok(A.sandbox.balSparkHtml('p4').indexOf(emp)>=0,'0 точек -> заглушка вместо графика');
ok(A.sandbox.balSparkHtml('p5').indexOf(emp)>=0,'1 точка -> заглушка вместо графика');

console.log('===== renderAllView: раскрытие по клику, автооткрытие один раз =====');
A.sandbox.ME='p1';
A.sandbox.renderAllView();
let html=A.mainHTML();
ok(/class="nm" onclick="lbToggle\('p1'\)"/.test(html),'клик по имени вызывает lbToggle');
ok(/id="lbx-p1" onclick="lbToggle\('p1'\)">/.test(html),'первый вход: СВОЙ график открыт (без display:none)');
ok(/id="lbx-p2" onclick="lbToggle\('p2'\)" style="display:none"/.test(html),'чужой график закрыт');
ok(A.sandbox.localStorage.getItem('lbFirstSeen')==='1','флаг первого входа записан');
ok(html.indexOf('lbchart')>=0,'внутри lbexp отрисован график');
A.sandbox.lbToggle('p1');
ok(A.sandbox.lbOpen.p1===false,'lbToggle сворачивает (клик по графику/имени)');
A.sandbox.renderAllView();html=A.mainHTML();
ok(/id="lbx-p1" onclick="lbToggle\('p1'\)" style="display:none"/.test(html),'после закрытия НЕ открывается заново (один раз)');
A.sandbox.lbToggle('p3');A.sandbox.renderAllView();html=A.mainHTML();
ok(/id="lbx-p3" onclick="lbToggle\('p3'\)">/.test(html),'ручное открытие чужого графика работает');
// без входа (ME=null) — ничего не открываем и флаг не пишем
const B=loadApp(seed,{}); B.sandbox.buildState(B.state.tree); B.sandbox.renderAllView();
ok(B.sandbox.localStorage.getItem('lbFirstSeen')===null,'без входа флаг lbFirstSeen не пишется');
ok(!/id="lbx-p1" onclick="lbToggle\('p1'\)">/.test(B.mainHTML()),'без входа все графики закрыты');

console.log('===== ФАЗЗ-ИНВАРИАНТ: последняя точка == balance+pending =====');
let lcg=123456789;
const rnd=n=>{lcg=(lcg*1103515245+12345)%2147483648;return lcg%n;};
const F=loadApp({meta:{bank:100,cur:'₪'}},{});
let bad=0;
for(let it=0;it<150;it++){
  const tree={meta:{bank:100,cur:'₪'},players:{},matches:{},bets:{},cashlog:{}};
  let ts=1;
  ['p1','p2','p3'].forEach(p=>{
    const d0=50+rnd(100);let dep=d0,wd=0;
    tree.cashlog[p]={c0:{ts:ts++,type:'in',amount:d0}};
    const extra=rnd(3);
    for(let k=0;k<extra;k++){
      if(rnd(2)){const a=1+rnd(50);dep+=a;tree.cashlog[p]['x'+k]={ts:ts++,type:'in',amount:a};}
      else{const a=1+rnd(20);wd+=a;tree.cashlog[p]['x'+k]={ts:ts++,type:'out',amount:a};}
    }
    tree.players[p]={name:p,feePaid:true,dep:dep,wd:wd,t:1};
  });
  const nm=1+rnd(4);
  for(let j=0;j<nm;j++){
    const id='m'+j;const settled=rnd(3)>0;
    tree.matches[id]={teamA:'A'+j,teamB:'B'+j,settled:settled,order:j+1,t:ts++,drawOK:true};
    if(settled)tree.matches[id].winner=['A','B','X','VOID'][rnd(4)];
    tree.bets[id]={};
    ['p1','p2','p3'].forEach(p=>{if(rnd(4)>0)tree.bets[id][p]={team:['A','B','X'][rnd(3)],stake:1+rnd(10)};});
  }
  F.state.tree=tree;F.sandbox.buildState(F.state.tree);
  ['p1','p2','p3'].forEach(p=>{
    const pts=F.sandbox.balSeriesPts(p);
    const last=pts.length?pts[pts.length-1]:0;
    const st=F.sandbox.statsFor(p);
    if(last!==st.balance+st.pending){bad++;if(bad<4)console.log('  FAIL: it='+it+' '+p+' series='+last+' balance+pending='+(st.balance+st.pending));}
  });
}
ok(bad===0,'фазз 150x3: последняя точка серии == balance+pending (расхождений: '+bad+')');

console.log((fail?'❌':'✅')+' balcharttest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
