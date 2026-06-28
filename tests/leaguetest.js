const {loadApp}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},players:{},matches:{},bets:{}};
const A=loadApp(seed,{});const S=A.sandbox;
const res=(q)=>{var a=S.fxAlias(S.fxNorm(q));return a?a.slug:null;};
console.log('===== new leagues resolve to correct ESPN slugs =====');
[['ישראל','365:42'],['ליגת העל','365:42'],['israeli premier league','365:42'],['израиль','365:42'],
 ['ברזיל','bra.1'],['brasileirao','bra.1'],['бразилия','bra.1'],['campeonato brasileiro','bra.1'],
 ['פורטוגל','por.1'],['primeira liga','por.1'],['liga portugal','por.1'],['португалия','por.1']
].forEach(function(t){ok(res(t[0])===t[1],'"'+t[0]+'" -> '+t[1]+' (got '+res(t[0])+')');});
console.log('\n===== existing top-5 still resolve (no collision) =====');
[['premier league','eng.1'],['апл','eng.1'],['la liga','esp.1'],['serie a','ita.1'],['серия а','ita.1'],
 ['bundesliga','ger.1'],['ligue 1','fra.1'],['מונדיאל','fifa.world'],['ליגת האלופות','uefa.champions']
].forEach(function(t){ok(res(t[0])===t[1],'"'+t[0]+'" -> '+t[1]+' (got '+res(t[0])+')');});
console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
