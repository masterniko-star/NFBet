const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}

const seed={
  meta:{bank:100,fee:100,cur:'\u20aa',cashSeeded:true},
  players:{
    p1:{name:'Alice',feePaid:true,dep:150,wd:20,t:1,phone:'050-1234567'},
    p2:{name:'Bob',feePaid:true,dep:100,t:2,exited:true,exitedAt:1000,exitBal:73},
    p3:{name:'Carl',feePaid:true,dep:100,t:3}
  },
  matches:{
    m1:{teamA:'TA',teamB:'TB',dt:'2026-06-20T20:00',settled:true,winner:'A',drawOK:false,t:1},
    m2:{teamA:'TC',teamB:'TD',dt:'2026-06-21T20:00',settled:true,winner:'B',drawOK:false,t:2},
    m3:{teamA:'TE',teamB:'TF',dt:'2026-06-30T20:00',settled:false,drawOK:false,t:3}
  },
  bets:{
    m1:{p1:{team:'A',stake:10,t:1},p3:{team:'B',stake:10,t:1}},  // p1 wins (pool 20, only A) -> +10
    m2:{p1:{team:'A',stake:10,t:1},p3:{team:'B',stake:10,t:1}},  // p1 loses -> -10
    m3:{p1:{team:'A',stake:5,t:1}}                                // open (excluded)
  },
  cashlog:{p1:{
    opening:{ts:1,type:'open',amount:100,bal:100,note:'יתרת פתיחה'},
    e2:{ts:2000,type:'in',amount:50,bal:150,note:''},
    e3:{ts:3000,type:'out',amount:20,bal:130,note:''}
  }}
};

const A=loadApp(seed,{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
const sb=A.sandbox;

ok(sb.S.players.length===2&&sb.S.exited.length===1,'split: 2 active, 1 exited');
ok(typeof sb.S.cashlog==='object'&&!!sb.S.cashlog.p1,'cashlog loaded');

// cash rows sorted by ts
const cr=sb.statsCashRows('p1');
ok(cr.length===3,'cashRows: 3 entries');
ok(cr[0].type==='open'&&cr[1].type==='in'&&cr[2].type==='out','cashRows sorted by ts');

// balance rows computed from bets+results
const br=sb.statsBalRows('p1');
ok(br.length===2,'balRows: 2 settled bets (open excluded)');
const m1r=br.find(r=>r.match.indexOf('TA')>=0),m2r=br.find(r=>r.match.indexOf('TC')>=0);
ok(m1r&&m1r.net===10&&m1r.res==='זכה','m1: won, net +10');
ok(m2r&&m2r.net===-10&&m2r.res==='הפסיד','m2: lost, net -10');
ok(m1r.pick==='1','pick mapped A->1');

// balanceOf: active via statsFor, exited via exitBal
ok(Math.round(sb.statsBalanceOf(sb.pById('p1')))===125,'active balance = 125 (got '+sb.statsBalanceOf(sb.pById('p1'))+')');
ok(sb.statsBalanceOf(sb.pById('p2'))===73,'exited balance = exitBal 73');

// report text
const rep=sb.statsReport('p1');
ok(/Alice/.test(rep),'report has name');
ok(/פיקדון/.test(rep)&&/בלנס/.test(rep),'report has both sections');
ok(/הופקד 150/.test(rep),'report cash total in = 150');
ok(/נטו 0/.test(rep),'report bal net = 0 (+10-10)');
ok(/יצא/.test(sb.statsReport('p2')),'exited report tagged (יצא)');

// content html per tab
sb._statsPid='p1'; sb._statsTab='dep';
let h=sb.statsContentHtml();
ok(/srow/.test(h)&&(/הפקדה/.test(h)||/פתיחה/.test(h)),'dep tab html lists entries');
ok(/יתרה: /.test(h),'content shows current balance');
sb._statsTab='bal';
let h2=sb.statsContentHtml();
ok(/TA/.test(h2)&&/srow/.test(h2),'bal tab html lists matches');

// body builds + default pid
sb._statsPid=null;
let body=sb.statsBody();
ok(/statsSel/.test(body)&&/WhatsApp/.test(body),'statsBody has selector + share');
ok(sb._statsPid==='p1','default selected player = first');

// wa phone normalization
ok(sb.statsWaPhone({phone:'050-1234567'})==='972501234567','wa phone local -> 972...');
ok(sb.statsWaPhone({phone:''})==='','wa phone empty -> empty');
ok(sb.statsWaPhone({phone:'+972 50 765 4321'})==='972507654321','wa phone intl normalized');

console.log((fail?'❌':'✅')+' statstest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
