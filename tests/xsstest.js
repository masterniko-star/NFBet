const {loadApp}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
const XSS='<img src=x onerror=alert(1)>';
const SCR='<script>steal()</script>';
// raw payload must be absent (escaped), i.e. no live "<img...onerror" or "<script"
function clean(h){h=String(h||"");return h.indexOf('<img src=x onerror')===-1 && h.toLowerCase().indexOf('<script')===-1;}

(async()=>{
let A=loadApp({meta:{bank:100}},{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);

// 1. esc() encodes all five dangerous chars
ok(A.sandbox.esc(XSS)==='&lt;img src=x onerror=alert(1)&gt;','1: esc encodes < >');
ok(A.sandbox.esc('a"b')==='a&quot;b','1: esc encodes double-quote');
ok(A.sandbox.esc("a'b")==='a&#39;b','1: esc encodes single-quote');
ok(A.sandbox.esc('a&b')==='a&amp;b','1: esc encodes ampersand');

// 2-4. popup item builders escape user text
ok(clean(A.sandbox.noticeItemHtml({type:'newplayer',name:XSS})),'2: noticeItemHtml escapes name');
ok(clean(A.sandbox.critPopupItemHtml([{msg:XSS}])),'3: critPopupItemHtml escapes msg');
ok(clean(A.sandbox.intgNoticeItemHtml([{msg:XSS}])),'4: intgNoticeItemHtml escapes msg');

// 5. board view escapes a malicious participant name (player must have a bet on an open match)
A=loadApp({meta:{bank:100},players:{p:{name:XSS,feePaid:true,dep:100}},matches:{m1:{teamA:'A',teamB:'B',settled:false,drawOK:false}},bets:{m1:{p:{team:'A',stake:5}}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);A.sandbox.TAB='board';A.sandbox.renderBoardView();
let bh=A.q('#main').innerHTML;
ok(bh.length>50,'5: board rendered something');
ok(clean(bh)&&/&lt;img/.test(bh),'5: board view escapes malicious name');

// 6. admin players list escapes name + phone
A=loadApp({meta:{bank:100},players:{p:{name:XSS,phone:SCR,feePaid:true,dep:100}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);A.sandbox.renderAdminPlayers();
let ph=A.q('#main').innerHTML;
ok(ph.length>50,'6: admin list rendered something');
ok(clean(ph),'6: admin players list escapes name + phone');

// 7. stats content escapes a malicious team name in a settled bet row
A=loadApp({meta:{bank:100},players:{p:{name:'דנה',feePaid:true,dep:100}},matches:{m1:{teamA:XSS,teamB:'Y',settled:true,winner:'A'}},bets:{m1:{p:{team:'A',stake:5}}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);A.sandbox._statsPid='p';A.sandbox._statsTab='bets';
let rows=A.sandbox.statsBalRows('p');
ok(rows.length===1&&rows[0].match.indexOf('<img')>=0,'7: bal-row data layer holds raw team (escaping happens at render)');
let sh=A.sandbox.statsContentHtml();
ok(clean(sh)&&/&lt;img/.test(sh),'7: statsContentHtml escapes team name at render');


// 8. diagLoad escapes remote-controlled lvl (open DB -> stored XSS in admin log)
A=loadApp({meta:{bank:100},diag:{evil:{items:[{ts:1,lvl:'</span><img src=x onerror=alert(1)>',cat:'x',msg:'hi'}]}}},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
A.sandbox.diagLoad();
await new Promise(function(r){setTimeout(r,8);});
let dh=A.q('#diagBox').innerHTML;
ok(dh.length>20,'8: diag rendered');
ok(clean(dh)&&dh.indexOf('&lt;')>=0,'8: diagLoad escapes malicious lvl from open DB');

console.log((fail?'❌':'✅')+' xsstest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
