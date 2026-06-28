// datalink.js — СВЯЗЬ (Firebase REST round-trip через mock fetch) + ВАЛИДАЦИЯ/устойчивость buildState к битым данным + форма ESPN/365.
const {loadApp}=require('./applib.js');
let tests=0,fails=0;
const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};

(async()=>{
  // ===== 1. Firebase REST round-trip =====
  const A=loadApp({meta:{bank:100},players:{p1:{name:'Alice',t:1}},matches:{m1:{teamA:'X',teamB:'Y',round:'R32',order:1,t:1}},bets:{}});
  const S=A.sandbox;
  await S.fbSet('/bets/m1/p1',{team:'A',stake:5,t:1});
  let v=await S.fbGet('/bets/m1/p1');
  ok(v&&v.team==='A'&&v.stake===5,'fbSet→fbGet: ставка записана и читается (PUT/GET)');
  await S.fbUpd('/players/p1',{feePaid:true});
  v=await S.fbGet('/players/p1');
  ok(v&&v.feePaid===true&&v.name==='Alice','fbUpd мержит (PATCH: feePaid добавлен, name сохранён)');
  await S.fbDel('/bets/m1/p1');
  v=await S.fbGet('/bets/m1/p1');
  ok(v==null,'fbDel удаляет узел (DELETE→null)');
  await S.fbSet('/bets/m1/p1',{team:'B',stake:3,t:2});
  S.buildState(A.state.tree);
  const m=S.S.matches.find(x=>x.id==='m1');
  ok(m&&m.bets.p1&&m.bets.p1.team==='B','buildState из живого дерева видит ставку p1=B/3');
  ok(S.S.players.length===1&&S.S.players[0].name==='Alice','buildState видит игрока из дерева');

  // ===== 2. устойчивость buildState к битым/неполным данным =====
  const tryBuild=(t,label)=>{try{S.buildState(t);return true;}catch(e){console.log('   CRASH:',label,e&&e.message);return false;}};
  ok(tryBuild(null,'null'),'buildState(null) не падает');
  ok(S.S.players.length===0&&S.S.matches.length===0,'  → пустые players/matches');
  ok(tryBuild(undefined,'undefined'),'buildState(undefined) не падает');
  ok(tryBuild({},'{}'),'buildState({}) не падает');
  ok(tryBuild({players:{x:{}}},'player-без-полей'),'игрок без полей не падает');
  ok(S.S.players[0]&&S.S.players[0].name===''&&S.S.players[0].feePaid===undefined,'  → name="",feePaid=undefined (tri-state)');
  ok(tryBuild({matches:{m:{}}},'матч-без-полей'),'матч без teamA/teamB не падает');
  ok(S.S.matches[0]&&S.S.matches[0].teamA===''&&S.S.matches[0].winner===null,'  → teamA="",winner=null');
  // нечисловой stake → calcMatch трактует как 0 (не NaN)
  S.buildState({players:{p1:{name:'A',t:1},p2:{name:'B',t:2}},matches:{m1:{teamA:'A',teamB:'B',settled:true,winner:'A',round:'R32'}},bets:{m1:{p1:{team:'A',stake:'oops'},p2:{team:'B',stake:4}}}});
  let c=S.calcMatch(S.S.matches[0]);
  ok(isFinite(c.pool)&&!isNaN(c.pool)&&c.pool===4,'нечисловая ставка → касса=4 (не NaN, "oops"→0)');
  // осиротевшая ставка (нет такого матча) — игнор, не падает
  ok(tryBuild({players:{p1:{name:'A',t:1}},matches:{},bets:{ghost:{p1:{team:'A',stake:5}}}}),'осиротевшая ставка не падает');
  ok(S.S.matches.length===0,'  → сиротские ставки игнорируются');
  // winner есть, но settled=false → выплат нет
  S.buildState({players:{p1:{name:'A',t:1}},matches:{m1:{teamA:'A',teamB:'B',settled:false,winner:'A',round:'R32'}},bets:{m1:{p1:{team:'A',stake:5}}}});
  ok(Object.keys(S.calcMatch(S.S.matches[0]).payouts).length===0,'winner при settled=false → выплат нет');
  // повреждённый meta → defMeta дефолты сохраняются
  S.buildState({meta:{bank:'NaN-ish'},players:{},matches:{},bets:{}});
  ok(S.S.meta&&typeof S.S.meta.minBet!=='undefined'&&typeof S.S.meta.maxBet!=='undefined','битый meta → дефолты defMeta() на месте');

  // ===== 3. форма данных ESPN / 365scores (mock fetch отдаёт как есть) =====
  const B=loadApp({meta:{bank:100},players:{},matches:{},bets:{}},{espn:{events:[{id:'1',status:{type:{completed:true}}}]},s365:{games:[{id:7}]}});
  const espn=await (await B.sandbox.fetch('https://site.api.espn.com/scoreboard')).json();
  ok(espn&&Array.isArray(espn.events)&&espn.events.length===1,'ESPN mock отдаёт events[] корректной формы');
  const s365=await (await B.sandbox.fetch('https://webws.365scores.com/web/games/')).json();
  ok(s365&&Array.isArray(s365.games)&&s365.games.length===1,'365scores mock отдаёт games[] корректной формы');
  // неизвестный матч в Firebase mock → GET возвращает null (не бросает)
  const none=await B.sandbox.fbGet('/matches/zzz');
  ok(none==null,'GET несуществующего узла → null');

  if(fails)console.log('datalink FAILED '+fails+'/'+tests);
  else console.log('\u2705 datalink: '+tests+' passed, 0 failed');
})().catch(e=>{console.log('FAIL: uncaught',e);process.exit(1);});
