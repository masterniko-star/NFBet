import assert from 'assert';
function clone(o){return JSON.parse(JSON.stringify(o||{}));}
function makeFetch(state){
  function segs(u){u=u.replace(/^https?:\/\/[^/]+/,'').replace(/\?.*$/,'').replace(/\.json$/,'');return u.split('/').filter(Boolean);}
  const get=s=>{let n=state.tree;for(const k of s){if(n==null)return null;n=n[k];}return n==null?null:n;};
  const set=(s,v)=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)n[s[i]]={};n=n[s[i]];}n[s[s.length-1]]=v;};
  const patch=(s,v)=>{let n=state.tree;for(const k of s){if(n[k]==null)n[k]={};n=n[k];}Object.assign(n,v);};
  const del=s=>{let n=state.tree;for(let i=0;i<s.length-1;i++){if(n[s[i]]==null)return;n=n[s[i]];}delete n[s[s.length-1]];};
  return async function(url,opts){opts=opts||{};const m=(opts.method||'GET').toUpperCase();
    if(/site\.api\.espn\.com/.test(url))return {ok:true,json:async()=>state.espn||{events:[]}};
    const s=segs(url);
    let body=null;try{body=opts.body?JSON.parse(opts.body):null;}catch(e){}
    let v=null;
    if(m==='GET')v=s.length?get(s):state.tree;
    else if(m==='PUT'){if(s.length)set(s,body);else state.tree=body;v=body;}
    else if(m==='PATCH'){if(s.length)patch(s,body);else Object.assign(state.tree,body);v=body;}
    else if(m==='DELETE'){if(s.length)del(s);v=null;}
    return {ok:true,json:async()=>v==null?null:clone(v)};
  };
}
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}};

(async()=>{
process.env.FIREBASE_DB_URL='https://mockdb';
const mod=await import('../netlify/functions/check-results.mjs?'+Date.now());
const now=Date.now();

function setup(td){
  const tree=clone(td);
  if(!tree.meta)tree.meta={};
  if(tree.meta.bank==null)tree.meta.bank=100;
  if(!tree.notices)tree.notices={};
  const state={tree,espn:{events:[]}};
  globalThis.fetch=makeFetch(state);
  const players=Object.keys(tree.players||{}).map(id=>({id,...tree.players[id]}));
  const matches=Object.keys(tree.matches||{}).map(id=>({id,...tree.matches[id],settled:!!tree.matches[id].settled,winner:tree.matches[id].winner||null}));
  const bets={};for(const mid in (tree.bets||{}))bets[mid]={...tree.bets[mid]};
  return {tree,players,matches,bets,bank:Number(tree.meta.bank)||100};
}
const sweep=s=>mod.overBetSweep(s.players,s.matches,s.bets,s.bank,now);

// 1. single over-bet -> trim newest open bet to fit
let s=setup({players:{p1:{name:'Over',feePaid:true,dep:100}},matches:{m1:{teamA:'X',teamB:'Y',settled:false},m2:{teamA:'P',teamB:'Q',settled:false}},bets:{m1:{p1:{team:'A',stake:60,t:1}},m2:{p1:{team:'A',stake:70,t:2}}}});
let acted=await sweep(s);
ok(s.tree.bets.m2.p1.stake===40,'1: newest over-bet trimmed 70->40');
ok(s.tree.bets.m1.p1.stake===60,'1: older bet untouched (60)');
ok(acted===1,'1: acted=1');
let s1=setup(s.tree);const b1=mod.srvBalance(s1.players[0],s1.matches,s1.bets,s1.bank);
ok(Math.abs(b1.balance)<1e-9,'1: balance back to 0 after trim');

// 2. multi-bet -> cancel newest, trim next, keep oldest
s=setup({players:{p2:{name:'Multi',feePaid:true,dep:100}},matches:{m1:{teamA:'X',teamB:'Y',settled:false},m2:{teamA:'P',teamB:'Q',settled:false},m3:{teamA:'R',teamB:'S',settled:false}},bets:{m1:{p2:{team:'A',stake:90,t:1}},m2:{p2:{team:'A',stake:30,t:2}},m3:{p2:{team:'A',stake:20,t:3}}}});
await sweep(s);
ok(!(s.tree.bets.m3&&s.tree.bets.m3.p2),'2: newest bet (m3,20) cancelled');
ok(s.tree.bets.m2.p2.stake===10,'2: next bet (m2) trimmed 30->10');
ok(s.tree.bets.m1.p2.stake===90,'2: oldest bet (m1) untouched (90)');

// 3. ва-банк NOT trimmed (free 1 >= 0)
s=setup({players:{p3:{name:'AllIn',feePaid:true,dep:100}},matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{p3:{team:'A',stake:99,t:1}}}});
acted=await sweep(s);
ok(s.tree.bets.m1.p3.stake===99,'3: ва-банк (99 of 100) NOT trimmed');
ok(acted===0,'3: acted=0');

// 4. full balance, no bets
s=setup({players:{p4:{name:'Fresh',feePaid:true,dep:100}}});
ok(await sweep(s)===0,'4: full-balance player, nothing to trim');

// 5. rounding threshold: balance -0.3 (<= 0.5) NOT trimmed
s=setup({players:{p5:{name:'Round',feePaid:true,dep:99.7}},matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{p5:{team:'A',stake:100,t:1}}}});
acted=await sweep(s);
ok(s.tree.bets.m1.p5.stake===100,'5: tiny over (0.3, rounding) NOT trimmed');
ok(acted===0,'5: acted=0 below threshold');

