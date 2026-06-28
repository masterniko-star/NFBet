// pweyetest.js — «глазок» (показать/скрыть пароль) на полях пароля.
// Проверяет: экран входа оборачивает поле в .pwwrap + кнопка .pweye с onclick=pwSee,
// сам input пароля сохранён; хелпер pwBox строит обёртку; pwSee переключает type.
const {loadApp}=require('./applib.js');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log('  FAIL:',m);}};

const A=loadApp({meta:{fee:100,bank:100,cur:'₪'},players:{},matches:{},bets:{}},{});
A.sandbox.buildState(A.state.tree);
A.sandbox.renderIdentify();
const html=A.mainHTML()||'';

ok(/class="pwwrap"/.test(html),'экран входа: поле пароля обёрнуто в .pwwrap');
ok(/class="pweye"[^>]*onclick="pwSee\(this\)"/.test(html),'экран входа: кнопка-глазок с onclick=pwSee');
ok(/id="logPw" type="password"/.test(html),'экран входа: input пароля сохранён (id+type)');

// хелпер pwBox
const box=A.sandbox.pwBox('xPw',' placeholder="p"');
ok(/<span class="pwwrap">/.test(box)&&/id="xPw" type="password"/.test(box)&&/class="pweye"/.test(box)&&/placeholder="p"/.test(box),'pwBox строит обёртку input+глазок');

// pwSee переключает type (имитация клика без реального DOM)
const stub={type:'password'};
const btn={textContent:'',parentNode:{querySelector:function(){return stub;}},setAttribute:function(){}};
A.sandbox.pwSee(btn); ok(stub.type==='text','pwSee: 1-й клик -> text (пароль виден)');
A.sandbox.pwSee(btn); ok(stub.type==='password','pwSee: 2-й клик -> password (скрыт)');

console.log((fail?'❌':'✅')+' pweyetest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
