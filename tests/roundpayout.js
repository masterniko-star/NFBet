'use strict';
// roundpayout.js — выплаты в ЦЕЛЫХ שקלים (метод наибольшего остатка / Гамильтон).
// Инварианты: каждая выплата — целое; Σвыплат == касса ТОЧНО (без epsilon); остаток
// раздаётся победителям с наибольшей дробной частью (ничьи — по id ставки); каждый
// победитель получает не меньше своей ставки; детерминизм (один расклад -> один результат).
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const fails=[];
function ok(c,m){if(c){pass++;}else{fail++;fails.push(m);console.log('  ✗ '+m);}}
function eq(a,b,m){ok(a===b,m+' (got '+JSON.stringify(a)+' want '+JSON.stringify(b)+')');}

function calc(winner,bets){
  const A=loadApp({meta:{bank:100,minBet:1,maxBet:10,cur:'₪'},players:{},
    matches:{m1:{round:'R32',order:0,t:1,teamA:'H',teamB:'A',dt:'2026-06-20T18:00',settled:true,winner,drawOK:true}},
    bets:{m1:bets}},{});
  A.sandbox.buildState(A.state.tree);
  return A.sandbox.calcMatch(A.sandbox.S.matches[0]);
}

// ---------- 1. известный расклад: lopsided 30/29, B wins ----------
{
  const c=calc('B',{niko:{team:'A',stake:1},a:{team:'B',stake:10},b:{team:'B',stake:5},c:{team:'B',stake:4},d:{team:'B',stake:10}});
  // base=floor(30*s/29): a10 b5 c4 d10 (Σ29), leftover=1 -> +1 'a' (rem 10, id < 'd')
  eq(c.payouts.a,11,'a=11 (база 10 + остаток)');
  eq(c.payouts.b,5,'b=5'); eq(c.payouts.c,4,'c=4'); eq(c.payouts.d,10,'d=10'); eq(c.payouts.niko,0,'niko(A)=0');
  eq(c.payouts.a+c.payouts.b+c.payouts.c+c.payouts.d,30,'Σ=30 (ровно касса)');
}

// ---------- 2. ничья дробных частей -> tiebreak по id ----------
{
  // 3 равные ставки по 10, pool=50 (две по 10 на B проигравшие), sumA=30, winner A
  const c=calc('A',{a1:{team:'A',stake:10},a2:{team:'A',stake:10},a3:{team:'A',stake:10},b1:{team:'B',stake:10},b2:{team:'B',stake:10}});
  // base=floor(50*10/30)=16 каждому (Σ48), rem=20 у всех -> leftover 2 -> +1 a1,a2 (по id)
  eq(c.payouts.a1,17,'a1=17 (tiebreak: первый по id)');
  eq(c.payouts.a2,17,'a2=17 (второй по id)');
  eq(c.payouts.a3,16,'a3=16 (остатка не досталось)');
  eq(c.payouts.a1+c.payouts.a2+c.payouts.a3,50,'Σ=50');
}

// ---------- 3. целочисленность + точное сохранение на множестве раскладов ----------
function mk(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function ri(r,a,b){return a+Math.floor(r()*(b-a+1));}
{
  let allInt=true,allConserved=true,allGteStake=true;
  for(let T=0;T<1500;T++){
    const r=mk(50000+T*2654435761);
    const N=ri(r,1,8), winner=['A','B','X'][ri(r,0,2)];
    const bets={};let any=false;
    for(let i=0;i<N;i++){const team=['A','B','X'][ri(r,0,2)];bets['p'+i]={team,stake:ri(r,1,10)};if(team===winner)any=true;}
    if(!any)continue; // пропускаем расклады без победителей (там refund, не аппорционирование)
    const c=calc(winner,bets);
    if(c.refunded)continue;
    let sum=0;
    for(const k in bets){const v=c.payouts[k]||0;sum+=v;
      if(!Number.isInteger(v))allInt=false;
      if(bets[k].team===winner&&v<bets[k].stake)allGteStake=false; // победитель >= своей ставки (coef>=1)
    }
    if(sum!==c.pool)allConserved=false;
  }
  ok(allInt,'все выплаты целочисленны (1500 раскладов)');
  ok(allConserved,'Σвыплат == касса ТОЧНО, без epsilon (1500 раскладов)');
  ok(allGteStake,'каждый победитель получает >= своей ставки (1500 раскладов)');
}

// ---------- 4. детерминизм: один и тот же расклад -> идентичный результат ----------
{
  const bets={x:{team:'A',stake:3},y:{team:'A',stake:7},z:{team:'B',stake:5}};
  const c1=calc('A',bets), c2=calc('A',bets);
  eq(JSON.stringify(c1.payouts),JSON.stringify(c2.payouts),'повтор даёт идентичные выплаты');
}

console.log('\n'+(fail===0?'✅':'❌')+' roundpayout: '+pass+' passed, '+fail+' failed');
if(fail)process.exit(1);
