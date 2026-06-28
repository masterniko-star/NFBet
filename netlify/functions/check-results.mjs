// NF PlayOff — серверная автопроверка результатов (Netlify Scheduled Function).
// Запускается по расписанию (каждые 4 часа, UTC) ДАЖЕ когда ни у кого не открыто приложение.
// Делает ровно то же, что кнопка «מלא תוצאות» / клиентская автопроверка:
//   читает дерево Firebase -> находит несыгранные ESPN-матчи -> опрашивает ESPN ->
//   проставляет исход (A/B/тиקו X) И досыпает авто-ставки (₪1 на фаворита неставившим),
//   точь-в-точь как settleAuto в приложении.
// На сервере НЕТ CORS, поэтому ESPN отвечает напрямую (надёжнее браузера).

const DB = (process.env.FIREBASE_DB_URL ||
  "https://nf-playoff-default-rtdb.europe-west1.firebasedatabase.app").replace(/\/+$/, "");
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
const AC_DEF_TIMES = ["08:00", "20:00"]; // расписание по умолчанию, если autocfg.times не задан
const CASH_RETAIN_MS = 365 * 24 * 60 * 60 * 1000; // журнал פיקדון: хранить записи 1 год, старше — авто-удаление
// «конец игры» — независимый от autocfg-тумблеров механизм:
const END_RES_MS = 105 * 60 * 1000; // проверять результат каждую минуту начиная со старт+105 мин (до зачёта)
const END_NG_MS  = 110 * 60 * 1000; // подгружать новые игры через 5 мин после «конца» (старт+110), один раз на игру

/* ---------- Firebase REST ---------- */
const jurl = (p) => DB + (p.startsWith("/") ? p : "/" + p) + ".json";
async function fbGet(p) { const r = await fetch(jurl(p)); if (!r.ok) throw new Error("GET " + p + " " + r.status); return r.json(); }
async function fbPatch(p, v) { const r = await fetch(jurl(p), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); if (!r.ok) throw new Error("PATCH " + p + " " + r.status); return r.json(); }
async function fbPut(p, v) { const r = await fetch(jurl(p), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); if (!r.ok) throw new Error("PUT " + p + " " + r.status); return r.json(); }
async function fbDel(p) { const r = await fetch(jurl(p), { method: "DELETE" }); if (!r.ok) throw new Error("DEL " + p + " " + r.status); }

