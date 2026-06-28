const {loadApp}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const now=Date.now();const dt=new Date(now+8*36e5).toISOString().slice(0,16);
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
  players:{p1:{name:'\u05d3\u05e0\u05d9',t:1}},   // "דני"
  matches:{m1:{round:'R32',order:0,t:1,teamA:'\u05d1\u05e8\u05e6\u05dc\u05d5\u05e0\u05d4',teamB:'\u05e8\u05d9\u05d0\u05dc',dt:dt,settled:false,winner:null,drawOK:true}},
  bets:{}};

console.log('===== RTL smoke: admin players view =====');
{
  const A=loadApp(seed,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);A.sandbox.TAB='players';A.sandbox.renderActive();
  const m=(A.q('#main')||{}).innerHTML||'';
  ok(m.indexOf('\u05d4\u05d3\u05d1\u05e7 \u05e8\u05e9\u05d9\u05de\u05d4')>=0,'bulk-add button "הדבק רשימה" renders (RTL intact)');
  ok(/dir="rtl"/.test(m),'dir="rtl" present on player rows');
  ok(m.indexOf('\u05d3\u05e0\u05d9')>=0,'Hebrew player name "דני" renders intact (no mojibake)');
}

console.log('\n===== RTL smoke: settings panels =====');
{
  const A=loadApp(seed,{hash:'ctrl7'});A.sandbox.buildState(A.state.tree);A.sandbox.TAB='settings';A.sandbox.renderActive();
  const s=(A.q('#main')||{}).innerHTML||'';
  ok(s.indexOf('\u05db\u05e0\u05d9\u05e1\u05d5\u05ea \u05de\u05e9\u05ea\u05ea\u05e4\u05d9\u05dd')>=0,'logins panel title "כניסות משתתפים" present');
  ok(s.indexOf('\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea \u05d4\u05d8\u05d5\u05e8\u05e0\u05d9\u05e8')>=0,'settings panel title "הגדרות הטורניר" present');
  ok(s.indexOf('3.5')>=0||s.indexOf('\u05e2\u05d3\u05db\u05d5\u05df')>=0,'auto-update card text present');
}

