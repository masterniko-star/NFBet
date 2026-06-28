# NF PlayOff

Дружеский паримутуэль-тотализатор на плей-офф ЧМ-2026.
Единый файл `index.html` (RTL-иврит) + Firebase REST + Netlify cron `check-results.mjs`.

## Быстрый старт

```bash
# тесты (нужен Node 18+, без npm-зависимостей):
node tests/run.mjs            # → PASS=61 FAIL=0

# деплой (нужен netlify-cli + netlify login + netlify link):
netlify deploy --dir=. --alias=playoff-dev    # dev (крон НЕ работает)
netlify deploy --dir=. --prod                 # prod (крон работает, шлёт клиент+сервер)
```

Админка: к URL добавить `#ctrl7`.
Prod: https://nf-playoff.netlify.app/ · Dev: https://playoff-dev--nf-playoff.netlify.app/

## Полный контекст

См. **`HANDOFF.md`** — стек, правила, рабочий цикл, текущее состояние (версия 2026-06-24z),
карта кода и открытые задачи. Этот файл — то, что нужно дать новому ассистенту.

## Структура

```
index.html                          клиент (исходник = деплой)
netlify.toml                        конфиг Netlify
netlify/functions/check-results.mjs сервер (cron)
tests/  run.mjs run.sh applib.js + 63 теста
docs/   תקנון.docx  מדריך_למשתתף.docx
```

⚠️ Не редактировать JS через regex-замену (ломает шаблонные строки). После правок — `node --check`.
`calcMatch` в клиенте и сервере держать синхронными (проверяет `tests/paritytest.mjs`).
