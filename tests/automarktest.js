const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}

const seed={
  meta:{bank:100,cur:'\u20aa'},
  players:{p1:{name:'A',feePaid:true,dep:100,t:1},p2:{name:'B',feePaid:true,dep:100,t:2},p3:{name:'C',feePaid:true,dep:100,t:3}},
  matches:{m1:{teamA:'TA',teamB:'TB',dt:'2026-06-20T20:00',settled:true,winner:'A',order:1,t:1}},
  bets:{m1:{
    p1:{team:'A',stake:5},            // real bet on A
    p2:{team:'A',stake:1,auto:true},  // AUTO on A
    p3:{team:'B',stake:3}             // real on B
  }}
};
const A=loadApp(seed,{hash:'ctrl7'}); A.sandbox.buildState(A.state.tree);
const m=A.sandbox.S.matches.find(x=>x.id==='m1');
const html=A.sandbox.matchCard(m);
ok(/2 ניחשו/.test(html),'team A shows 2 bettors total');
ok(/\(1🤖\)/.test(html),'team A shows (1🤖) auto marker');
ok(/1 ניחשו/.test(html),'team B shows 1 bettor');
ok((html.match(/🤖/g)||[]).length===1,'exactly one auto marker (team A only)');
ok(/mauto/.test(html),'uses .mauto class');

// no auto-bets -> no marker
const seed2={meta:{bank:100,cur:'\u20aa'},players:{p1:{name:'A',feePaid:true,dep:100,t:1}},matches:{m1:{teamA:'TA',teamB:'TB',settled:false,order:1,t:1}},bets:{m1:{p1:{team:'A',stake:5}}}};
const B=loadApp(seed2,{hash:'ctrl7'}); B.sandbox.buildState(B.state.tree);
const html2=B.sandbox.matchCard(B.sandbox.S.matches.find(x=>x.id==='m1'));
ok(!/🤖/.test(html2),'no auto marker when no auto-bets');
ok(/1 ניחשו/.test(html2),'plain count still shown');

console.log((fail?'❌':'✅')+' automarktest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
