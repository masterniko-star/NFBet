const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},players:{},matches:{},bets:{}};
(async()=>{
let A=loadApp(seed,{});A.sandbox.buildState(A.state.tree);
const S=A.sandbox;
const logHas=(lvl,sub)=>S.logRead().some(e=>e.lvl===lvl&&e.msg.indexOf(sub)>=0);

console.log('===== basic log ops =====');
S.logClear();
S.logInfo('t','hello');S.logWarn('t','warn1');S.logErr('t','err1');S.logCrit('t','crit1');
let a=S.logRead();
ok(a.length===4,'4 entries written ('+a.length+')');
ok(a[0].lvl==='INFO'&&a[3].lvl==='CRIT','levels recorded in order');
ok(a[0].ver===S.APP_VER && !!S.APP_VER,'each entry tagged with app version ('+S.APP_VER+')');
ok(typeof a[0].ts==='number','timestamp present');
S.logClear();
ok(S.logRead().length===0,'logClear empties log');
// ring cap
for(let i=0;i<300;i++)S.logInfo('t','m'+i);
ok(S.logRead().length<=250,'ring buffer capped at LOG_MAX ('+S.logRead().length+')');

console.log('\n===== diagnostics (logic anomalies) =====');
S.logClear(); S._diagSeen={};
S.S={meta:{bank:100,cur:'₪'},players:[{id:'p1',name:'Neg'},{id:'p2',name:'OK'}],matches:[
  {id:'m1',settled:false,teamA:'A',teamB:'B',bets:{p1:{team:'A',stake:150}}}, // bal = 100-150 = -50
  {id:'m2',settled:true,winner:'Z',teamA:'C',teamB:'D',bets:{}}              // invalid winner
]};
S.runDiagnostics();
ok(logHas('WARN','שלילית'),'negative balance detected (WARN)');
ok(logHas('WARN','לא תקין'),'invalid winner detected (WARN)');
let n1=S.logRead().length;
S.runDiagnostics(); // again
ok(S.logRead().length===n1,'diagnostics deduped (no repeat spam) '+n1+'=='+S.logRead().length);

console.log('\n===== logRender + summary + color =====');
S.logClear();S._diagSeen={};
S.logCrit('test','boom critical');S.logWarn('test','careful');
S.MODE='admin';S.TAB='settings';
S.logRender();
const box=A.q('#logBox').innerHTML, sum=A.q('#logSummary').innerHTML;
ok(box.indexOf('#ff4d4d')>=0,'critical rendered in red');
ok(box.indexOf('font-weight:800')>=0,'critical bold');
ok(box.indexOf('boom critical')>=0,'critical message shown');
ok(sum.indexOf('קריטי')>=0 && sum.indexOf('1')>=0,'summary shows critical count');

console.log('\n===== logText (copyable) =====');
const txt=S.logText();
ok(txt.indexOf('NF PlayOff log')>=0 && txt.indexOf('ver '+S.APP_VER)>=0,'log text has header+version');
ok(txt.indexOf('boom critical')>=0,'log text includes entries');

console.log('\n===== devId stable =====');
ok(S.devId()===S.devId() && S.devId().length>0,'devId stable & non-empty');

console.log('\n===== self-heal: write retry on transient failure =====');
S.logClear();
let calls=0;
S.fetch=function(url,opt){var m=(opt&&opt.method)||'GET';
  if(m==='PUT'&&/players\/zz/.test(url)){calls++;if(calls===1)return Promise.reject(new TypeError('network down'));}
  return Promise.resolve({ok:true,json:async()=>({})});};
const pr=S.fbSet('/players/zz',{name:'z'});
await wait(1500);
ok(calls>=2,'write retried after transient failure (calls='+calls+')');
ok(logHas('WARN','ניסיון חוזר'),'retry logged as WARN');
let resolved=false; try{await pr;resolved=true;}catch(e){}
ok(resolved,'write eventually resolved after retry');

console.log('\n===== espnGet logs fallback + total failure =====');
S.logClear();
S.fetch=function(){return Promise.reject(new TypeError('all down'));};
let threw=false; try{await S.espnGet('https://site.api.espn.com/x');}catch(e){threw=true;}
ok(threw,'espnGet rejects when every source fails');
ok(logHas('WARN','proxy')||logHas('WARN','ESPN ישיר'),'espn fallback attempts logged');
ok(logHas('ERR','כל הניסיונות'),'espn total failure logged as ERR');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
