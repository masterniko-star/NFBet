// logpanels.js — «יומן אירועים» разбит на 3 сворачиваемые подпанели (рשомот מכשיר /
// עדכון אוטומטי / יומן שרת), у каждой мини-индикатор критики + свои копир/очистка,
// и общая кнопка «העתק הכל לשליחה ל-Claude».
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};

const A=loadApp({meta:{}},{});
A.sandbox.panelOpen={};

// --- logSub: структура подпанели ---
const sub=A.sandbox.logSub('logmain','כותרת','<span id="logMini"></span>','<div id="logBox"></div>');
ok(/class="lsub"/.test(sub),'logSub: обёртка .lsub');
ok(/onclick="logSubToggle\('logmain'\)"/.test(sub),'logSub: переключение по клику');
ok(/id="pb_logmain"/.test(sub)&&/id="pc_logmain"/.test(sub),'logSub: тело + стрелка с id');
ok(/display:none/.test(sub),'logSub: свёрнут по умолчанию');
ok(sub.indexOf('id="logMini"')>=0,'logSub: мини-индикатор в шапке');

// --- мини-бейдж критики ---
ok(/🔴2/.test(A.sandbox.logMiniBadge(2,0,0)),'badge: критические красные 🔴');
ok(/🟡3/.test(A.sandbox.logMiniBadge(0,0,3)),'badge: предупреждения жёлтые 🟡');
ok(/✓/.test(A.sandbox.logMiniBadge(0,0,0)),'badge: чисто → ✓');

// --- переключение ---
A.sandbox.panelOpen={};
A.sandbox.logSubToggle('logdiag');
ok(A.sandbox.panelOpen.logdiag===true,'toggle: открывает');
A.sandbox.logSubToggle('logdiag');
ok(A.sandbox.panelOpen.logdiag===false,'toggle: закрывает');

// --- logRender наполняет мини в шапке ---
try{A.sandbox.logClear();}catch(e){}
A.sandbox.logCrit('t','boom');A.sandbox.logWarn('t','careful');
A.sandbox.MODE='admin';
A.sandbox.logRender();
ok(A.q('#logMini').innerHTML.indexOf('🔴')>=0,'logRender: мини в шапке показывает критику');

// --- renderSettings подключает 3 подпанели + общую кнопку ---
const rs=A.sandbox.renderSettings.toString();
ok(rs.indexOf('logmain')>=0&&rs.indexOf('logauto')>=0&&rs.indexOf('logdiag')>=0,'renderSettings: три подпанели');
ok(rs.indexOf('copyAllLog')>=0,'renderSettings: общая кнопка «копировать всё»');
// id логов сохранены (на них завязаны другие тесты/функции)
ok(rs.indexOf('id="logBox"')>=0&&rs.indexOf('id="autoBox"')>=0&&rs.indexOf('id="diagBox"')>=0,'id logBox/autoBox/diagBox сохранены');

console.log((fail?'❌':'✅')+' logpanels: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
