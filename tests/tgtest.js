const {loadApp,flush}=require('./applib.js');
let ok=(c,m)=>console.log((c?'pass':'FAIL')+': '+m);
(async()=>{
  // player WITH saved TG prefs -> pre-filled
  let A=loadApp({meta:{bank:100,cur:'\u20aa'},players:{u:{name:'דנה',pw:'1',feePaid:true,dep:100,tgSub:true,tgPhone:'050-1234567',t:1}},matches:{},bets:{}});
  A.sandbox.buildState(A.state.tree);A.sandbox.ME='u';A.sandbox.MODE='player';A.sandbox.TAB='help';
  A.sandbox.renderActive();
  ok(A.q('#tgSub').checked===true,'TG checkbox pre-filled from player.tgSub');
  ok(A.q('#tgPhone').value==='050-1234567','TG phone pre-filled from player.tgPhone');
  A.q('#tgSub').checked=false; A.q('#tgPhone').value='052-9999999';
  A.sandbox.tgSave(); await flush();
  let p=await A.sandbox.fbGet('/players/u');
  ok(p.tgSub===false,'tgSave wrote tgSub=false');
  ok(p.tgPhone==='052-9999999','tgSave wrote new tgPhone');
  // player WITHOUT prefs -> defaults (unchecked, empty)
  let B=loadApp({meta:{bank:100,cur:'\u20aa'},players:{v:{name:'גיל',pw:'1',feePaid:true,dep:100,t:1}},matches:{},bets:{}});
  B.sandbox.buildState(B.state.tree);B.sandbox.ME='v';B.sandbox.MODE='player';B.sandbox.TAB='help';B.sandbox.renderActive();
  ok(B.q('#tgSub').checked===false,'no-prefs player: checkbox unchecked');
  ok(B.q('#tgPhone').value==='','no-prefs player: phone empty');
  ok(/id="tgSub"/.test(B.q('#main').innerHTML) && /בפיתוח/.test(B.q('#main').innerHTML),'TG strip + WIP marker render for player');
  console.log('TG done');
})();
