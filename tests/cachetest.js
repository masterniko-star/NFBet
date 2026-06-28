const {loadApp}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const fut=new Date(Date.now()+10*36e5).toISOString().slice(0,16);
const seed={meta:{bank:100,cur:'\u20aa'},players:{a:{name:'Alex',pw:'x',feePaid:true,t:1}},
  matches:{m1:{round:'R16',order:0,teamA:'X',teamB:'Y',dt:fut,settled:false,winner:null}},
  bets:{m1:{a:{team:'A',stake:7}}},
  diag:{server:{items:[{ts:1,msg:'L'.repeat(600)}]},dev1:{items:[{ts:1,msg:'x'.repeat(400)}]}},rev:5};

console.log('===== cache: save strips /diag, load roundtrips =====');
{
  const A=loadApp(seed,{});A.sandbox.cacheSave(A.state.tree);
  const raw=A.sandbox.localStorage.getItem('nfpT_'+A.sandbox._ckSuf);
  ok(!!raw,'cache written');
  const p=JSON.parse(raw);
  ok(!p.diag,'cache excludes /diag (logs do not bloat boot)');
  ok(p.players&&p.matches&&p.bets&&p.rev===5,'cache keeps players/matches/bets/rev');
  ok(raw.length<700,'cache small without diag ('+raw.length+'B; diag alone ~1000B)');
}
console.log('\n===== cache: render from cache (what boot does) =====');
{
  const A=loadApp(seed,{});A.sandbox.cacheSave(A.state.tree);
  const ct=A.sandbox.cacheLoad();ok(!!ct&&ct.players.a.name==='Alex','cacheLoad usable');
  A.sandbox.MODE='player';A.sandbox.ME='a';A.sandbox.buildState(ct);
  ok(A.sandbox.statsFor('a').balance===93,'balance from cache = 93 (100-7 open bet)');
  A.sandbox.renderActive();
  const h=(A.q('#main')||{}).innerHTML||'';
  ok(h.length>50,'renderActive from cache produced content (instant boot paint)');
}
console.log('\n===== cache: last tab roundtrip =====');
{
  const A=loadApp(seed,{});
  A.sandbox.cacheTab('all');ok(A.sandbox.cacheTabLoad()==='all','tab saved/loaded');
  A.sandbox.cacheTab('hist');ok(A.sandbox.cacheTabLoad()==='hist','tab updated');
}
console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
