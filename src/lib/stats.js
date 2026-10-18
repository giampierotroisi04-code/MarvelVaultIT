// Statistiche personali (calcolate sul telefono a partire da catalogo + dati dell'utente)
const rome = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
const shift = (day, n) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// serie di giorni consecutivi: attuale (resta viva se hai guardato ieri) e migliore di sempre
export function streaks(days = []) {
  const set = new Set(days), today = rome();
  let cur = 0, d = set.has(today) ? today : shift(today, -1);
  while (set.has(d)) { cur++; d = shift(d, -1); }
  let best = 0, run = 0, prev = "";
  for (const x of [...set].sort()) { run = prev && shift(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return { cur, best };
}

const tops = (rows, pick) => { // massimo (o minimo) con pari merito: al massimo 2 titoli
  if (!rows.length) return [];
  const v = pick(rows.map((r) => r.v));
  return rows.filter((r) => r.v === v).sort((a, b) => a.m.title.localeCompare(b.m.title)).slice(0, 2);
};

export function computeStats(media = [], user = {}) {
  const w = new Set(user.watched || []), plays = user.plays || {}, ratings = user.ratings || {};
  let minutes = 0, seen = 0;
  const times = [];
  for (const m of media) {
    if (m.type === "series") {
      const all = (m.seasons || []).flatMap((s) => s.episodes || []);
      const withVideo = all.filter((e) => e.hasVideo);
      const per = m.runtime && all.length ? Math.round(m.runtime / all.length) : 0;
      const mins = (e) => e.runtime || per;
      const doneEps = all.filter((e) => w.has(e.id));
      for (const e of doneEps) minutes += mins(e) * Math.max(1, plays[e.id] || 0);
      // serie segnata come vista a mano, senza episodi spuntati: conta una volta intera
      if (w.has(m.id) && !doneEps.length) minutes += m.runtime || all.reduce((t, e) => t + mins(e), 0);
      if (w.has(m.id) || (withVideo.length && withVideo.every((e) => w.has(e.id)))) seen++;
      // quante volte hai visto la serie intera = il minimo tra le visioni dei suoi episodi
      const full = withVideo.length ? Math.min(...withVideo.map((e) => plays[e.id] || 0)) : 0;
      if (full > 0) times.push({ m, v: full });
    } else {
      if (w.has(m.id)) { seen++; minutes += (m.runtime || 0) * Math.max(1, plays[m.id] || 0); }
      if (plays[m.id] > 0) times.push({ m, v: plays[m.id] });
    }
  }
  const rated = media.filter((m) => ratings[m.id]).map((m) => ({ m, v: ratings[m.id] }));
  const best = tops(rated, (a) => Math.max(...a)), worst = tops(rated, (a) => Math.min(...a));
  const top = tops(times, (a) => Math.max(...a));
  const { cur, best: bestStreak } = streaks(user.days);
  return {
    minutes, seen, total: media.length,
    pct: media.length ? Math.round((seen / media.length) * 100) : 0,
    top: top[0]?.v > 1 ? top : [],            // "più visto" ha senso solo se qualcosa è stato rivisto
    topTimes: top[0]?.v || 0,
    streak: cur, bestStreak,
    best, worst: best[0] && worst[0] && best[0].v === worst[0].v ? [] : worst,
    ratedCount: rated.length,
    avg: rated.length ? Math.round((rated.reduce((t, r) => t + r.v, 0) / rated.length) * 10) / 10 : 0,
    missingRuntime: media.some((m) => w.has(m.id) && !m.runtime && m.type !== "series"),
  };
}

export const fmtHours = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m` : `${Math.round(min)}m`);
