// demoscan.js — СТРАЖ против СЛОМАННОЙ демо-архитектуры (очки-валюта + двойные пулы + карта DEMO).
// «מצב דמו» (метка неоплатившего) и demote/demoteAt/demoteNotify (авто-перевод в демо при нуле) — РАЗРЕШЕНЫ. Запрещены реальные поломки:
// валюта-очки נק׳, двойные пулы dSum/dPool/dCoef, карта DEMO[], латинский demo, demo-флаги.
const fs=require('fs');
const PATTERNS=[
  {re:/\bDEMO\b/,            name:'DEMO (карта демо-игроков)'},
  {re:/demo(?!t)/i,          name:'demo (латиница, не demote)'},
  {re:/נק׳/,                name:'נק׳ (валюта-очки)'},
  {re:/נק'/,                name:"נק' (валюта-очки)"},
  {re:/הדגמה/,              name:'הדגמה'},
  {re:/betDemo|isDemo|demoMode|demoSet/, name:'demo-идентификатор'},
  {re:/dSum[ABX]\b|dPool|dCoef/, name:'демо-пул'},
  {re:/ממצב דמו למשחק|יאופסו ההימורים/, name:'старый диалог перехода демо→деньги'},
];
function scan(txt){
  const lines=txt.split('\n'); const hits=[];
  for(const {re,name} of PATTERNS) lines.forEach((ln,i)=>{ if(re.test(ln)) hits.push({name,line:i+1,snip:ln.trim().slice(0,90)}); });
  return hits;
}
let fails=0; const ok=(c,m)=>{ if(!c){fails++;console.log('FAIL:',m);} else console.log('ok  ',m); };

// (1) САМОПРОВЕРКА детектора — на грязном образце демо ОБЯЗАН найтись
const DIRTY='var cur=function(){return (ME&&DEMO[ME])?"\u05e0\u05e7\u05f3":"\u20aa";};/* \u05de\u05e6\u05d1 \u05d3\u05de\u05d5 */var r={dSumA:0,dSumB:0};';
const dirtyHits=scan(DIRTY);
ok(dirtyHits.length>0,'детектор ЛОВИТ демо в грязном образце (иначе тест слепой) — найдено '+dirtyHits.length);

// (2) РЕАЛЬНЫЕ файлы обязаны быть чисты
const files=[require('path').join(__dirname,'..','index.html'),require('path').join(__dirname,'..','netlify','functions','check-results.mjs')];
for(const f of files){
  let txt; try{txt=fs.readFileSync(f,'utf8');}catch(e){ok(false,'нет файла '+f);continue;}
  const hits=scan(txt); const base=f.split('/').pop();
  if(hits.length){ hits.forEach(h=>console.log('   ДЕМО ['+h.name+'] '+base+':'+h.line+' \u2192 '+h.snip)); }
  ok(hits.length===0,base+' — без сломанной демо-архитектуры (очки/двойные пулы/DEMO)');
}

if(fails) console.log('demoscan FAILED '+fails);
else console.log('\u2705 demoscan: страж рабочий, реальные файлы без очков/двойных пулов/DEMO (метка מצב דמו разрешена)');
process.exit(fails?1:0);
