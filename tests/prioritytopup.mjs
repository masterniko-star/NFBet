// AUDIT (server): topUp priority mode — fills up to `want` open games TOTAL,
// walking selected leagues in order; empty leagues -> old behavior (source from matches).
function clone(o){return JSON.parse(JSON.stringify(o||{}));}
function makeFetch(state){
  function segs(u){u=u.replace(/^https?:\/\/[^/]+/,'').replace(/\?.*$/,'').replace(/\.json$/,'');return u.split('/').filter(Boolean);}
  const get=s=>{let n=state.tree;for(const k of s){if(n==null)return null;n=n[k];}return n==null?null:n;};
  const set=(s,v)=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)n[s[i]]={};n=n[s[i]];}n[s[s.length-1]]=v;};
  const patch=(s,v)=>{let n=state.tree;for(const k of s){if(n[k]==null)n[k]={};n=n[k];}Object.assign(n,v);};
  const del=s=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)return;n=n[s[i]];}delete n[s[s.length-1]];};
  return async function(url,opts){opts=opts||{};const m=(opts.method||'GET').toUpperCase();
    if(/webws\.365scores\.com/.test(url)){const cp=(url.match(/competitions=([^&]+)/)||[])[1];return {ok:true,json:async()=>state.s365[cp]||{games:[]}};}
    if(/site\.api\.espn\.com/.test(url)){const sl=(url.match(/soccer\/([^/]+)\//)||[])[1];return {ok:true,json:async()=>state.espn[decodeURIComponent(sl||'')]||{events:[]}};}
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
function preEvt(id,h,a,offH){return {id,date:new Date(now+offH*36e5).toISOString(),status:{type:{state:'pre',completed:false}},competitions:[{competitors:[{homeAway:'home',team:{displayName:h}},{homeAway:'away',team:{displayName:a}}]}]};}
function g365(id,h,a,offH){return {id,startTime:new Date(now+offH*36e5).toISOString(),statusGroup:1,homeCompetitor:{id:String(id)+'h',name:h,score:-1},awayCompetitor:{id:String(id)+'a',name:a,score:-1}};}
// started+unsettled source match -> triggers newgames(after:[0]); its league only matters in fallback mode
function src(lg,fxid){return {round:'R32',teamA:'Src',teamB:'Match',dt:ilWall(-60),fx:'espn'+fxid,fxLeague:lg,settled:false,winner:null,drawOK:false,order:0,t:1};}
// newgames fires at results+5; drive via results.after:[0]
function cfg(extra){return {results:{on:false,after:[0],times:[],last:0},newgames:Object.assign({on:true,last:0},extra||{})};}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const RC=mod.runCheck;

async function run(autocfg,seedMatches,espn,s365){
  const st={tree:{autocfg,meta:{bank:100},players:{},matches:seedMatches,bets:{}},espn:espn||{},s365:s365||{}};
  globalThis.fetch=makeFetch(st);
  await RC();
  return Object.values(st.tree.matches);
}
const wc=n=>({events:Array.from({length:n},(_,i)=>preEvt('wc'+i,'WC'+i+'H','WC'+i+'A',10+i))});
const en=n=>({events:Array.from({length:n},(_,i)=>preEvt('en'+i,'EN'+i+'H','EN'+i+'A',10+i))});
const isr=n=>({'42':{games:Array.from({length:n},(_,i)=>g365(5000+i,'ISR'+i+'H','ISR'+i+'A',10+i))}});

console.log('===== priority: want=6, [Israeli(2), WorldCup(5), English(5)] -> 2+3+0 =====');
{
  const ms=await run(
    cfg({want:6,leagues:['365:42','fifa.world','eng.1']}),
    {s:src('ita.1','900')},
    {'fifa.world':wc(5),'eng.1':en(5),'ita.1':{events:[]}},
    isr(2)
  );
  const added=ms.filter(m=>m.fx!=='espn900');
  const by=l=>added.filter(m=>m.fxLeague===l).length;
  ok(added.length===5,'added 5 to reach want=6 (1 already open) (got '+added.length+')');
  ok(by('365:42')===2,'2 from Israeli (all it had) (got '+by('365:42')+')');
  ok(by('fifa.world')===3,'3 from World Cup (next in priority) (got '+by('fifa.world')+')');
  ok(by('eng.1')===0,'0 from English (quota met before it) (got '+by('eng.1')+')');
}

console.log('\n===== priority spillover: want=6, [Israeli(2), WorldCup(2), English(5)] -> 2+2+1 =====');
{
  const ms=await run(
    cfg({want:6,leagues:['365:42','fifa.world','eng.1']}),
    {s:src('ita.1','900')},
    {'fifa.world':wc(2),'eng.1':en(5),'ita.1':{events:[]}},
    isr(2)
  );
  const added=ms.filter(m=>m.fx!=='espn900');
  const by=l=>added.filter(m=>m.fxLeague===l).length;
  ok(added.length===5,'added 5 total (got '+added.length+')');
  ok(by('365:42')===2,'2 from Israeli (got '+by('365:42')+')');
  ok(by('fifa.world')===2,'2 from World Cup (got '+by('fifa.world')+')');
  ok(by('eng.1')===1,'1 from English (spillover of remaining slot) (got '+by('eng.1')+')');
}

console.log('\n===== fallback: empty leagues -> old behavior (source from existing matches) =====');
{
  const ms=await run(
    cfg({}), // no want/leagues -> want defaults 3, leagues [] -> fallback
    {s:src('ita.1','900')},
    {'ita.1':{events:[preEvt('i1','IA','IB',10),preEvt('i2','IC','ID',11),preEvt('i3','IE','IF',12)]}},
    {}
  );
  const added=ms.filter(m=>m.fx!=='espn900');
  ok(added.length===2,'want defaults 3, 1 open -> add 2 (got '+added.length+')');
  ok(added.every(m=>m.fxLeague==='ita.1'),'fallback pulls from the match-source league (ita.1)');
}

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
