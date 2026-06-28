const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const has=(s,sub,m)=>ok(s.indexOf(sub)>=0,m+(s.indexOf(sub)<0?' [missing '+sub+']':''));
const hasnt=(s,sub,m)=>ok(s.indexOf(sub)<0,m+(s.indexOf(sub)>=0?' [unexpected '+sub+']':''));
const iso=d=>new Date(Date.now()+d*36e5).toISOString();
function ev(id,h,a,off){return {id:id,date:iso(off),status:{type:{state:'pre',completed:false}},competitions:[{competitors:[
  {homeAway:'home',score:'',team:{displayName:h}},{homeAway:'away',score:'',team:{displayName:a}}]}]};}
(async()=>{
console.log('===== FX SEARCH: exclude already-added + cancel =====');
const seed={meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{},
  matches:{ // 100 & 101 already added
    m100:{round:'R32',order:0,t:1,teamA:'Already1',teamB:'AlreadyA',dt:'',settled:false,winner:null,fx:'espn100'},
    m101:{round:'R32',order:1,t:2,teamA:'Already2',teamB:'AlreadyB',dt:'',settled:false,winner:null,fx:'espn101'}},
  bets:{}};
const espn={events:[
  ev('100','Already1','AlreadyA',1), ev('101','Already2','AlreadyB',2),
  ev('102','Fresh1','FreshA',3), ev('103','Fresh2','FreshB',4), ev('104','Fresh3','FreshC',5)]};
let A=loadApp(seed,{espn});A.sandbox.buildState(A.state.tree);A.sandbox.MODE='admin';
A.sandbox.loadFxGames({slug:'fifa.world',name:'World Cup'}); await flush(40);
const r=A.q('#fxRes').innerHTML;
has(r,'Fresh1','search: fresh match #1 shown');
has(r,'Fresh2','search: fresh match #2 shown');
has(r,'Fresh3','search: fresh match #3 shown');
hasnt(r,'Already1','search: already-added match #1 NOT shown');
hasnt(r,'Already2','search: already-added match #2 NOT shown');
hasnt(r,'כבר נוסף','search: no "already added" tag (filtered out instead)');
has(r,'בטל','search: cancel button present');
// cancel clears results
A.sandbox.aFxCancel();
ok(A.q('#fxRes').innerHTML==='','cancel: clears search results');

console.log('\n===== FX SEARCH: all already added =====');
const seed2={meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{},
  matches:{m100:{round:'R32',order:0,t:1,teamA:'X',teamB:'Y',dt:'',settled:false,winner:null,fx:'espn100'},
           m101:{round:'R32',order:1,t:2,teamA:'X2',teamB:'Y2',dt:'',settled:false,winner:null,fx:'espn101'}},bets:{}};
const espn2={events:[ev('100','X','Y',1),ev('101','X2','Y2',2)]}; // both already added
let B=loadApp(seed2,{espn:espn2});B.sandbox.buildState(B.state.tree);B.sandbox.MODE='admin';
B.sandbox.loadFxGames({slug:'fifa.world',name:'World Cup'}); await flush(40);
has(B.q('#fxRes').innerHTML,'כבר נוספו','all-added: shows "already added" message');
console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
