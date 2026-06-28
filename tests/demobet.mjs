// demobet.mjs (server) — ЗАКОН ДЕНЕГ на сервере (крон runCheck): авто-заливка при сеттле
// ставит 1₪ ТОЛЬКО оплатившим игрокам с реальными деньгами. Демо (feePaid:false) — НИКОГДА,
// даже если у демо остался ненулевой dep. Серверный availFor считает доступное от РЕАЛЬНОГО
// депозита (srvDep), а не от плоского bank. В минус — никогда.
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
// завершённый ESPN-матч с заданным победителем (hw/aw — флаг winner)
function postEvt(id,h,a,hw,aw,hs,as){return {id,date:new Date(now-3*36e5).toISOString(),status:{type:{state:'post',completed:true}},competitions:[{competitors:[{homeAway:'home',winner:hw,score:hs,team:{displayName:h}},{homeAway:'away',winner:aw,score:as,team:{displayName:a}}]}]};}
function mtch(id,dtOff,fxid){return {round:'R32',teamA:'H'+id,teamB:'A'+id,dt:ilWall(dtOff),fx:'espn'+fxid,fxLeague:'fifa.world',settled:false,winner:null,drawOK:false,order:0,t:1};}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const RC=mod.runCheck;
const srvBalance=mod.srvBalance;

// матч начался 240 мин назад -> results.after:[180] due. Победитель — гость (A проигрывает),
// так что любая авто-ставка на A теряет 1₪ (ловит уход демо в минус).
const st={tree:{
  autocfg:{results:{on:true,after:[180],times:[],last:0},newgames:{on:false}},
  meta:{bank:100,lastIdleCheck:now,lastCashPurge:now}, // глушим idle/purge-свипы: тест про авто-заливку
  players:{
    paid :{name:'Paid',     feePaid:true,  dep:100, t:1},
    winB :{name:'WinB',     feePaid:true,  dep:100, t:1}, // ставит на победителя B -> касса не пустая
    demo :{name:'Demo',     feePaid:false,          t:2}, // dep=null -> srvDep=0
    rdemo:{name:'ResetDemo', feePaid:false, dep:5,   t:3}, // остаточный dep
    gone :{name:'Gone',     feePaid:true,  dep:100, exited:true, t:4}
  },
  matches:{m1:Object.assign(mtch('1',-240,'1'),{drawOK:true})},
  bets:{m1:{winB:{team:'B',stake:1,t:1}}} // ручная ставка на B (победитель)
},espn:{events:[postEvt('1','H1','A1',false,true,'0','1')]},s365:{games:[]}};

globalThis.fetch=makeFetch(st);
await RC();

const matches=Object.keys(st.tree.matches).map(id=>({id,...st.tree.matches[id]}));
const bets=st.tree.bets||{};
const b=bets.m1||{};
const P=st.tree.players;
const bal=id=>srvBalance({id,...P[id]},matches,bets,100).balance;

console.log('===== server cron auto-fill: money law =====');
ok(st.tree.matches.m1.settled===true&&st.tree.matches.m1.winner==='B','match settled to B (away win)');
ok(b.paid&&b.paid.auto===true&&b.paid.stake===1,'paid player auto-filled by cron (1\u20aa)');
ok(!b.demo ,'demo (dep=null) NOT auto-filled by cron');
ok(!b.rdemo,'reset-demo (dep=5) NOT auto-filled by cron (feePaid gate)');
ok(!b.gone ,'exited NOT auto-filled by cron');

console.log('\n===== no negative balances =====');
ok(bal('paid')>=99-1e-9 && bal('paid')<=99+1e-9,'paid: lost 1\u20aa auto-bet on A -> 99 (got '+bal('paid')+')');
ok(bal('demo')>=0-1e-9 ,'demo: balance not negative (got '+bal('demo')+')');
ok(bal('rdemo')>=0-1e-9,'reset-demo: balance not negative (got '+bal('rdemo')+')');

console.log((fails?'FAILED ':'ALL PASS ')+(tests-fails)+'/'+tests);
process.exit(fails?1:0);
})();
