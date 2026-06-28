// legacytest — back-compat. A real production tree (after the refactor) still carries
// leftover fields from the old version: players.strat/astake, matches.fav, autocfg without add35.
// These MUST be ignored: no phantom strategy bets, auto-fill on home A (NOT stale match.fav),
// existing fixed schedule kept (not reset to 08:00/20:00).
function clone(o){return JSON.parse(JSON.stringify(o||{}));}
function makeFetch(state){
  function segs(u){u=u.replace(/^https?:\/\/[^/]+/,'').replace(/\?.*$/,'').replace(/\.json$/,'');return u.split('/').filter(Boolean);}
  const get=s=>{let n=state.tree;for(const k of s){if(n==null)return null;n=n[k];}return n==null?null:n;};
  const set=(s,v)=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)n[s[i]]={};n=n[s[i]];}n[s[s.length-1]]=v;};
  const patch=(s,v)=>{let n=state.tree;for(const k of s){if(n[k]==null)n[k]={};n=n[k];}Object.assign(n,v);};
  return async function(url,opts){opts=opts||{};const m=(opts.method||'GET').toUpperCase();
    if(/site\.api\.espn\.com/.test(url))return {ok:true,json:async()=>state.espn||{events:[]}};
    const s=segs(url);let body=null;try{body=opts.body?JSON.parse(opts.body):null;}catch(e){}
    let v=null;
    if(m==='GET')v=s.length?get(s):state.tree;
    else if(m==='PUT'){if(s.length)set(s,body);else state.tree=body;v=body;}
    else if(m==='PATCH'){if(s.length)patch(s,body);else Object.assign(state.tree,body);v=body;}
    else if(m==='DELETE'){v=null;}
    return {ok:true,json:async()=>v==null?null:clone(v)};
  };
}
const now=Date.now();
function ilWall(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));const g=t=>p.find(x=>x.type===t).value;return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');}
function postEvt(id,h,a,hw,aw,hs,as){return {id,date:new Date(now-3*36e5).toISOString(),status:{type:{state:'post',completed:true}},competitions:[{competitors:[{homeAway:'home',winner:hw,score:hs,team:{displayName:h}},{homeAway:'away',winner:aw,score:as,team:{displayName:a}}]}]};}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('  FAIL: '+m);}else console.log('  ok   '+m);};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const RC=mod.runCheck;

console.log('===== back-compat: legacy prod tree (strat/astake/fav + old autocfg) =====');
const tree={
  meta:{bank:100,minBet:1,maxBet:10},
  // old autocfg shape from prod: explicit fixed hours, NO add35 key, leftover lastFav
  autocfg:{enabled:true,times:['03:00','09:00','15:00','21:00'],lastAdd:0,lastFav:1700000000000},
  players:{
    p0:{name:'Strong',feePaid:true,strat:'strong',astake:7},   // leftover strategy fields
    p1:{name:'Self',feePaid:true,strat:'self',astake:0},        // leftover (self)
    p2:{name:'Clean',feePaid:true}                              // no leftover
  },
  matches:{
    // mature (settles), leftover fav='B' must be IGNORED by the ₪1-on-A fill
    m1:{round:'R32',teamA:'H',teamB:'A',dt:ilWall(-240),fx:'espn500',fxLeague:'fifa.world',settled:false,winner:null,fav:'B',order:0,t:1},
    // open/future, leftover fav='A' — must stay completely bet-less (no phantom strategy bet for p0)
    m2:{round:'R32',teamA:'X',teamB:'Y',dt:ilWall(600),fx:'espn600',fxLeague:'fifa.world',settled:false,winner:null,fav:'A',order:1,t:2}
  },
  bets:{ m1:{ p0:{team:'A',stake:3} } }   // p1,p2 are non-bettors on m1
};
const st={tree:clone(tree),espn:{events:[postEvt('500','H','A',true,false,'2','0')]}};
globalThis.fetch=makeFetch(st);
const r=await RC();

ok(!r.skipped,'legacy tree runs without skip (mature match present)');
ok(st.tree.matches.m1.settled===true&&st.tree.matches.m1.winner==='A','m1 settled to A (home win)');

const a1=Object.keys(st.tree.bets.m1).filter(k=>st.tree.bets.m1[k].auto);
ok(a1.length===2,'2 non-bettors auto-filled on m1 (p1,p2): '+a1.length);
ok(a1.every(k=>st.tree.bets.m1[k].team==='A'),'auto-fill on home A — stale match.fav=B IGNORED');
ok(a1.every(k=>st.tree.bets.m1[k].stake===1),'auto-fill stake = ₪1');
ok(st.tree.bets.m1.p0&&st.tree.bets.m1.p0.team==='A'&&!st.tree.bets.m1.p0.auto,'p0 manual bet untouched (no strategy override)');

const m2bets=st.tree.bets.m2||{};
ok(Object.keys(m2bets).length===0,'open m2 has ZERO bets — leftover strat=strong made NO phantom auto-bet');

ok(JSON.stringify(st.tree.autocfg.times)===JSON.stringify(['03:00','09:00','15:00','21:00']),'existing fixed schedule preserved (NOT reset to 08:00/20:00)');
ok(!('add35' in tree.autocfg)&&!r.skipped,'autocfg without add35 key handled (defaults applied, no crash)');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
