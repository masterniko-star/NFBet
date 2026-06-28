// moneyfuzz.js — тысячи СЛУЧАЙНЫХ раскладов (игроки/матчи/ставки/исходы) против ЖИВОГО calcMatch/statsFor/availFor/ranking из current.html.
// Инварианты: Σвыплат==касса (несведённый refund — точная ставка), Σбаланс+Σpending==N*банк, availFor исключает матч, ranking корректен.
const {loadApp}=require('./applib.js');
let tests=0,fails=0;
const ok=(c,m)=>{tests++;if(!c){fails++;if(fails<=25)console.log('FAIL:',m);}};
function mk(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function ri(r,a,b){return a+Math.floor(r()*(b-a+1));}

const A=loadApp({meta:{bank:100,fee:100,minBet:1,maxBet:10,cur:'\u20aa'},players:{},matches:{},bets:{}});
if(A.bootErr){console.log('BOOT ERROR',A.bootErr);process.exit(1);}
const S=A.sandbox;
const BANK=100, TRIALS=3000;
let worstPay=0, worstCons=0, settledSeen=0, refundSeen=0, voidSeen=0;

for(let T=0;T<TRIALS;T++){
  const r=mk(1000+T*2654435761);
  const N=ri(r,1,10), M=ri(r,0,9);
  const tree={meta:{bank:BANK,fee:100,minBet:1,maxBet:10,cur:'\u20aa'},players:{},matches:{},bets:{}};
  const pids=[];
  for(let i=0;i<N;i++){const id='p'+i;pids.push(id);tree.players[id]={name:'P'+i,t:i};}
  for(let j=0;j<M;j++){
    const mid='m'+j, drawOK=r()<0.4, settled=r()<0.7;
    let winner=null;
    if(settled){const opts=drawOK?['A','B','X','VOID']:['A','B','VOID'];winner=opts[ri(r,0,opts.length-1)];}
    tree.matches[mid]={round:'R32',order:j,teamA:'A'+j,teamB:'B'+j,drawOK:drawOK,settled:settled,winner:winner,t:j};
    tree.bets[mid]={};
    for(const id of pids){
      if(r()<0.45)continue;
      const sides=drawOK?['A','B','X']:['A','B'];
      tree.bets[mid][id]={team:sides[ri(r,0,sides.length-1)],stake:ri(r,1,10),t:j};
    }
  }
  S.buildState(tree);
  const matches=S.S.matches, players=S.S.players;

  // --- per-match: касса==Σставок; Σвыплат==касса (или точный возврат) ---
  for(const m of matches){
    const b=m.bets||{}; let sumStake=0; for(const k in b)sumStake+=Number(b[k].stake)||0;
    const c=S.calcMatch(m);
    ok(Math.abs(c.pool-sumStake)<1e-6,'касса==Σставок (m'+m.id+' T'+T+')');
    if(!m.settled){ok(Object.keys(c.payouts).length===0,'до сведения нет выплат (T'+T+')');continue;}
    settledSeen++;
    let sumPay=0; for(const k in b)sumPay+=(c.payouts[k]||0);
    if(c.refunded){
      if(m.winner==='VOID')voidSeen++; else refundSeen++;
      let okref=true; for(const k in b){if(Math.abs((c.payouts[k]||0)-(Number(b[k].stake)||0))>1e-6)okref=false;}
      ok(okref,'refund/VOID возвращает точные ставки (m'+m.id+' T'+T+')');
    } else {
      const d=Math.abs(sumPay-c.pool); if(d>worstPay)worstPay=d;
      ok(d<1e-6,'\u03a3выплат==касса (m'+m.id+' T'+T+' pool='+c.pool+' pay='+sumPay.toFixed(4)+')');
      // победившая сторона со ставкой>0 получает >0; проигравшие — 0
      let sideOK=true;
      for(const k in b){const wonK=c.payouts[k]||0;const isWin=b[k].team===m.winner;
        if(isWin&&(Number(b[k].stake)||0)>0&&c.pool>0){if(!(wonK>0))sideOK=false;}
        if(!isWin){if(Math.abs(wonK)>1e-9)sideOK=false;}
        if(wonK>c.pool+1e-6)sideOK=false;}
      ok(sideOK,'победитель>0, проигравший=0, выплата<=кассы (m'+m.id+' T'+T+')');
    }
  }

  // --- глобальное сохранение: Σбаланс + Σpending == N*банк ---
  let sumBal=0,sumPend=0;
  for(const p of players){const st=S.statsFor(p.id);sumBal+=st.balance;sumPend+=st.pending;}
  const dc=Math.abs((sumBal+sumPend)-(N*BANK)); if(dc>worstCons)worstCons=dc;
  ok(dc<1e-6,'\u03a3баланс+\u03a3pending==N*банк (T'+T+' bal='+sumBal.toFixed(3)+' pend='+sumPend.toFixed(3)+' N='+N+')');

  // --- availFor исключает один матч и совпадает с ручным пересчётом ---
  if(M>0){
    const mid='m'+ri(r,0,M-1), pid=pids[ri(r,0,N-1)];
    let staked=0,won=0;
    for(const m of matches){if(m.id===mid)continue;const bb=(m.bets||{})[pid];if(!bb)continue;staked+=Number(bb.stake)||0;if(m.settled)won+=(S.calcMatch(m).payouts[pid]||0);}
    ok(Math.abs(S.availFor(pid,mid)-(BANK-staked+won))<1e-6,'availFor исключает матч корректно (T'+T+')');
  }

  // --- ranking: покрытие, сортировка, ранги ---
  const rk=S.ranking();
  ok(rk.length===N,'ranking покрывает всех ('+rk.length+'/'+N+' T'+T+')');
  let sortedOK=true; for(let i=1;i<rk.length;i++){if(rk[i-1].s.balance<rk[i].s.balance-1e-9)sortedOK=false;}
  ok(sortedOK,'ranking по балансу убыв. (T'+T+')');
  let ranksOK=true; for(let i=0;i<rk.length;i++){if(rk[i].rank!==i+1)ranksOK=false;}
  ok(ranksOK,'ранги 1..N подряд (T'+T+')');
}
console.log('покрытие: сведено матчей='+settledSeen+', refund(нет ставок на победителя)='+refundSeen+', VOID='+voidSeen);
console.log('worst Σвыплат-касса err='+worstPay+'  worst Σбаланс-банк err='+worstCons);
if(fails)console.log('moneyfuzz FAILED '+fails+'/'+tests);
else console.log('\u2705 moneyfuzz: '+tests+' passed, 0 failed ('+TRIALS+' случайных раскладов против ЖИВОГО кода)');
