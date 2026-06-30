// schedtest.mjs — новая модель авто-апдейта: results/newgames независимы, offset+фикс-время аддитивно,
// макс-3 несведённых, добор после освобождения слота, маршрутизация и сеттл 365scores, миграция старого конфига.
function clone(o){return JSON.parse(JSON.stringify(o||{}));}
function makeFetch(state){
  function segs(u){u=u.replace(/^https?:\/\/[^/]+/,'').replace(/\?.*$/,'').replace(/\.json$/,'');return u.split('/').filter(Boolean);}
  const get=s=>{let n=state.tree;for(const k of s){if(n==null)return null;n=n[k];}return n==null?null:n;};
  const set=(s,v)=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)n[s[i]]={};n=n[s[i]];}n[s[s.length-1]]=v;};
  const patch=(s,v)=>{let n=state.tree;for(const k of s){if(n[k]==null)n[k]={};n=n[k];}Object.assign(n,v);};
  const del=s=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)return;n=n[s[i]];}delete n[s[s.length-1]];};
  return async function(url,opts){opts=opts||{};const m=(opts.method||'GET').toUpperCase();
    if(/webws\.365scores\.com/.test(url))return {ok:true,json:async()=>state.s365||{games:[]}};
    if(/site\.api\.espn\.com/.test(url))return {ok:true,json:async()=>state.espn||{events:[]}};
    const s=segs(url);let body=null;try{body=opts.body?JSON.parse(opts.body):null;}catch(e){}
    let v=null;
    if(m==='GET')v=s.length?get(s):state.tree;
    else if(m==='PUT'){if(s.length)set(s,body);else state.tree=body;v=body;}
    else if(m==='PATCH'){if(s.length)patch(s,body);else Object.assign(state.tree,body);v=body;}
    else if(m==='DELETE'){if(s.length)del(s);v=null;}
    return {ok:true,json:async()=>v==null?null:clone(v)};
  };
}
const now=Date.now();
function israelHHMM(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));return (p.find(x=>x.type==='hour').value)+':'+(p.find(x=>x.type==='minute').value);}
function ilWall(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));const g=t=>p.find(x=>x.type===t).value;return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');}
function preEvt(id,h,a,offH){return {id,date:new Date(now+offH*36e5).toISOString(),status:{type:{state:'pre',completed:false}},competitions:[{competitors:[{homeAway:'home',team:{displayName:h}},{homeAway:'away',team:{displayName:a}}]}]};}
function postEvt(id,h,a,hw,aw,hs,as){return {id,date:new Date(now-3*36e5).toISOString(),status:{type:{state:'post',completed:true}},competitions:[{competitors:[{homeAway:'home',winner:hw,score:hs,team:{displayName:h}},{homeAway:'away',winner:aw,score:as,team:{displayName:a}}]}]};}
function g365(id,h,a,offH,ended,hs,as){return {id,startTime:new Date(now+offH*36e5).toISOString(),statusGroup:ended?4:1,homeCompetitor:{id:String(id)+'h',name:h,score:ended?hs:-1},awayCompetitor:{id:String(id)+'a',name:a,score:ended?as:-1}};}
function mtch(id,dtOff,fxid){return {round:'R32',teamA:'H'+id,teamB:'A'+id,dt:ilWall(dtOff),fx:'espn'+fxid,fxLeague:'fifa.world',settled:false,winner:null,drawOK:false,order:0,t:1};}
function m365(id,dtOff,fxid,he1,he2){return {round:'R32',teamA:he1,teamB:he2,dt:ilWall(dtOff),fx:'365'+fxid,fxLeague:'365:42',settled:false,winner:null,drawOK:true,order:0,t:1};}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('  \x1b[31mFAIL: '+m+'\x1b[0m');}else console.log('  ok   '+m);};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const RC=mod.runCheck;
const cands={events:[preEvt('900','A','B',12),preEvt('901','C','D',20),preEvt('902','E','F',30)]};

console.log('===== RESULTS: offset after kickoff (after:[180]) settles finished match =====');
{
  let st={tree:{autocfg:{results:{on:true,after:[180],times:[],last:0},newgames:{on:false}},meta:{bank:100},players:{},
    matches:{m1:Object.assign(mtch('1',-240,'500'),{drawOK:true})},bets:{}},
    espn:{events:[postEvt('500','H1','A1',true,false,'2','0')]}};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(!r.skipped&&r.results===true,'results due via after:[180] (match 4h past)');
  ok(st.tree.matches.m1.settled===true&&st.tree.matches.m1.winner==='A','match settled to A from ESPN');
  ok(typeof (st.tree.autocfg.results||{}).last==='number'&&st.tree.autocfg.results.last>0,'results.last stamped');
}

