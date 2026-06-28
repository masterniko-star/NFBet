// resetnewgames.mjs — БАГ «после איפוס игры возвращаются» (task 7, серверная сторона).
// После сброса autocfg.newgames.on=false + матчей нет -> крон НЕ должен дозагружать игры.
// Контроль: при newgames.on=true и пустых матчах с due-временем крон БЫ добавил (это и есть баг, который мы гасим).
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
function preEvt(id,h,a,offH){return {id,date:new Date(now+offH*36e5).toISOString(),status:{type:{state:'pre',completed:false}},competitions:[{competitors:[{homeAway:'home',team:{displayName:h}},{homeAway:'away',team:{displayName:a}}]}]};}
function israelHHMM(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));return (p.find(x=>x.type==='hour').value)+':'+(p.find(x=>x.type==='minute').value);}
function ilWall(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));const g=t=>p.find(x=>x.type===t).value;return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('  FAIL: '+m);}else console.log('  ok   '+m);};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const RC=mod.runCheck;
const cands={events:[preEvt('900','A','B',12),preEvt('901','C','D',20),preEvt('902','E','F',30)]};

console.log('===== POST-RESET: newgames OFF -> even with a due results-time + no matches, nothing added =====');
{
  // как пишет aResetDo: results остаётся on (с временем), newgames.on=false. matches пусты.
  let st={tree:{autocfg:{results:{on:true,after:[180],times:[israelHHMM(-30)],last:0},newgames:{on:false,last:0}},
    meta:{bank:100},players:{p1:{name:'A',feePaid:true,dep:100}},matches:{},bets:{}},espn:clone(cands)};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok((r.added||0)===0,'newgames OFF -> no games added even though results-time is due');
  ok(Object.keys(st.tree.matches||{}).length===0,'matches still empty after cron run');
}

console.log('\n===== CONTROL: newgames ON -> topUp срабатывает (доказывает, что вкл/выкл и есть тормоз) =====');
{
  // детерминированно по оффсету (без привязки к стенным часам/полуночи): results.after=[60] -> newgames=[65];
  // матч начался 70 мин назад -> newgames-порог 65 пройден -> due. results.on=false (без сеттла/слот-рефилла).
  let st={tree:{autocfg:{results:{on:false,after:[60],times:[],last:0},newgames:{on:true,last:0}},
    meta:{bank:100},players:{},
    matches:{m:{round:'R32',teamA:'H',teamB:'A',dt:ilWall(-70),fx:'espn555',fxLeague:'fifa.world',settled:false,winner:null,drawOK:false,order:0,t:1}},bets:{}},espn:clone(cands)};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok((r.added||0)>0,'control: newgames ON -> topUp добавляет игры (added '+(r.added||0)+'); при OFF — нет');
}

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