/* ---------- parimutuel (идентично приложению) ---------- */
export function calcMatch(m, betsForM) {
  const bets = betsForM || {};
  let sA = 0, sB = 0, sX = 0, pool = 0;
  for (const k in bets) { const s = Number(bets[k].stake) || 0; pool += s; if (bets[k].team === "A") sA += s; else if (bets[k].team === "B") sB += s; else if (bets[k].team === "X") sX += s; }
  const payouts = {}; let refunded = false;
  const ref = () => { refunded = true; for (const k in bets) payouts[k] = Number(bets[k].stake) || 0; };
  const w = m.winner;
  if (w === "VOID") { ref(); return { sumA: sA, sumB: sB, sumX: sX, pool, payouts, refunded }; }
  if (w === "A" || w === "B" || w === "X") {
    const sw = w === "A" ? sA : (w === "B" ? sB : sX);
    if (!sw) { ref(); } else {
      // выплаты в ЦЕЛЫХ שקלים: метод наибольшего остатка (Гамильтон). Σвыплат==pool точно, без дробных хвостов.
      // ИДЕНТИЧНО клиенту (index.html calcMatch): целочисленно, ничьи остатка разбиваем по id ставки.
      const wk = [];
      for (const k in bets) { payouts[k] = 0; if (bets[k].team === w) { const q = pool * (Number(bets[k].stake) || 0); wk.push({ k, base: Math.floor(q / sw), rem: q % sw }); } }
      let asg = 0; for (const e of wk) { payouts[e.k] = e.base; asg += e.base; }
      const left = pool - asg;
      wk.sort((x, y) => (y.rem - x.rem) || (x.k < y.k ? -1 : (x.k > y.k ? 1 : 0)));
      for (let i = 0; i < left; i++) payouts[wk[i].k] += 1;
    }
  }
  return { sumA: sA, sumB: sB, sumX: sX, pool, payouts, refunded };
}
function availFor(p, mid, matches, bets, bank) {
  const pid = p.id;
  const start = srvDep(p, bank) - (Number(p.wd) || 0);
  let staked = 0, won = 0;
  for (const m of matches) { if (m.id === mid) continue; const b = (bets[m.id] || {})[pid]; if (!b) continue; staked += Number(b.stake) || 0; if (m.settled) won += (calcMatch(m, bets[m.id]).payouts[pid] || 0); }
  return start - staked + won;
}
function ymdUTC(d) { const z = (n) => (n < 10 ? "0" : "") + n; return "" + d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()); }
// ESPN ISO -> "YYYY-MM-DDTHH:MM" в израильском времени (приложение хранит dt в локальном времени Израиля)
function fmtIsrael(iso) {
  try {
    const d = new Date(iso); if (isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
    const g = (t) => (parts.find((x) => x.type === t) || {}).value || "00";
    return g("year") + "-" + g("month") + "-" + g("day") + "T" + g("hour") + ":" + g("minute");
  } catch (e) { return ""; }
}

/* ---------- серверный лог ошибок -> /diag/server (виден в админском логе) ---------- */
const SRV_VER="srv-2026-06-29b";
async function slog(lvl,cat,msg,x){
  const entry={ts:Date.now(),lvl,cat,msg:String(msg||"").slice(0,400),ver:SRV_VER};
  if(x!==undefined){try{entry.x=JSON.parse(JSON.stringify(x));}catch(_){}}
  try{
    const cur=(await fbGet("/diag/server"))||{};
    const items=Array.isArray(cur.items)?cur.items.slice():[];
    items.push(entry);
    await fbPut("/diag/server",{dev:"server",upd:Date.now(),pulse:Date.now(),items:items.slice(Math.max(0,items.length-50))});
  }catch(e){}
  if(lvl==="CRIT"){try{await critNotice(msg);}catch(_){}}
}
async function srvPulse(){try{await fbPatch("/diag/server",{pulse:Date.now()});}catch(e){}}

/* ---------- ретеншн журнала פיקדון: раз в сутки удаляем записи старше года ---------- */
async function purgeOldCashlog(tree, now){
  const cl = tree.cashlog || {};
  if (!Object.keys(cl).length) return 0;                      // нет журнала — тихо выходим (без маркера)
  const meta = tree.meta || {};
  if (now - (Number(meta.lastCashPurge) || 0) < 24*60*60*1000) return 0; // не чаще раза в сутки
  const cutoff = now - CASH_RETAIN_MS;
  let removed = 0;
  for (const pid in cl){
    const entries = cl[pid] || {};
    const del = {};
    for (const key in entries){
      const e = entries[key];
      if (e && typeof e.ts === "number" && e.ts < cutoff){ del[key] = null; removed++; } // null = удалить ключ в Firebase
    }
    if (Object.keys(del).length) await fbPatch("/cashlog/" + pid, del);
  }
  await fbPatch("/meta", { lastCashPurge: now });
  if (removed) { try { await slog("INFO","purge","cashlog: removed "+removed+" entries older than 365d"); } catch(_){} }
  return removed;
}

/* ---------- слой B: детект 7-дневного простоя (раз в сутки) + крит-уведомления ---------- */
const IDLE_REMOVE_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней без ручной ставки -> удаление
const IDLE_WARN_MS   = 6 * 24 * 60 * 60 * 1000; // за день до удаления -> предупреждение

// депозит как в клиенте (depOf): dep -> bal0+wd -> (feePaid===false?0:bank)
function srvDep(p, bank){
  if (!p) return 0;
  if (p.dep != null) return Number(p.dep);
  if (p.bal0 != null) return Number(p.bal0) + (Number(p.wd) || 0);
  return (p.feePaid === false) ? 0 : (Number(bank) || 0);
}
// баланс/pending как в клиенте (statsFor): start - staked + won; pending = открытые ставки
export function srvBalance(p, matches, bets, bank){
  const start = srvDep(p, bank) - (Number(p.wd) || 0);
  let staked = 0, won = 0, pending = 0;
  for (const m of matches){
    const b = (bets[m.id] || {})[p.id];
    if (!b) continue;
    const st = Number(b.stake) || 0;
    staked += st;
    if (m.settled) won += (calcMatch(m, bets[m.id]).payouts[p.id] || 0);
    else pending += st;
  }
  return { balance: start - staked + won, pending, staked, won };
}
// открытая РУЧНАЯ ставка защищает от удаления; авто-ставки (₪1, auto) — нет
export function hasOpenManual(pid, matches, bets){
  for (const m of matches){
    if (m.settled) continue;
    const b = (bets[m.id] || {})[pid];
    if (b && !b.auto) return true;
  }
  return false;
}

// дедуп-оповещение о критической ошибке (одно на отдельную ошибку, не чаще)
export async function critNotice(msg){
  try{
    const key = "crit_" + String(msg || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 24).toLowerCase();
    if (!key || key === "crit_") return;
    const ex = await fbGet("/notices/" + key);
    if (ex) return; // уже оповещали об этой ошибке
    await fbPut("/notices/" + key, { type: "crit", reason: String(msg || "").slice(0, 200), ts: Date.now(), seen: false });
    try { await fbPut("/rev", Date.now()); } catch(_) {}
  }catch(_){}
}

export async function idleSweep(tree, players, matches, bets, bank, now){
  const meta = tree.meta || {};
  if (now - (Number(meta.lastIdleCheck) || 0) < 24*60*60*1000) return 0; // не чаще раза в сутки
  let acted = 0;
  for (const p of players){
    if (p.exited) continue;        // уже вышел
    if (!p.feePaid) continue;      // не оплатил — правило простоя не применяем
    const warnPath = "/notices/idle_warn_" + p.id;
    if (hasOpenManual(p.id, matches, bets)){ // деньги в открытой ручной ставке — не трогаем (и снимаем устаревшее предупреждение)
      if (p.idleWarned){ await fbPatch("/players/" + p.id, { idleWarned: false }); try{ await fbDel(warnPath); }catch(_){} acted++; }
      continue;
    }
    const ref = Number(p.lastBet) || Number(p.t) || 0; // последняя ручная ставка, иначе регистрация
    if (!ref) continue;
    const age = now - ref;
    if (age >= IDLE_REMOVE_MS){
      // УДАЛЕНИЕ: отменить/вернуть открытые ставки, архив, баланс к возврату, уведомление
      for (const m of matches){ if (!m.settled && (bets[m.id] || {})[p.id]){ try{ await fbDel("/bets/" + m.id + "/" + p.id); }catch(_){} } }
      const bb = srvBalance(p, matches, bets, bank);
      const exitBal = bb.balance + bb.pending; // как в клиенте closeMyAccount/aDelPlayer (открытые ставки возвращаются)
      await fbPatch("/players/" + p.id, { exited: true, exitedAt: now, exitBal, exitReason: "idle7", idleWarned: false });
      p.exited = true; // консистентность для остального прохода runCheck
      await fbPut("/notices/idle_removed_" + p.id, { type: "idle_removed", name: p.name || "", amount: exitBal, ts: now, seen: false });
      try{ await fbDel(warnPath); }catch(_){} // снять устаревшее предупреждение
      try{ await slog("INFO", "idle", "removed " + (p.name || p.id) + " (7d idle), return " + (Math.round(exitBal*100)/100) + "\u20aa"); }catch(_){}
      acted++;
    } else if (age >= IDLE_WARN_MS){
      // ПРЕДУПРЕЖДЕНИЕ за день (один раз, дедуп по флагу игрока)
      if (!p.idleWarned){
        const bb = srvBalance(p, matches, bets, bank);
        await fbPatch("/players/" + p.id, { idleWarned: true });
        await fbPut(warnPath, { type: "idle_warn", name: p.name || "", amount: bb.balance + bb.pending, ts: now, seen: false });
        acted++;
      }
    } else {
      // снова активен (age < 6д) — сбросить устаревшее предупреждение
      if (p.idleWarned){ await fbPatch("/players/" + p.id, { idleWarned: false }); try{ await fbDel(warnPath); }catch(_){} acted++; }
    }
  }
  await fbPatch("/meta", { lastIdleCheck: now });
  if (acted){ try{ await fbPut("/rev", now); }catch(_){} }
  return acted;
}

// мало денег: free + открытые ставки < 1 ₪ -> авто-перевод в демо (снять שולם), обнулить, уведомить игрока и владельца
export async function lowBalanceSweep(players, matches, bets, bank, now){
  let acted = 0;
  for (const p of players){
    if (p.exited || !p.feePaid) continue;             // выбывшие и уже-демо пропускаем
    const bb = srvBalance(p, matches, bets, bank);
    const total = bb.balance + bb.pending;            // свободное + открытые ставки (ва-банк защищён)
    if (total < 1){
      const depA = (bb.staked - bb.pending) - bb.won; // баланс -> ровно 0 после отмены открытых ставок
      for (const m of matches){ if (!m.settled && (bets[m.id] || {})[p.id]){ try{ await fbDel("/bets/" + m.id + "/" + p.id); }catch(_){} } }
      await fbPatch("/players/" + p.id, { feePaid: false, dep: depA, wd: 0, demoteAt: now, demoteNotify: true });
      p.feePaid = false;                              // консистентность для остального прохода runCheck
      await fbPut("/notices/demote_" + p.id, { type: "demote", name: p.name || "", amount: Math.max(0, total), ts: now, seen: false });
      try{ await slog("INFO", "demote", (p.name || p.id) + " auto-demote (low balance " + (Math.round(total*100)/100) + "\u20aa)"); }catch(_){}
      acted++;
    }
  }
  if (acted){ try{ await fbPut("/rev", now); }catch(_){} }
  return acted;
}

// перебор: открытые ставки превышают баланс (гонка клиента) -> подрезаем последние открытые ставки, пока баланс не вернётся к 0.
// порог 0.5 ₪: ниже — это артефакты округления паримутуэля (не трогаем); реальный перебор всегда >= 1 ₪.
export async function overBetSweep(players, matches, bets, bank, now){
  let acted = 0;
  for (const p of players){
    if (p.exited || !p.feePaid) continue;
    const bb = srvBalance(p, matches, bets, bank);
    let over = -bb.balance;                       // > 0 => поставил больше, чем есть
    if (over <= 0.5) continue;                     // округление, не перебор
    const open = [];
    for (const m of matches){
      if (m.settled) continue;
      const b = (bets[m.id] || {})[p.id];
      if (b) open.push({ mid: m.id, stake: Number(b.stake) || 0, t: Number(b.t) || 0 });
    }
    open.sort((a, c) => (c.t - a.t) || 0);          // новые первыми — режем сначала свежие
    const cut = [];
    for (const ob of open){
      if (over <= 0.001) break;
      let ns = (ob.stake <= over + 0.001) ? 0 : Math.floor(ob.stake - over);
      if (ns < 1){
        try{ await fbDel("/bets/" + ob.mid + "/" + p.id); }catch(_){}
        if (bets[ob.mid]) delete bets[ob.mid][p.id];
        over -= ob.stake;
        cut.push(ob.mid + ":" + ob.stake + "->0");
      } else {
        try{ await fbPatch("/bets/" + ob.mid + "/" + p.id, { stake: ns }); }catch(_){}
        if (bets[ob.mid] && bets[ob.mid][p.id]) bets[ob.mid][p.id].stake = ns;
        cut.push(ob.mid + ":" + ob.stake + "->" + ns);
        over = 0;
      }
    }
    if (cut.length){
      try{ await slog("WARN", "overbet", (p.name || p.id) + " over-bet trimmed {" + cut.join(", ") + "}"); }catch(_){}
      acted++;
    }
  }
  if (acted){ try{ await fbPut("/rev", now); }catch(_){} }
  return acted;
}

/* ---------- автодобавка: всегда держим 3 матча, на которые можно поставить ---------- */
function detectDrawOK(slug,stage){var t=(String(slug||"")+" "+String(stage||"")).toLowerCase();
  if(/round of|knockout|quarter|semi|\bfinal\b|play-?off|last 16|last 32|round-of|\br16\b|\br32\b|1\/8|1\/4|1\/2|playoff/.test(t))return false;
  if(/group|matchday|regular season|round \d|jornada|spieltag|giornata|\bleague\b|\bliga\b|premier|serie|bundesliga|ligue|eredivisie|\.1\b|\.2\b|\.3\b/.test(t))return true;
  return false;}
export async function topUp(matches, want) {
  want = want || 3;
  const unsettled = matches.filter((m) => !m.settled && !m.hidden).length; // игры без результата (начавшиеся тоже считаются)
  const need = want - unsettled;
  const dbg = { unsettled, need: Math.max(0, need), perSrc: [], cands: 0, added: [] };
  if (need <= 0) return { added: 0, dbg };
  const have = new Set(matches.filter((m) => m.fx).map((m) => m.fx));
  const espnSlugs = new Set(); const comps = new Set();
  matches.forEach((m) => { const s = srcOf(m); if (s.type === "365") comps.add(s.comp); else if (s.slug) espnSlugs.add(s.slug); });
  if (!espnSlugs.size && !comps.size) espnSlugs.add("fifa.world");
  let cands = [];
  const d0 = new Date(), d1 = new Date(Date.now() + 120 * 864e5);
  for (const sl of espnSlugs) {
    let ev = -1;
    try {
      const url = ESPN + encodeURIComponent(sl) + "/scoreboard?limit=300&dates=" + ymdUTC(d0) + "-" + ymdUTC(d1);
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json(); const events = (j && j.events) || []; ev = events.length;
        for (const e of events) {
          const st = (e.status && e.status.type) || {}; if (st.state !== "pre") continue;
          const fx = "espn" + e.id; if (have.has(fx)) continue;
          const cs = ((e.competitions && e.competitions[0]) || {}).competitors || [];
          let h = null, a = null; cs.forEach((c) => { if (c.homeAway === "home") h = c; else if (c.homeAway === "away") a = c; });
          if (!h) h = cs[0]; if (!a) a = cs[1];
          const ta = (h && h.team && h.team.displayName) || "", tb = (a && a.team && a.team.displayName) || "";
          if (!ta || !tb) continue;
          const stage = ((e.competitions && e.competitions[0] && e.competitions[0].notes && e.competitions[0].notes[0] && (e.competitions[0].notes[0].headline || e.competitions[0].notes[0].text)) || (e.season && e.season.slug) || "");
          cands.push({ fx, fxLeague: sl, teamA: ta, teamB: tb, dateISO: e.date, when: new Date(e.date).getTime(), drawOK: detectDrawOK(sl, stage) });
        }
      } else { try { await slog("WARN", "espn", "ESPN " + sl + " HTTP " + r.status); } catch (_) {} }
    } catch (e) { try { await slog("WARN", "espn", "ESPN " + sl + " fail: " + ((e && e.message) || e)); } catch (_) {} }
    dbg.perSrc.push(sl + "=" + (ev < 0 ? "ERR" : ev));
  }
  for (const cp of comps) {
    const games = await fetch365(cp);
    for (const g of games) {
      if (!g.upcoming) continue;
      const fx = "365" + g.id; if (have.has(fx)) continue;
      cands.push({ fx, fxLeague: "365:" + cp, teamA: g.teamA, teamB: g.teamB, dateISO: g.dateISO, when: g.when, drawOK: true });
    }
    dbg.perSrc.push("365:" + cp + "=" + games.length);
  }
  const seen = new Set(); cands = cands.filter((c) => seen.has(c.fx) ? false : (seen.add(c.fx), true));
  cands.sort((x, y) => x.when - y.when);
  dbg.cands = cands.length;
  const pick = cands.slice(0, need);
  if (!pick.length) return { added: 0, dbg };
  let o = matches.reduce((mx, m) => Math.max(mx, Number(m.order) || 0), 0) + 1, added = 0;
  for (const c of pick) {
    const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const ord = o++;
    const rec = { round: "R32", teamA: c.teamA, teamB: c.teamB, slot: "", dt: fmtIsrael(c.dateISO), order: ord, fx: c.fx, fxLeague: c.fxLeague, settled: false, winner: null, drawOK: !!c.drawOK, t: Date.now() };
    await fbPut("/matches/" + id, rec);
    matches.push({ id, ...rec }); have.add(c.fx); added++;
    dbg.added.push(c.teamA + "-" + c.teamB + "@" + rec.dt + " #" + ord);
  }
  return { added, dbg };
}

