const {loadApp}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const now=Date.now();
const dt=h=>{const d=new Date(now+h*36e5);const p=n=>(n<10?'0':'')+n;return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());};
// orders: u0 (unsettled, order0), s1 (settled 2h ago, order1), u2 (unsettled order2), s3 (settled 100h ago=expired, order3), s4(settled 5h ago order4)
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},players:{},
  matches:{
    u0:{round:'R32',order:0,t:0,teamA:'Ua',teamB:'Ub',dt:dt(5),settled:false,winner:null},
    s1:{round:'R32',order:1,t:1,teamA:'Sa',teamB:'Sb',dt:dt(-2),settled:true,winner:'A'},
    u2:{round:'R32',order:2,t:2,teamA:'Va',teamB:'Vb',dt:dt(10),settled:false,winner:null},
    s3old:{round:'R32',order:3,t:3,teamA:'Oa',teamB:'Ob',dt:dt(-100),settled:true,winner:'A'},
    s4:{round:'R32',order:4,t:4,teamA:'Ra',teamB:'Rb',dt:dt(-5),settled:true,winner:'B'}
  },bets:{}};
let A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);A.sandbox.MODE='admin';A.sandbox.TAB='matches';A.sandbox.renderActive();
const h=A.mainHTML();
// expired (>72h) hidden
ok(h.indexOf('amc-s3old')<0,'72h: settled match >72h old auto-hidden from admin list');
ok(h.indexOf('Oa')<0,'72h: its teams not rendered');
// non-expired settled shown
ok(h.indexOf('amc-s1')>=0 && h.indexOf('amc-s4')>=0,'recent settled (<72h) still shown');
// unsettled shown
ok(h.indexOf('amc-u0')>=0 && h.indexOf('amc-u2')>=0,'unsettled shown');
// ordering: settled (s1,s4) appear BEFORE unsettled (u0,u2) in DOM
const pos=id=>h.indexOf('amc-'+id);
ok(pos('s1')<pos('u0') && pos('s1')<pos('u2'),'finished float UP: settled s1 before unsettled');
ok(pos('s4')<pos('u0'),'finished float UP: settled s4 before unsettled u0');
// within settled, by order: s1(order1) before s4(order4)
ok(pos('s1')<pos('s4'),'settled block ordered by order (s1 before s4)');
// within unsettled, by order: u0 before u2
ok(pos('u0')<pos('u2'),'unsettled block ordered by order (u0 before u2)');
// adminExpired unit
ok(A.sandbox.adminExpired(A.sandbox.S.matches.find(m=>m.id==='s3old'))===true,'adminExpired true for >72h');
ok(A.sandbox.adminExpired(A.sandbox.S.matches.find(m=>m.id==='s1'))===false,'adminExpired false for <72h');
ok(A.sandbox.adminExpired(A.sandbox.S.matches.find(m=>m.id==='u0'))===false,'adminExpired false for unsettled');
// scrollAdminToFirstUnfinished: should pick first unsettled by order (u0) and not throw
let serr=null;try{A.sandbox.scrollAdminToFirstUnfinished();}catch(e){serr=e;}
ok(!serr,'scrollAdminToFirstUnfinished runs without throw');
// history/standings still see expired match (not deleted from data)
ok(!!A.state.tree.matches.s3old && A.sandbox.S.matches.some(m=>m.id==='s3old'),'72h-hidden match still in data (history/standings intact)');
console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
