#!/bin/bash
# Полный набор тестов NF PlayOff (bash/WSL). Кросс-платформенная альтернатива: node run.mjs
# Запуск:  bash tests/run.sh   (или: cd tests && bash run.sh)
cd "$(dirname "$0")" || exit 1
CLIENT="appharness sorttest rtltest journey revtest edgetests drawtest drawbig autofill loginstest leaguetest fxfilter clientsched seasontests deltests logtest logfix seentest admintest archivetest cashlogtest statstest automarktest noticetest integritytest maxplayerstest intgautotest critpopuptest xsstest logunifytest legacyclient betcoltest dash365test betmathtest features2test drawpubtest histtest moneyfuzz datalink demoscan feecur resettest resetbaltest logcopytest badgetest owneriotest cachetest demotetest tgtest demobet betrowtest demohltest"
SRV="schedtest paritytest legacytest srvlog drawpubsrv srvfuzz srvpurge srvidle srvdemote srvoverbet demobet"
EXTRA_CLIENT="$1"
EXTRA_SRV="$2"
pass=0; fail=0; failed=""
runone(){
  local out code
  out=$(node "$1" 2>&1); code=$?
  if [ $code -ne 0 ] || echo "$out" | grep -qE 'FAIL:|FAILED [1-9]|[1-9][0-9]* failed|Uncaught|TypeError|ReferenceError'; then
    fail=$((fail+1)); failed="$failed $2"
    printf 'FAIL  %-16s :: %s\n' "$2" "$(echo "$out"|grep -E 'FAIL:|FAILED|failed|Error'|head -1)"
  else
    pass=$((pass+1)); printf 'pass  %-16s :: %s\n' "$2" "$(echo "$out"|grep -E 'ALL PASS|passed,|ALL PARITY|✓'|tail -1)"
  fi
}
for t in $CLIENT $EXTRA_CLIENT; do [ -f "$t.js" ] && runone "$t.js" "$t" || echo "  ?? нет $t.js"; done
echo "--- server ---"
for t in $SRV $EXTRA_SRV; do [ -f "$t.mjs" ] && runone "$t.mjs" "$t" || echo "  ?? нет $t.mjs"; done
echo "============================="; echo "PASS=$pass  FAIL=$fail"; [ -n "$failed" ] && echo "FAILED:$failed" || echo "✓ ВСЁ ЗЕЛЁНОЕ"