/* ---------- расписание из конфига ---------- */
function acParse(s){ const m=/^(\d{1,2}):(\d{2})$/.exec(s||""); if(!m)return null; const h=+m[1],mi=+m[2]; if(h>23||mi>59)return null; return h*60+mi; }
// "טעינת משחקים" = "בדיקת תוצאות" + 5 דק' — הזזת שעה HH:MM בדקות (עם גלישה ב-24 שעות)
function shiftHM(t,d){ const m=acParse(t); if(m==null) return t; const n=(((m+d)%1440)+1440)%1440; const z=(x)=>(x<10?"0":"")+x; return z(Math.floor(n/60))+":"+z(n%60); }
function newgamesSchedule(cfg){ return { on:!!(cfg.newgames&&cfg.newgames.on), after:((cfg.results&&cfg.results.after)||[]).map(x=>x+5), times:((cfg.results&&cfg.results.times)||[]).map(t=>shiftHM(t,5)), last:(cfg.newgames&&cfg.newgames.last)||0 }; }
function dueIsrael(times, srvLast){
  const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jerusalem",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const cur=(+ (p.find(x=>x.type==="hour")||{}).value)*60 + (+ (p.find(x=>x.type==="minute")||{}).value);
  const nowTs=Date.now(); let best=0;
  for(const t of times){ const m=acParse(t); if(m==null) continue; if(m<=cur){ const abs=nowTs-(cur-m)*60000; if(abs>best)best=abs; } }
  if(!best) return false;
  return best > (srvLast||0);
}
function ilOffsetMin(ts){ const d=new Date(ts); const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jerusalem",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(d); const g=(t)=>+((p.find((x)=>x.type===t)||{}).value); const asUTC=Date.UTC(g("year"),g("month")-1,g("day"),g("hour"),g("minute"),g("second")); return Math.round((asUTC-d.getTime())/60000); }
function ilWallToTs(wall){ if(!wall) return NaN; const s=String(wall); const Y=+s.slice(0,4),Mo=+s.slice(5,7),D=+s.slice(8,10),H=+s.slice(11,13),Mi=+s.slice(14,16); if(!(Y>0&&Mo>0&&D>0)||isNaN(H)||isNaN(Mi)){ const t=new Date(s).getTime(); return isNaN(t)?NaN:t; } const asUTC=Date.UTC(Y,Mo-1,D,H,Mi); const off=ilOffsetMin(asUTC); return asUTC-off*60000; }

/* ---------- источник матча: ESPN (espn<id>, fxLeague=slug) либо 365scores (365<id>, fxLeague="365:<comp>") ---------- */
const ISR_COMP = "42"; // ליגת העל ב-365scores
function srcOf(m){
  const fl = String((m && m.fxLeague) || "");
  if (fl.indexOf("365:") === 0) return { type: "365", comp: fl.slice(4) };
  const fx = String((m && m.fx) || "");
  if (fx.indexOf("365") === 0) return { type: "365", comp: ISR_COMP };
  return { type: "espn", slug: fl };
}
async function fetch365(comp){
  // -> [{id, teamA, teamB, dateISO, when, ended, winner, upcoming}], имена команд на иврите (langId=2)
  try {
    const url = "https://webws.365scores.com/web/games/?appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&userCountryId=6&competitions=" + encodeURIComponent(comp);
    const r = await fetch(url);
    if (!r.ok) { try { await slog("WARN", "365", "365 comp " + comp + " HTTP " + r.status); } catch (_) {} return []; }
    const j = await r.json();
    const games = (j && j.games) || [];
    const out = [];
    for (const g of games) {
      const hc = g.homeCompetitor || {}, aw = g.awayCompetitor || {};
      const ta = String(hc.name || ""), tb = String(aw.name || "");
      if (!g.id || !ta || !tb) continue;
      const t = new Date(g.startTime).getTime();
      const txt = String(g.shortStatusText || g.statusText || "");
      const ended = (Number(g.statusGroup) === 4) || /ended|finished|final|הסתיים|גמר/i.test(txt);
      const hs = Number(hc.score), as = Number(aw.score);
      const hasScore = Number.isFinite(hs) && Number.isFinite(as) && hs >= 0 && as >= 0;
      let winner = null;
      if (ended && hasScore) winner = hs > as ? "A" : (as > hs ? "B" : "X");
      const upcoming = !ended && (!Number.isFinite(t) || t > Date.now());
      out.push({ id: String(g.id), teamA: ta, teamB: tb, dateISO: g.startTime, when: Number.isFinite(t) ? t : 0, ended, winner, upcoming });
    }
    return out;
  } catch (e) { try { await slog("WARN", "365", "365 comp " + comp + " fail: " + ((e && e.message) || e)); } catch (_) {} return []; }
}

/* ---------- авто-апдейт: две независимые подсистемы (results / newgames), каждая = offset'ы после старта + фикс-часы ---------- */
function cfgClean(c, defOn, defAfter, defTimes){
  c = c || {};
  const on = (c.on === undefined && c.enabled === undefined) ? defOn : !!(c.on !== undefined ? c.on : c.enabled);
  let after = Array.isArray(c.after) ? c.after : defAfter;
  after = after.map((x) => Math.round(Number(x))).filter((x) => Number.isFinite(x) && x >= 0);
  let times = Array.isArray(c.times) ? c.times : defTimes;
  times = times.filter((t) => acParse(t) != null);
  return { on, after, times, last: Number(c.last) || 0 };
}
function migrateCfg(ac){
  ac = ac || {};
  if (ac.results || ac.newgames) {
    return { results: cfgClean(ac.results, true, [180], []), newgames: cfgClean(ac.newgames, true, [210], AC_DEF_TIMES) };
  }
  // старый формат {enabled, times, add35, lastFill, lastAdd} -> новый
  const oldTimes = Array.isArray(ac.times) ? ac.times.filter((t) => acParse(t) != null) : [];
  const oldEnabled = (ac.enabled === undefined) ? true : !!ac.enabled;
  const add35 = (ac.add35 === undefined) ? true : !!ac.add35;
  return {
    results: { on: true, after: [180], times: [], last: Number(ac.lastFill) || 0 },
    newgames: { on: true, after: add35 ? [210] : [], times: oldEnabled ? (oldTimes.length ? oldTimes : AC_DEF_TIMES.slice()) : [], last: Number(ac.lastAdd) || Number(ac.srvLast) || 0 },
  };
}
function dueByCfg(cfg, matches, now){
  if (!cfg || !cfg.on) return false;
  const last = cfg.last || 0;
  const offDue = (cfg.after || []).some((off) => { const ms = off * 60000; return matches.some((m) => { const t = ilWallToTs(m.dt); return Number.isFinite(t) && (t + ms) <= now && (t + ms) > last; }); });
  const timeDue = (cfg.times || []).length ? dueIsrael(cfg.times, last) : false;
  return offDue || timeDue;
}
async function fetchResults(pend){
  const results = {};
  const espnSlugs = new Set(["fifa.world"]); const comps = new Set();
  pend.forEach((m) => { const s = srcOf(m); if (s.type === "365") comps.add(s.comp); else if (s.slug) espnSlugs.add(s.slug); });
  const ds = pend.map((m) => m.dt).filter(Boolean).map((s) => new Date(s)).filter((d) => !isNaN(d.getTime()));
  let d0, d1;
  if (ds.length) { const mn = Math.min(...ds.map((d) => d.getTime())), mx = Math.max(...ds.map((d) => d.getTime())); d0 = new Date(mn - 2 * 864e5); d1 = new Date(mx + 2 * 864e5); }
  else { d0 = new Date(Date.now() - 45 * 864e5); d1 = new Date(Date.now() + 45 * 864e5); }
  for (const sl of espnSlugs) {
    try {
      const url = ESPN + encodeURIComponent(sl) + "/scoreboard?limit=300&dates=" + ymdUTC(d0) + "-" + ymdUTC(d1);
      const r = await fetch(url); if (!r.ok) continue; const j = await r.json();
      for (const e of ((j && j.events) || [])) {
        const cs = ((e.competitions && e.competitions[0]) || {}).competitors || [];
        const st = (e.status && e.status.type) || {};
        if (!(st.completed === true || st.state === "post")) continue;
        let home = null, away = null; cs.forEach((c) => { if (c.homeAway === "home") home = c; else if (c.homeAway === "away") away = c; });
        if (!home) home = cs[0]; if (!away) away = cs[1];
        let side = null;
        if (home && home.winner === true) side = "A";
        else if (away && away.winner === true) side = "B";
        else { const hs = home ? Number(home.score) : NaN, as = away ? Number(away.score) : NaN; if (!isNaN(hs) && !isNaN(as)) side = hs > as ? "A" : (hs < as ? "B" : "X"); }
        if (side) results["espn" + e.id] = side;
      }
    } catch (e) { try { await slog("WARN", "espn", "ESPN results fail: " + ((e && e.message) || e)); } catch (_) {} }
  }
  for (const cp of comps) { const games = await fetch365(cp); for (const g of games) { if (g.ended && g.winner) results["365" + g.id] = g.winner; } }
  return results;
}

/* ---------- core (экспортируется для тестов) ---------- */
export async function runCheck() {
  const tree = (await fbGet("")) || {};
  const cfg = migrateCfg(tree.autocfg || {});
  const meta = tree.meta || {};
  const bank = Number(meta.bank) || 100;
  const players = Object.keys(tree.players || {}).map((id) => ({ id, ...tree.players[id] }));
  const matches = Object.keys(tree.matches || {}).map((id) => ({ id, ...tree.matches[id], settled: !!tree.matches[id].settled, winner: tree.matches[id].winner || null }));
  const bets = {}; const bo = tree.bets || {}; for (const mid in bo) bets[mid] = { ...bo[mid] };
  const now = Date.now();
  try { await purgeOldCashlog(tree, now); } catch (e) {}
  try { await idleSweep(tree, players, matches, bets, bank, now); } catch (e) { try { await slog("ERROR","idle","idleSweep: "+((e&&e.message)||e)); } catch(_){} }
  try { await overBetSweep(players, matches, bets, bank, now); } catch (e) { try { await slog("ERROR","overbet","overBetSweep: "+((e&&e.message)||e)); } catch(_){} }
  // независимый от автоапдейта механизм «конец игры»: проверка результата со старт+105 (каждую минуту до зачёта)
  // и подгрузка новых игр через 5 мин после конца (старт+110, один раз на игру). Работает даже когда тумблеры выкл.
  // После איפוס матчей нет -> ни один триггер не срабатывает, игры НЕ возвращаются (защита задачи-7 сохранена).
  const endResDue = matches.some((m) => !m.settled && m.teamA && m.teamB && Number.isFinite(ilWallToTs(m.dt)) && now >= ilWallToTs(m.dt) + END_RES_MS);
  const endNgLast = (tree.autocfg && tree.autocfg.endchk && Number(tree.autocfg.endchk.ngLast)) || 0;
  const endNgDue = matches.some((m) => { const t = ilWallToTs(m.dt); return Number.isFinite(t) && (t + END_NG_MS) <= now && (t + END_NG_MS) > endNgLast; });
  const resultsDue = dueByCfg(cfg.results, matches, now) || endResDue;
  // טעינת משחקים: לוח הזמנים נגזר תמיד מ"בדיקת תוצאות" + 5 דק' (גם דקות וגם שעות קבועות); הפעלה/כיבוי נפרד
  const newgamesDue = dueByCfg(newgamesSchedule(cfg), matches, now);
  if (!resultsDue && !newgamesDue && !endNgDue) { await srvPulse(); return { skipped: true }; }

  let updated = 0, checked = 0; const settledLog = [];
  if (resultsDue) {
    const pend = matches.filter((m) => !m.settled && m.teamA && m.teamB && Number.isFinite(ilWallToTs(m.dt)) && now >= ilWallToTs(m.dt));
    checked = pend.length;
    if (pend.length) {
      const results = await fetchResults(pend);
      for (const m of pend) {
        const w = results[m.fx];
        if (!w) continue;
        if (w === "X" && !m.drawOK) continue; // нокаут: ничья в осн. время ≠ итог; ждём флаг источника / ручной сеттл
        const mb = bets[m.id] || (bets[m.id] = {});
        for (const pid in { ...mb }) { if (mb[pid] && mb[pid].auto) { await fbDel("/bets/" + m.id + "/" + pid); delete mb[pid]; } }
        if (w !== "X") {
          for (const p of players) {
            if (p.exited || !p.feePaid) continue;
            if (mb[p.id]) continue;
            if (availFor(p, m.id, matches, bets, bank) >= 1) { const nb = { team: "A", stake: 1, auto: true }; await fbPut("/bets/" + m.id + "/" + p.id, nb); mb[p.id] = nb; }
          }
        }
        await fbPatch("/matches/" + m.id, { settled: true, winner: w });
        m.settled = true; m.winner = w;
        settledLog.push(m.teamA + "-" + m.teamB + "=" + w);
        updated++;
      }
    }
  }

  // мало денег (free + открытые ставки < 1 ₪) -> авто-перевод в демо + уведомления (балансы уже учитывают свежие результаты)
  if (resultsDue) { try { await lowBalanceSweep(players, matches, bets, bank, now); } catch (e) { try { await slog("ERROR","demote","lowBalanceSweep: "+((e&&e.message)||e)); } catch(_){} } }

  // новые игры: по расписанию ИЛИ если только что освободился слот (что-то сведено) — добираем до 3 несведённых
  const runNew = newgamesDue || updated > 0 || endNgDue;
  let top = { added: 0, dbg: null };
  if (runNew) { top = await topUp(matches, 3); }

  const patch = {};
  if (resultsDue) patch.results = { ...cfg.results, last: now };
  if (runNew) patch.newgames = { ...cfg.newgames, last: now };
  if (endNgDue) patch.endchk = { ngLast: now }; // отметка «новые игры на конец+5 подгружены», чтобы не дёргать каждую минуту
  try { await fbPatch("/autocfg", patch); } catch (e) {}
  if (updated || top.added) { try { await fbPut("/rev", Date.now()); } catch (e) {} }
  try {
    const d = top.dbg || {};
    const settledStr = settledLog.length ? (" {" + settledLog.join(", ") + "}") : "";
    let msg = "res=" + (resultsDue ? 1 : 0) + (endResDue ? "(end)" : "") + " new=" + (newgamesDue ? 1 : 0) + (endNgDue ? "(end+5)" : "") + ((updated && !newgamesDue && !endNgDue) ? "+slot" : "") + " | checked=" + checked + " settled=" + updated + settledStr;
    if (runNew) msg += " | unsettled=" + (d.unsettled != null ? d.unsettled : "?") + " need=" + (d.need != null ? d.need : "?") + " | src[" + ((d.perSrc || []).join(",")) + "] cands=" + (d.cands != null ? d.cands : "?") + " | added=" + (top.added || 0) + ((d.added && d.added.length) ? (" {" + d.added.join(", ") + "}") : "");
    await slog("INFO", "run", msg, { res: resultsDue, new: newgamesDue, endRes: endResDue, endNg: endNgDue, checked, updated, settled: settledLog, topup: d });
  } catch (e) {}
  return { updated, checked, added: top.added, results: resultsDue, newgames: newgamesDue, fill: resultsDue, add: runNew };
}

export default async () => {
  try { const out = await runCheck(); return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } }); }
  catch (e) { try { await slog("CRIT", "server", "runCheck crashed: " + ((e && e.message) || e)); } catch (_) {} return new Response(JSON.stringify({ error: String((e && e.message) || e) }), { status: 500, headers: { "Content-Type": "application/json" } }); }
};

// «пульс» каждую минуту, чтобы новые игры подтягивались ТОЧНО в назначенное время (расписание — в приложении)
export const config = { schedule: "* * * * *" };
