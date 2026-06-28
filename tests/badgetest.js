const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
(async()=>{
let A=loadApp({meta:{bank:100},players:{
  u:{name:'עמרי גרינברג',feePaid:false,dep:0},
  p:{name:'דנה לוי',feePaid:true,dep:100},
  lng:{name:'abcdefghijklmnopqrstuvwxyz',feePaid:true,dep:100}}},{hash:''});
A.sandbox.buildState(A.state.tree);
A.sandbox.ME='p';A.sandbox.TAB='all';
A.sandbox.renderAllView();
let html=A.q('#main').innerHTML;
ok(/class="unpaid">מצב דמו<\/span>/.test(html),'demo badge present with text');
ok(/class="nmtxt"[^>]*>עמרי גרינברג<\/span>/.test(html),'full name in its own cell (≤16 chars, not truncated)');
ok(/class="dmc"><span class="unpaid">מצב דמו<\/span>/.test(html),'badge in its own aligned column (.dmc), not inline');
ok(!/<br>/.test(html),'names on ONE line (no <br> split)');
ok((html.match(/class="unpaid"/g)||[]).length===1,'exactly one badge — only the un-paid player has it');
ok(html.indexOf('abcdefghijklmnop…')>=0,'long name truncated to 16 chars + …');
ok(html.indexOf('abcdefghijklmnopq')<0,'17th char of long name NOT shown (capped at 16)');
console.log((fail?'❌':'✅')+' badgetest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
