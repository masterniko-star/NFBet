// histtest.js — правки вкладки "היסטוריה שלי":
//  числа округляются до десятых; названия игр всегда в две строки; переключатель выравнивания (право/лево, с сохранением).
const {loadApp,flush}=require('./applib.js');
let fails=0,tests=0;
function ok(c,m){tests++;if(!c){fails++;console.log('FAIL:',m);}else console.log('ok  ',m);}
(async()=>{
const seed={meta:{fee:100,bank:100,minBet:1,maxBet:10,cur:'₪'},
  players:{r1:{name:'Ann',feePaid:true,t:1},r2:{name:'Bob',feePaid:true,t:2},r3:{name:'Cy',feePaid:true,t:3}},
  matches:{m1:{round:'R32',order:0,t:1,teamA:'USA',teamB:'Iran',settled:true,winner:'A'}},
  // пул=8, sw(A)=3. Выплаты в ЦЕЛЫХ שקлим (метод наибольшего остатка):
  //   r1: floor(8*1/3)=2 + остаток 1 = 3 -> net +2 ; r2: floor(8*2/3)=5 -> net +3. Дробных нетто больше нет.
  bets:{m1:{r1:{team:'A',stake:1},r2:{team:'A',stake:2},r3:{team:'B',stake:5}}}};

let H=loadApp(seed,{});H.sandbox.buildState(H.state.tree);
H.sandbox.MODE='player';H.sandbox.ME='r1';H.sandbox.TAB='hist';
let e=null;try{H.sandbox.renderActive();}catch(x){e=x;}
ok(!e,'renderActive(hist) без ошибки');
let html=H.mainHTML();

console.log('== целые שקלים, без дробных хвостов ==');
ok(html.indexOf('>2</span>')>=0,'нетто r1 показано как целое +2');
ok(html.indexOf('1.67')<0&&html.indexOf('1.6667')<0&&html.indexOf('1.7')<0,'дробного нетто нет (выплаты целочисленны)');

console.log('== две строки ==');
ok((html.match(/display:block;white-space:nowrap/g)||[]).length>=2,'название игры в две строки (два блока) даже для коротких имён');
ok(html.indexOf(' - Iran')<0&&html.indexOf('USA - ')<0,'однострочный разделитель " - " не используется');
ok(html.indexOf('width:calc(')>=0,'колонка названий — фиксированной ширины (по самой длинной строке)');

console.log('== выравнивание зафиксировано на авто, кнопка скрыта ==');
ok(html.indexOf('text-align:left')>=0,'названия выровнены влево (авто)');
ok(html.indexOf('histAlignToggle')<0,'кнопка переключения убрана из истории');
ok(html.indexOf('בהימור')>=0,'в шапке есть поле בהימור (сумма всех ставок)');
H.sandbox.histAlignToggle();
ok(H.mainHTML().indexOf('text-align:right')<0,'рендер остаётся влево независимо от HALIGN (кнопки нет)');

console.log('\n'+(fails?('FAILED '+fails+'/'+tests):('ALL PASS '+tests+'/'+tests)));
process.exit(fails?1:0);
})();
