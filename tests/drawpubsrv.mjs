// AUDIT (server): topUp publishes new games with correct drawOK (league/group -> true, knockout -> false).
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
function ilWall(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));const g=t=>p.find(x=>x.type===t).value;return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');}
function preEvt(id,h,a,offH,stage){const e={id,date:new Date(now+offH*36e5).toISOString(),status:{type:{state:'pre',completed:false}},competitions:[{competitors:[{homeAway:'home',team:{displayName:h}},{homeAway:'away',team:{displayName:a}}]}]};if(stage)e.competitions[0].notes=[{headline:stage}];return e;}
function g365(id,h,a,offH){return {id,startTime:new Date(now+offH*36e5).toISOString(),statusGroup:1,homeCompetitor:{id:String(id)+'h',name:h,score:-1},awayCompetitor:{id:String(id)+'a',name:a,score:-1}};}
// started+unsettled source match in league `lg` -> triggers newgames(after:[0]) and sets the source league
function src(lg,fxid){return {round:'R32',teamA:'Src',teamB:'Match',dt:ilWall(-60),fx:'espn'+fxid,fxLeague:lg,settled:false,winner:null,drawOK:false,order:0,t:1};}
// newgames timing derives from results+5 -> drive via results.after:[0] (newgames fires at +5)
const NG=()=>({results:{on:false,after:[0],times:[],last:0},newgames:{on:true,last:0}});
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const RC=mod.runCheck;

async function run(seedMatches,espn,s365){
  const st={tree:{autocfg:NG(),meta:{bank:100},players:{},matches:seedMatches,bets:{}},espn:espn||{events:[]},s365:s365||{games:[]}};
  globalThis.fetch=makeFetch(st);
  await RC();
  return Object.values(st.tree.matches);
}

console.log('===== league (eng.1) pool -> new game drawOK=true =====');
{
  const ms=await run({s:src('eng.1','900')},{events:[preEvt('1001','Arsenal','Chelsea',12,'')]});
  const added=ms.find(m=>m.fx==='espn1001');
  ok(!!added,'eng.1: new league game added');
  ok(added&&added.fxLeague==='eng.1','eng.1: fxLeague preserved');
  ok(added&&added.drawOK===true,'eng.1: new game drawOK=true (league)');
}

console.log('\n===== WC knockout (fifa.world + Round of 16) -> drawOK=false =====');
{
  const ms=await run({s:src('fifa.world','910')},{events:[preEvt('2001','Brazil','Spain',12,'Round of 16')]});
  const added=ms.find(m=>m.fx==='espn2001');
  ok(!!added,'WC KO: new game added');
  ok(added&&added.drawOK===false,'WC knockout (Round of 16): new game drawOK=false');
}

console.log('\n===== WC group (fifa.world + Group A) -> drawOK=true =====');
{
  const ms=await run({s:src('fifa.world','920')},{events:[preEvt('3001','Argentina','Mexico',12,'Group A')]});
  const added=ms.find(m=>m.fx==='espn3001');
  ok(!!added,'WC group: new game added');
  ok(added&&added.drawOK===true,'WC group stage: new game drawOK=true');
}

console.log('\n===== 365 Israeli league -> drawOK=true =====');
{
  const ms=await run({s:src('365:42','930')},null,{games:[g365(4001,'מכבי חיפה','הפועל באר שבע',12)]});
  const added=ms.find(m=>m.fx==='3654001');
  ok(!!added,'365: new league game added');
  ok(added&&added.fxLeague==='365:42','365: fxLeague=365:42');
  ok(added&&added.drawOK===true,'365 Israeli league: new game drawOK=true');
}

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
