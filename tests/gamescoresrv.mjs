// gamescoresrv.mjs (server) — сервер пишет реальный счёт матча в /live/{fx}.{a,b}.
// fetchLive берёт счёт из ESPN competitions[0].competitors (home=teamA -> a, away=teamB -> b);
// при смене счёта (гол) дёргается /rev, чтобы клиент перечитал и обновил табло.
// Мок эмулирует Firebase RTDB: ключи со значением null НЕ хранятся (удаляются) — чтобы проверить #4 (null/undefined).
function clone(o){return JSON.parse(JSON.stringify(o||{}));}
function stripNull(v){ // как Firebase: отбросить ключи со значением null
  if(v&&typeof v==='object'&&!Array.isArray(v)){const o={};for(const k in v){if(v[k]!==null)o[k]=stripNull(v[k]);}return o;}
  return v;}
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
    else if(m==='PUT'){body=stripNull(body);if(s.length)set(s,body);else state.tree=body;v=body;}
    else if(m==='PATCH'){body=stripNull(body);if(s.length)patch(s,body);else Object.assign(state.tree,body);v=body;}
    else if(m==='DELETE'){if(s.length)del(s);v=null;}
    return {ok:true,json:async()=>v==null?null:clone(v)};
  };
}
const now=Date.now();
function ilWall(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));const g=t=>p.find(x=>x.type===t).value;return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');}
// идущий матч (state:"in"); hs/as = строки счёта; undefined -> без счёта (как у ESPN до первой минуты)
function inEvt(id,h,a,hs,as,clk){const home={homeAway:'home',team:{displayName:h}},away={homeAway:'away',team:{displayName:a}};if(hs!==undefined)home.score=hs;if(as!==undefined)away.score=as;
  return {id,date:new Date(now).toISOString(),status:{displayClock:clk||"23'",period:1,type:{state:'in',name:'STATUS_FIRST_HALF',description:'1st Half'}},competitions:[{competitors:[home,away]}]};}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('  FAIL: '+m);}else console.log('  ok   '+m);};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const RC=mod.runCheck;
const baseAutocfg={results:{on:false,after:[],times:[],last:0},newgames:{on:false,last:0}};
const liveMatch=()=>({m:{round:'R32',teamA:'Netherlands',teamB:'Morocco',dt:ilWall(-30),fx:'espn800',fxLeague:'fifa.world',settled:false,winner:null,drawOK:false,order:0,t:1}});

console.log('===== 1) идущий матч -> /live содержит счёт a:b =====');
{
  let st={tree:{autocfg:clone(baseAutocfg),meta:{bank:100},players:{},matches:liveMatch(),bets:{}},
    espn:{events:[inEvt('800','Netherlands','Morocco','1','0')]}};
  globalThis.fetch=makeFetch(st);
  await RC();
  const lv=st.tree.live&&st.tree.live.espn800;
  ok(!!lv,'/live/espn800 записан');
  ok(lv&&lv.a===1&&lv.b===0,'счёт a=1 (Netherlands), b=0 (Morocco)');
  ok(lv&&typeof lv.clk==='string'&&lv.ts>0,'время clk и ts тоже на месте');
}

console.log('\n===== 2) гол (смена счёта) -> /rev дёргается; тот же счёт -> нет =====');
{
  let st={tree:{autocfg:clone(baseAutocfg),meta:{bank:100},players:{},matches:liveMatch(),bets:{}},
    espn:{events:[inEvt('800','Netherlands','Morocco','1','0')]}};
  globalThis.fetch=makeFetch(st);
  await RC();
  const rev1=st.tree.rev;
  await RC();
  ok(st.tree.rev===rev1,'тот же счёт: /rev не дёргается повторно');
  st.espn={events:[inEvt('800','Netherlands','Morocco','2','0')]};
  await RC();
  ok(st.tree.live.espn800.a===2,'после гола счёт обновился до 2:0');
  ok(st.tree.rev!==rev1,'смена счёта дёрнула /rev (клиент перечитает)');
}

console.log('\n===== 3) #4: без счёта (a/b=null, Firebase их удаляет) -> нет churn /rev =====');
{
  let st={tree:{autocfg:clone(baseAutocfg),meta:{bank:100},players:{},matches:liveMatch(),bets:{}},
    espn:{events:[inEvt('800','Netherlands','Morocco',undefined,undefined,"3'")]}}; // идёт, но ESPN ещё без счёта
  globalThis.fetch=makeFetch(st);
  await RC();
  const lv=st.tree.live.espn800;
  ok(lv&&lv.a===undefined&&lv.b===undefined,'без счёта: a/b не хранятся (как в Firebase)');
  const rev1=st.tree.rev;
  await RC(); // тот же прогон, счёта по-прежнему нет
  ok(st.tree.rev===rev1,'повтор без счёта: /rev НЕ дёргается (null/undefined нормализованы)');
}

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
