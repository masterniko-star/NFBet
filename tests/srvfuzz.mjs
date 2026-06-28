// srvfuzz.mjs — СЛУЧАЙНАЯ сверка: серверный calcMatch (check-results.mjs) и клиентский calcMatch (current.html)
// дают ИДЕНТИЧНЫЕ pool/sumA/sumB/sumX/payouts/refunded на одних и тех же раскладах. Ловит дрейф двух копий логики.
import { loadApp } from './applib.js';
const srv = await import('../netlify/functions/check-results.mjs');
let tests=0,fails=0;
const ok=(c,m)=>{tests++;if(!c){fails++;if(fails<=25)console.log('FAIL:',m);}};
function mk(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function ri(r,a,b){return a+Math.floor(r()*(b-a+1));}

const A=loadApp({meta:{bank:100},players:{},matches:{},bets:{}});
const cli=A.sandbox;
const TRIALS=4000; let worst=0;

for(let T=0;T<TRIALS;T++){
  const r=mk(7000+T*40503);
  const N=ri(r,0,8);
  const wins=['A','B','X','VOID'];
  const winner=wins[ri(r,0,3)];
  const bets={};
  for(let i=0;i<N;i++){const team=['A','B','X'][ri(r,0,2)];bets['p'+i]={team,stake:ri(r,1,10)};}
  // server
  const sc=srv.calcMatch({winner},bets);
  // client (тот же матч, settled=true чтобы посчитать выплаты)
  cli.buildState({players:{},matches:{m1:{teamA:'A',teamB:'B',round:'R32',settled:true,winner,drawOK:true}},bets:{m1:bets}});
  const cc=cli.calcMatch(cli.S.matches[0]);
  // сверка
  ok(Math.abs(sc.pool-cc.pool)<1e-9,'pool равен (T'+T+' w='+winner+')');
  ok(sc.sumA===cc.sumA&&sc.sumB===cc.sumB&&sc.sumX===cc.sumX,'sumA/B/X равны (T'+T+')');
  ok((!!sc.refunded)===(!!cc.refunded),'refunded равен (T'+T+' s='+sc.refunded+' c='+cc.refunded+')');
  let payOK=true,maxd=0;
  const keys=new Set([...Object.keys(sc.payouts),...Object.keys(cc.payouts)]);
  for(const k of keys){const a=sc.payouts[k]||0,b=cc.payouts[k]||0;const d=Math.abs(a-b);if(d>maxd)maxd=d;if(d>1e-9)payOK=false;}
  if(maxd>worst)worst=maxd;
  ok(payOK,'payouts идентичны (T'+T+' w='+winner+' N='+N+')');
}
console.log('worst payout diff server-vs-client:',worst);
if(fails)console.log('srvfuzz FAILED '+fails+'/'+tests);
else console.log('\u2705 srvfuzz: '+tests+' passed, 0 failed ('+TRIALS+' случайных сверок server==client)');