console.log('\n===== RTL smoke: player bet view =====');
{
  const B=loadApp(seed,{});B.sandbox.buildState(B.state.tree);B.sandbox.ME='p1';B.sandbox.MODE='player';B.sandbox.TAB='bet';B.sandbox.renderActive();
  const bv=(B.q('#main')||{}).innerHTML||'';
  ok(/class="betrow/.test(bv),'bet card (betrow) rendered in player bet view');
  ok(/dir="auto"/.test(bv),'dir="auto" present on team-name spans (mixed RTL/LTR)');
  ok(bv.indexOf('\u05d1\u05e8\u05e6\u05dc\u05d5\u05e0\u05d4')>=0&&bv.indexOf('\u05e8\u05d9\u05d0\u05dc')>=0,'Hebrew team names render intact');
}

console.log('\n===== bet-card: stake controls row-aligned + cyan draw =====');
{
  const fs2=require('fs');const SRC=fs2.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
  const fut2=new Date(Date.now()+10*36e5).toISOString().slice(0,16);
  const sd={meta:{bank:100,minBet:1,maxBet:10,cur:'\u20aa'},
    players:{u:{name:'Uri',feePaid:true,t:1}},
    matches:{
      d1:{round:'GRP',order:0,teamA:'Argentina',teamB:'Austria',dt:fut2,settled:false,winner:null,drawOK:true},
      k1:{round:'R16',order:1,teamA:'Xx',teamB:'Yy',dt:fut2,settled:false,winner:null}
    },
    bets:{ d1:{u:{team:'X',stake:1}} }};
  const C=loadApp(sd,{});C.sandbox.buildState(sd);C.sandbox.ME='u';C.sandbox.MODE='player';C.sandbox.TAB='bet';C.sandbox.renderActive();
  const bv=(C.q('#main')||{}).innerHTML||'';
  ok(/class="stval num"[^>]*grid-row:1"/.test(bv),'stake value box -> grid-row:1 (команда1 line)');
  ok(/grid-row:2">\u25b2/.test(bv),'up-arrow -> grid-row:2 (תיקו line)');
  ok(/grid-row:3">\u25bc/.test(bv),'down-arrow -> grid-row:3 (команда2 line)');
  ok(/class="pk on-x"/.test(bv),'תיקו selected -> on-x');
  ok(/strowpair[^>]*grid-row:2"/.test(bv),'knockout: up/down pair -> grid-row:2');
  ok(/class="pk [^"]*"[^>]*grid-column:2/.test(bv),'teams on LEFT track (grid-column:2)');
  ok(/class="stval num"[^>]*grid-column:1/.test(bv),'stake controls on RIGHT track (grid-column:1)');
  ok(/\.betrow \.pk \.tnm\{[^}]*text-align:center/.test(SRC),'team name centered in button');
  ok(/class="tnsp"/.test(bv),'balancing spacer present (1/X/2 badge stays edge-aligned)');
  ok((bv.match(/class="round betmeta"/g)||[]).length>=2,'meta split into 2 stable rows (date + win/loss/pot), no jumping');
  ok(/betmeta"[^>]*font-size:13px/.test(bv),'meta font bumped to 13px');
  ok(/\.betrow \.pk\.on-x\{background:#48FCFE/.test(SRC),'selected תיקו fill = cyan #48FCFE');
  ok(!/\.pk\.on-x\{background:var\(--gold\)/.test(SRC),'old gold draw fill removed');
}

console.log('\n===== nav: help tab (left corner) + history rename =====');
{
  const sd2={meta:{bank:100,cur:'\u20aa'},players:{u:{name:'Uri',feePaid:true,t:1}},matches:{},bets:{}};
  const N=loadApp(sd2,{});N.sandbox.buildState(sd2);N.sandbox.ME='u';N.sandbox.MODE='player';N.sandbox.TAB='bet';N.sandbox.renderActive();
  const nav=N.q('#nav').innerHTML;
  const labels=[...nav.matchAll(/<\/span>([^<]+)<\/button>/g)].map(x=>x[1]);
  ok(/data-tab="help"/.test(nav),'nav has help tab');
  ok(labels[labels.length-1]==='עזרה','help is last DOM item (leftmost in RTL = left corner)');
  ok(labels.indexOf('היסטוריה')>=0 && labels.indexOf('היסטוריה שלי')<0,'history renamed היסטוריה שלי -> היסטוריה');
  N.sandbox.TAB='help';N.sandbox.renderActive();
  const hv=N.q('#main').innerHTML;
  // help redesigned: עזרה section header + 3 collapsible strips (panelCard), no tabs
  ok(/<h2>עזרה<\/h2>/.test(hv),'help has עזרה section header');
  ok(!/class="helptabs"/.test(hv),'help no longer uses tabs');
  ok(/id="pc_hrules"/.test(hv) && /id="pc_hguide"/.test(hv) && /id="pc_htg"/.test(hv),'help = 3 strips (תקנון+מדריך+טלגרם)');
  ok(/📜&nbsp;&nbsp;תקנון/.test(hv) && /📖&nbsp;&nbsp;מדריך למשתתף/.test(hv) && /📨&nbsp;&nbsp;התראות בטלגרם/.test(hv) && /helpwrap/.test(hv),'strip titles + helpwrap context');
  // rules strip (new תקנון)
  ok(/בלנס ופיקדון/.test(hv) && /כניסה ויציאה מהטורניר/.test(hv) && /אינם תלויים בגודל הבלנס/.test(hv) && /לא ניתן להמר על סכום גדול מהבלנס/.test(hv),'rules: balance + entry-exit + win-chance + no-overbet');
  ok(/חישוב סופי ותשלומים/.test(hv) && /חידוש בלנס/.test(hv) && /class="ex"/.test(hv),'rules: payouts + balance-renewal + money examples');
  ok(/מצב דמו/.test(hv),'rules: new demo-mode clause');
  // guide strip (new מדריך)
  ok(/איך נכנסים/.test(hv) && /על מה מהמרים/.test(hv) && /class="note"/.test(hv) && /class="helptbl"/.test(hv),'guide: how-to + bet-types + winning note + ratio table');
  // telegram strip (WIP)
  ok(/id="tgSub"/.test(hv) && /id="tgPhone"/.test(hv) && /בפיתוח/.test(hv),'telegram strip: subscribe + phone + WIP marker');
}

console.log('\n===== טבלה summary: 3 totals (pool = in-hand + in-bets) =====');
{
  const fut3=new Date(Date.now()+10*36e5).toISOString().slice(0,16);
  const sd3={meta:{bank:100,cur:'\u20aa'},
    players:{a:{name:'A',feePaid:true,t:1},b:{name:'B',feePaid:true,t:2}},
    matches:{m1:{round:'R16',order:0,teamA:'X',teamB:'Y',dt:fut3,settled:false,winner:null}},bets:{m1:{a:{team:'A',stake:10}}}};
  const P=loadApp(sd3,{});P.sandbox.buildState(sd3);P.sandbox.ME='a';P.sandbox.MODE='player';
  P.sandbox.TAB='all';P.sandbox.renderActive();
  const h=P.q('#main').innerHTML;
  ok(/קופה כללית/.test(h)&&/סה"כ בהימורים/.test(h)&&/סה"כ כסף ביד/.test(h),'table header shows 3 totals');
  ok(!/class="lb lhead"/.test(h),'old column labels (# משתתף יתרה) removed');
  const vals=[...h.matchAll(/muted[^>]*>([^<]+)<\/div><div class="num"[^>]*>([^<]+)/g)].map(m=>[m[1].trim(),parseFloat(m[2])]);
  const pool=vals.find(v=>/קופה/.test(v[0]))[1],bets=vals.find(v=>/בהימור/.test(v[0]))[1],hand=vals.find(v=>/ביד/.test(v[0]))[1];
  ok(Math.abs(pool-(bets+hand))<1e-6,'קופה כללית = בהימורים + כסף ביד ('+pool+'='+bets+'+'+hand+')');
  ok(Math.abs(bets-10)<1e-6,'בהימורים=10 (open bet money), not 0');
  P.sandbox.renderHeader();
  ok(!/קופה כללית/.test(P.q('#hTitle').innerHTML),'pool no longer in window title');
}

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
