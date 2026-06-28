// run.mjs — кросс-платформенный запуск всех тестов NF PlayOff (Node, без bash).
// Использование:  node tests/run.mjs            (из корня проекта D:\PlayOff)
//            или:  cd tests && node run.mjs
// Доп. тесты:      node tests/run.mjs extraClient.js extraSrv.mjs
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const CLIENT = "appharness sorttest rtltest journey revtest edgetests drawtest drawbig autofill loginstest leaguetest fxfilter clientsched seasontests deltests logtest logfix seentest admintest archivetest cashlogtest statstest automarktest noticetest integritytest maxplayerstest intgautotest critpopuptest xsstest logunifytest legacyclient betcoltest dash365test betmathtest features2test drawpubtest histtest moneyfuzz datalink demoscan feecur resettest resetbaltest logcopytest badgetest owneriotest cachetest demotetest tgtest demobet betrowtest demohltest authtest betlogictest tztest pweyetest boardalign panelhead statsmini logpanels roundpayout".split(/\s+/);
const SRV = "schedtest paritytest legacytest srvlog drawpubsrv srvfuzz srvpurge srvidle srvdemote srvoverbet demobet resetnewgames".split(/\s+/);

// доп. тесты из CLI (extra client .js, extra server .mjs)
const extraClient = process.argv.slice(2).filter(a => a.endsWith('.js')).map(a => a.replace(/\.js$/, ''));
const extraSrv    = process.argv.slice(2).filter(a => a.endsWith('.mjs')).map(a => a.replace(/\.mjs$/, ''));

const FAIL_RE = /FAIL:|FAILED [1-9]|[1-9][0-9]* failed|Uncaught|TypeError|ReferenceError/;
const PASS_RE = /ALL PASS|passed,|ALL PARITY|✓|done/;

let pass = 0, fail = 0;
const failed = [];

function runOne(file, name) {
  let out = '', code = 0;
  try {
    out = execFileSync('node', [file], { cwd: HERE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
    code = e.status || 1;
  }
  const bad = code !== 0 || FAIL_RE.test(out);
  if (bad) {
    fail++; failed.push(name);
    const line = (out.split('\n').find(l => /FAIL|Error|failed/.test(l)) || '').trim();
    console.log('FAIL  ' + name.padEnd(16) + ' :: ' + line.slice(0, 120));
  } else {
    pass++;
    const line = ([...out.split('\n')].reverse().find(l => PASS_RE.test(l)) || '').trim();
    console.log('pass  ' + name.padEnd(16) + ' :: ' + line.slice(0, 120));
  }
}

for (const t of [...CLIENT, ...extraClient]) {
  const f = path.join(HERE, t + '.js');
  if (existsSync(f)) runOne(f, t); else console.log('  ?? нет ' + t + '.js');
}
console.log('--- server ---');
for (const t of [...SRV, ...extraSrv]) {
  const f = path.join(HERE, t + '.mjs');
  if (existsSync(f)) runOne(f, t); else console.log('  ?? нет ' + t + '.mjs');
}

console.log('=============================');
console.log('PASS=' + pass + '  FAIL=' + fail);
console.log(failed.length ? 'FAILED: ' + failed.join(' ') : '✓ ВСЁ ЗЕЛЁНОЕ');
process.exit(fail ? 1 : 0);