// 6. real over (2) trimmed
s=setup({players:{p6:{name:'Real',feePaid:true,dep:98}},matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{p6:{team:'A',stake:100,t:1}}}});
await sweep(s);
ok(s.tree.bets.m1.p6.stake===98,'6: real over (2) trimmed 100->98');

// 7. only OPEN bets trimmed; settled bets untouched
s=setup({players:{p7:{name:'Mix',feePaid:true,dep:100},pb:{name:'B',feePaid:true,dep:100}},matches:{m1:{teamA:'X',teamB:'Y',settled:true,winner:'B'},m2:{teamA:'P',teamB:'Q',settled:false}},bets:{m1:{p7:{team:'A',stake:40,t:1},pb:{team:'B',stake:40,t:1}},m2:{p7:{team:'A',stake:80,t:2}}}});
await sweep(s);
ok(s.tree.bets.m2.p7.stake===60,'7: open bet trimmed 80->60');
ok(s.tree.bets.m1.p7.stake===40,'7: settled (lost) bet untouched (40)');
ok(s.tree.bets.m1.pb.stake===40,'7: other player settled bet untouched');

// 8. exited skipped
s=setup({players:{p8:{name:'Gone',feePaid:true,dep:0,exited:true}},matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{p8:{team:'A',stake:50,t:1}}}});
await sweep(s);
ok(s.tree.bets.m1.p8.stake===50,'8: exited player not trimmed');

// 9. unpaid skipped
s=setup({players:{p9:{name:'Demo',feePaid:false,dep:0}},matches:{m1:{teamA:'X',teamB:'Y',settled:false}},bets:{m1:{p9:{team:'A',stake:50,t:1}}}});
await sweep(s);
ok(s.tree.bets.m1.p9.stake===50,'9: unpaid player not trimmed');

// 10. idempotent: second sweep is no-op
s=setup({players:{p10:{name:'X',feePaid:true,dep:100}},matches:{m1:{teamA:'X',teamB:'Y',settled:false},m2:{teamA:'P',teamB:'Q',settled:false}},bets:{m1:{p10:{team:'A',stake:60,t:1}},m2:{p10:{team:'A',stake:70,t:2}}}});
await sweep(s);
let s10=setup(s.tree);
ok(await sweep(s10)===0,'10: second sweep no-op (balance already fixed)');

console.log((fails?'FAILED ':'ALL PASS ')+(tests-fails)+'/'+tests);
process.exit(fails?1:0);
})();