console.log('\n===== RESULTS: not due before any offset/time (идущий матч -> только live, без зачёта) =====');
{
  let st={tree:{autocfg:{results:{on:true,after:[180],times:[],last:0},newgames:{on:false}},meta:{bank:100},players:{},
    matches:{m1:mtch('1',-60,'501')},bets:{}},espn:{events:[]}};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  // матч идёт (1ч назад) -> live-сбор активен (НЕ skipped), но без зачёта/новых игр (ESPN-мок пуст -> live=0)
  ok(!r.skipped&&!r.results&&!r.newgames&&(r.live||0)===0&&st.tree.matches.m1.settled!==true,'match only 1h old: live-прогон, без зачёта/новых игр');
}

console.log('\n===== RESULTS: fixed time triggers (additive with offsets) =====');
{
  let st={tree:{autocfg:{results:{on:true,after:[],times:[israelHHMM(-1)],last:0},newgames:{on:false}},meta:{bank:100},players:{},
    matches:{m1:Object.assign(mtch('1',-240,'502'),{drawOK:true})},bets:{}},
    espn:{events:[postEvt('502','H','A',false,true,'0','1')]}};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(!r.skipped&&r.results===true,'results due via fixed time');
  ok(st.tree.matches.m1.winner==='B','settled to B');
}

console.log('\n===== NEWGAMES: independent of results (results off) =====');
{
  let st={tree:{autocfg:{results:{on:false,after:[0],times:[],last:0},newgames:{on:true,last:0}},meta:{bank:100},players:{},
    matches:{mStart:mtch('s',-30,'700')},bets:{}},espn:clone(cands)};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(!r.skipped&&r.newgames===true&&r.results===false,'newgames due, results not');
  ok(r.added>0,'topUp pulled new games');
}

console.log('\n===== MAX 3 UNSETTLED: started + future both count =====');
{
  let st={tree:{autocfg:{results:{on:false,after:[0],times:[],last:0},newgames:{on:true,last:0}},meta:{bank:100},players:{},
    matches:{mFut:mtch('f',600,'800'),mStart:mtch('s',-120,'801')},bets:{}},espn:clone(cands)};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(r.added===1,'2 unsettled (1 future + 1 started) -> adds exactly 1 (got '+r.added+')');
  const uns=Object.values(st.tree.matches).filter(m=>!m.settled).length;
  ok(uns===3,'now exactly 3 unsettled ('+uns+')');
}

console.log('\n===== already 3 unsettled -> add 0 =====');
{
  let st={tree:{autocfg:{results:{on:false,after:[0],times:[],last:0},newgames:{on:true,last:0}},meta:{bank:100},players:{},
    matches:{a:mtch('a',600,'810'),b:mtch('b',700,'811'),c:mtch('c',-120,'812')},bets:{}},espn:clone(cands)};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(r.added===0,'3 unsettled already -> add 0');
}

console.log('\n===== AFTER-SLOT REFILL: settling frees a slot -> topUp same run (newgames OFF) =====');
{
  let st={tree:{autocfg:{results:{on:true,after:[180],times:[],last:0},newgames:{on:false}},meta:{bank:100},players:{},
    matches:{done:Object.assign(mtch('d',-240,'500'),{drawOK:true}),fut1:mtch('1',600,'820'),fut2:mtch('2',700,'821')},bets:{}},
    espn:{events:[postEvt('500','H','A',true,false,'3','1'),preEvt('900','N1','N2',12)]}};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(st.tree.matches.done.settled===true,'finished match settled');
  ok(r.added===1,'freed slot refilled (added 1) though newgames off (got '+r.added+')');
}

