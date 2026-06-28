const {loadApp,flush}=require('./applib.js');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;}else{fail++;console.log('  FAIL:',m);}}
function seed(nA,nX){var p={};for(var i=0;i<nA;i++)p['a'+i]={name:'A'+i,feePaid:true,dep:100,t:i+1};for(var i=0;i<(nX||0);i++)p['x'+i]={name:'X'+i,feePaid:true,dep:100,exited:true,exitBal:100,t:i+1};return p;}
function activeCount(tree){return Object.keys(tree.players||{}).filter(function(id){return !(tree.players[id]&&tree.players[id].exited);}).length;}
function totalCount(tree){return Object.keys(tree.players||{}).length;}
function named(tree,nm){return Object.keys(tree.players||{}).some(function(id){return tree.players[id].name===nm;});}

(async()=>{
// 1. registerMe blocks at 30 active
let A=loadApp({meta:{bank:100},players:seed(30)});
A.sandbox.buildState(A.state.tree);
A.q('#regN').value='NEW';A.q('#regPw').value='abc';
A.sandbox.registerMe();await flush();await flush();
ok(activeCount(A.state.tree)===30,'1: registerMe blocked at 30 (still 30 active)');
ok(!named(A.state.tree,'NEW'),'1: new player NOT created at cap');

// 2. registerMe allows at 29 active
A=loadApp({meta:{bank:100},players:seed(29)});
A.sandbox.buildState(A.state.tree);
A.q('#regN').value='NEW';A.q('#regPw').value='abc';
A.sandbox.registerMe();await flush();await flush();
ok(activeCount(A.state.tree)===30,'2: registerMe allowed at 29 -> 30 active');
ok(named(A.state.tree,'NEW'),'2: new player created');

// 3. exited do NOT count toward cap
A=loadApp({meta:{bank:100},players:seed(29,6)});   // 29 active + 6 exited = 35
A.sandbox.buildState(A.state.tree);
A.q('#regN').value='NEW';A.q('#regPw').value='abc';
A.sandbox.registerMe();await flush();await flush();
ok(activeCount(A.state.tree)===30,'3: exited excluded — registration allowed (30 active)');
ok(totalCount(A.state.tree)===36,'3: total now 36 (35 + new)');

// 4. aCommitPlayer blocks at 30
A=loadApp({meta:{bank:100},players:seed(30)},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
A.q('#np').value='NEW';
A.sandbox.aCommitPlayer();await flush();
ok(activeCount(A.state.tree)===30&&!named(A.state.tree,'NEW'),'4: aCommitPlayer blocked at 30');

// 5. aCommitPlayer allows at 29
A=loadApp({meta:{bank:100},players:seed(29)},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
A.q('#np').value='NEW';
A.sandbox.aCommitPlayer();await flush();
ok(named(A.state.tree,'NEW')&&activeCount(A.state.tree)===30,'5: aCommitPlayer added at 29');

// 6. aCommitBulk blocks when names exceed remaining room
A=loadApp({meta:{bank:100},players:seed(28)},{hash:'ctrl7'});  // room = 2
A.sandbox.buildState(A.state.tree);
A.q('#bk').value='N1\nN2\nN3\nN4\nN5';   // 5 new > room 2
A.sandbox.aCommitBulk();await flush();
ok(activeCount(A.state.tree)===28,'6: aCommitBulk blocked (5 names, room 2)');

// 7. aCommitBulk adds when within room
A=loadApp({meta:{bank:100},players:seed(28)},{hash:'ctrl7'});  // room = 2
A.sandbox.buildState(A.state.tree);
A.q('#bk').value='N1\nN2';   // exactly room
A.sandbox.aCommitBulk();await flush();
ok(activeCount(A.state.tree)===30,'7: aCommitBulk added within room (28+2=30)');

// 8. count display in admin players view
A=loadApp({meta:{bank:100},players:seed(28)},{hash:'ctrl7'});
A.sandbox.buildState(A.state.tree);
A.sandbox.renderAdminPlayers();
ok(A.q('#main').innerHTML.indexOf('28/30')>=0,'8: players view shows 28/30 count');

console.log((fail?'❌':'✅')+' maxplayerstest: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
