// endcheck.mjs — независимый от автоапдейта механизм «конец игры»:
//  • результат проверяется со старт+105 мин ДАЖЕ когда results.on=false;
//  • новые игры подгружаются на старт+110 (конец+5) ТОЛЬКО при включённой автозагрузке (newgames.on), один раз на игру;
//  • после איפוס (матчей нет) ничего не срабатывает — игры не возвращаются (защита задачи-7).
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
function postEvt(id,h,a){return {id,date:new Date(now).toISOString(),status:{type:{state:'post',completed:true}},competitions:[{competitors:[{homeAway:'home',team:{displayName:h},winner:true,score:'2'},{homeAway:'away',team:{displayName:a},winner:false,score:'1'}]}]};}
function ilWall(offMin){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now+offMin*60000));const g=t=>p.find(x=>x.type===t).value;return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute');}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('  FAIL: '+m);}else console.log('  ok   '+m);};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const RC=mod.runCheck;
const cands=()=>({events:[postEvt('700','South Africa','Canada'),preEvt('900','A','B',12),preEvt('901','C','D',20),preEvt('902','E','F',30)]});

console.log('===== 1) auto-update OFF, игра окончена (>105м) -> результат зачтён независимо =====');
{
  let st={tree:{autocfg:{results:{on:false,after:[],times:[],last:0},newgames:{on:false,last:0}},
    meta:{bank:100},players:{p1:{name:'A',feePaid:true,dep:100}},
    matches:{m:{round:'R32',teamA:'South Africa',teamB:'Canada',dt:ilWall(-106),fx:'espn700',fxLeague:'fifa.world',settled:false,winner:null,drawOK:false,order:0,t:1}},bets:{}},espn:cands()};
  globalThis.fetch=makeFetch(st);
  await RC();
  ok(st.tree.matches.m.settled===true,'результат проверен и игра сведена при results.on=false');
  ok(st.tree.matches.m.winner==='A','победитель из ESPN проставлен (A)');
  ok(st.tree.autocfg.results.on===false,'тумблер results остался выключенным (механизм независимый)');
}

console.log('\n===== 2) конец+5 (>110м): доливка гейтится чекбоксом newgames.on =====');
{
  // 2a) newgames OFF -> НЕ доливает (гейт), хотя триггер конца сработал
  let stOff={tree:{autocfg:{results:{on:false,after:[],times:[],last:0},newgames:{on:false,last:0}},
    meta:{bank:100},players:{},
    matches:{m:{round:'R32',teamA:'H',teamB:'A',dt:ilWall(-111),fx:'espn556',fxLeague:'fifa.world',settled:true,winner:'A',drawOK:false,order:0,t:1}},bets:{}},espn:cands()};
  globalThis.fetch=makeFetch(stOff);
  let rOff=await RC();
  ok((rOff.added||0)===0,'newgames OFF -> конец+5 НЕ доливает (гейт)');
  // 2b) newgames ON -> доливает, затем троттлинг по endchk.ngLast
  let st={tree:{autocfg:{results:{on:false,after:[],times:[],last:0},newgames:{on:true,last:0}},
    meta:{bank:100},players:{},
    matches:{m:{round:'R32',teamA:'H',teamB:'A',dt:ilWall(-111),fx:'espn555',fxLeague:'fifa.world',settled:true,winner:'A',drawOK:false,order:0,t:1}},bets:{}},espn:cands()};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok((r.added||0)>0,'newgames ON -> конец+5 доливает (added '+(r.added||0)+')');
  ok(st.tree.autocfg.endchk&&st.tree.autocfg.endchk.ngLast>0,'отметка endchk.ngLast выставлена (троттлинг)');
  let before=Object.keys(st.tree.matches).length;
  let r2=await RC();
  ok((r2.added||0)===0,'повторный прогон сразу же: новые игры НЕ добавляются (троттлинг по ngLast)');
  ok(Object.keys(st.tree.matches).length===before,'число матчей не выросло на повторе');
}

console.log('\n===== 3) после איפוס (матчей нет), оба тумблера OFF -> ничего не подгружается =====');
{
  let st={tree:{autocfg:{results:{on:false,after:[],times:[],last:0},newgames:{on:false,last:0}},
    meta:{bank:100},players:{p1:{name:'A',feePaid:true,dep:100}},matches:{},bets:{}},espn:cands()};
  globalThis.fetch=makeFetch(st);
  let r=await RC();
  ok((r.added||0)===0,'нет матчей -> механизм «конец игры» не срабатывает');
  ok(Object.keys(st.tree.matches||{}).length===0,'матчи остались пустыми (игры не вернулись)');
}

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
})();