console.log('\n===== 365scores: pull upcoming Israeli game (Hebrew names) =====');
{
  const mTA='\u05d4\u05e4\u05d5\u05e2\u05dc \u05d1\u05d0\u05e8 \u05e9\u05d1\u05e2'; // הפועל באר שבע
  const mTB='\u05d1\u05d9\u05ea\u05f4\u05e8 \u05d9\u05e8\u05d5\u05e9\u05dc\u05d9\u05dd'; // ביתר ירושלים
  let st={tree:{autocfg:{results:{on:false,after:[0],times:[],last:0},newgames:{on:true,last:0}},meta:{bank:100},players:{},
    matches:{seed:m365('s',-30,'111','\u05de\u05db\u05d1\u05d9 \u05ea\u05dc \u05d0\u05d1\u05d9\u05d1','\u05d4\u05e4\u05d5\u05e2\u05dc \u05d7\u05d9\u05e4\u05d4')},bets:{}},
    espn:{events:[]},s365:{games:[g365(222,mTA,mTB,20,false)]}};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(r.added===1,'pulled 1 upcoming 365 game');
  const added=Object.values(st.tree.matches).find(m=>m.fx==='365222');
  ok(added&&added.fxLeague==='365:42','added 365 match keeps fxLeague 365:42');
  ok(added&&added.teamA===mTA&&added.teamB===mTB,'team names in Hebrew from 365');
  ok(added&&added.drawOK===true,'365 league match draw-enabled');
}

console.log('\n===== 365scores: settle from 365 result (1-2 -> B) =====');
{
  let st={tree:{autocfg:{results:{on:true,after:[180],times:[],last:0},newgames:{on:false}},meta:{bank:100},players:{},
    matches:{m1:m365('1',-240,'333','A','B')},bets:{}},
    espn:{events:[]},s365:{games:[g365(333,'A','B',-4,true,1,2)]}};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(st.tree.matches.m1.settled===true&&st.tree.matches.m1.winner==='B','365 match settled to B from 365 result');
}

console.log('\n===== dt timezone: 18:00Z -> 21:00 Israel (IDT) =====');
{
  let st={tree:{autocfg:{results:{on:false,after:[0],times:[],last:0},newgames:{on:true,last:0}},meta:{bank:100},players:{},
    matches:{mStart:mtch('s',-30,'995')},bets:{}},espn:{events:[preEvt('300','A','B',0)]}};
  st.espn.events[0].date='2026-06-20T18:00:00Z';
  globalThis.fetch=makeFetch(st);
  await RC();
  const m300=Object.values(st.tree.matches).find(m=>m.fx==='espn300');
  ok(m300&&m300.dt==='2026-06-20T21:00','18:00Z -> 21:00 Israel (got '+(m300&&m300.dt)+')');
}

console.log('\n===== MIGRATION: old autocfg {enabled,times,add35} still runs + writes new shape =====');
{
  let st={tree:{autocfg:{enabled:true,times:[israelHHMM(-1)],add35:true,lastAdd:0,lastFill:0},meta:{bank:100},players:{},
    matches:{mDone:Object.assign(mtch('s',-240,'990'),{drawOK:true})},bets:{}},espn:{events:[postEvt('990','H','A',true,false,'2','0')]}};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(!r.skipped,'old-format autocfg migrated -> runs (results due via after:[180])');
  ok(st.tree.matches.mDone.settled===true,'old-format: match settled');
  ok(typeof (st.tree.autocfg.newgames||st.tree.autocfg.results)==='object','new-format config written back');
}

console.log('\n===== NEWGAMES = RESULTS + 5min (derived; offset-based, deterministic) =====');
{
  // results.after=[60]; newgames производный = [65]. матч начался 62 мин назад -> results-порог (60) пройден,
  // newgames-порог (65) ещё НЕ пройден (нужно +65) -> newgames НЕ due. Запас 3 мин -> без флаки.
  let st={tree:{autocfg:{results:{on:false,after:[60],times:[],last:0},newgames:{on:true,last:0}},meta:{bank:100},players:{},
    matches:{m:mtch('s',-62,'970')},bets:{}},espn:clone(cands)};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok(r.skipped===true||r.newgames===false,'newgames NOT due at +60 (ждёт +65 = results+5)');
  ok((r.added||0)===0,'игры ещё не добавлены (+5 не достигнут)');
  // матч начался 68 мин назад -> newgames-порог 65 пройден -> due
  let st2={tree:{autocfg:{results:{on:false,after:[60],times:[],last:0},newgames:{on:true,last:0}},meta:{bank:100},players:{},
    matches:{m:mtch('s',-68,'971')},bets:{}},espn:clone(cands)};
  globalThis.fetch=makeFetch(st2);
  let r2=await RC();
  ok(r2.newgames===true,'newgames due at +68 (>= results+5 = 65)');
  ok((r2.added||0)>0,'игры загружены');
}

console.log('\n'+(fails?('\x1b[31mFAILED '+fails+'/'+tests+'\x1b[0m'):('\x1b[32mALL PASS '+tests+'/'+tests+'\x1b[0m')));process.exit(fails?1:0);
})();
