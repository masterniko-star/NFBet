// betcoltest.js — таблица «טבלה»: имя в 2 строки + введено(📥)/выведено(📤) + баланс(💰) + «$» активной ставки
const {loadApp}=require('./applib.js');
let fails=0,tests=0;const ok=(c,m)=>{tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);};
const fut=new Date(Date.now()+10*36e5).toISOString().slice(0,16);
const past=new Date(Date.now()-50*36e5).toISOString().slice(0,16);
const seed={meta:{bank:100,cur:'\u20aa'},
  players:{p1:{name:'Alice',feePaid:true,t:1},p2:{name:'Bob',feePaid:false,t:2},p3:{name:'Cara',feePaid:true,dep:150,wd:30,t:3}},
  matches:{
    mOpen:{round:'R32',order:0,teamA:'E',teamB:'F',dt:fut,settled:false,winner:null},   // p1 open bet -> $
    m2:{round:'R32',order:1,teamA:'C',teamB:'D',dt:past,settled:true,winner:'A'}          // p2 settled-only -> no $
  },
  bets:{mOpen:{p1:{team:'A',stake:5}},m2:{p2:{team:'A',stake:5}}}};
let A=loadApp(seed,{hash:"ctrl7"});
A.sandbox.buildState(A.state.tree);
A.sandbox.renderAllView();
const h=A.mainHTML();

ok(/קופה כללית/.test(h),'standings rendered (summary header)');
ok(/class="nmtxt"/.test(h),'name uses 2-line nmtxt span');
ok(/class="io dep"><span class="ic">📥<\/span>/.test(h),'deposited column with 📥 icon');
ok(/class="io wd"><span class="ic">📤<\/span>/.test(h),'withdrawn column with 📤 icon');
ok(/class="bt"/.test(h)&&!/💰/.test(h),'total cell present, 💰 icon removed');
ok(!/<span class="bet">/.test(h)&&!/class="dm"/.test(h),'old bet $ + dm columns removed');
ok(/📥<\/span>100/.test(h),'paid player deposited=100 (bank default)');
ok(/📥<\/span>0/.test(h),'demo player deposited=0');
ok(/📥<\/span>150/.test(h)&&/📤<\/span>30/.test(h),'explicit dep=150 / wd=30 rendered');
ok(/class="nmtxt"[\s\S]*?class="io dep"[\s\S]*?class="io wd"[\s\S]*?class="bt"[\s\S]*?class="bx"/.test(h),'order: name -> deposited -> withdrawn -> total -> expr');
ok(/<div class="lbwrap">[\s\S]*?class="lb/.test(h),'rows wrapped in .lbwrap subgrid (columns align across rows)');
// баланс и ставки в одной ячейке: «баланс+ставки=итого₪»; значок $ убран; колонки .hbamt больше нет
ok(!/class="hb"/.test(h)&&!/>\$</.test(h),'значок $ убран полностью');
ok(!/class="hbamt"/.test(h),'отдельной колонки .hbamt больше нет');
ok(/class="bt"[^>]*>100<span class="cur">₪<\/span><\/span><span class="bx"[^>]*>95\+5=<\/span>/.test(h),'p1 с открытой ставкой: итог «100₪» в .bt, затем выражение «95+5=» в .bx');
ok(/class="bt"[^>]*>120<span class="cur">/.test(h),'p3 без ставок: только итог «120₪» в .bt (без +/=)');
ok(/class="bt"[^>]*>[^<]*<span class="cur">[^<]*<\/span><\/span>/.test(h),'итог: число затем ₪ (без $)');
ok((h.match(/<span class="cur">/g)||[]).length===3,'₪ currency shown next to every balance (all 3 rows)');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));process.exit(fails?1:0);
