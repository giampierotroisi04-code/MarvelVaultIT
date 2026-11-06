// Statistiche personali (calcolate sul telefono a partire da catalogo + dati dell'utente)
import { descIds } from "./util.js";

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

// ---------- Roba a tema Marvel ----------
export const ENDGAME_MIN = 181; // durata di Avengers: Endgame, per i paragoni

// grado in base alle ore viste (soglie in minuti)
export const RANKS = [
  { min: 0, name: "Civile di New York", line: "Hai appena visto i Chitauri dalla finestra: il viaggio comincia ora." },
  { min: 120, name: "Recluta S.H.I.E.L.D.", line: "Il tuo badge è appena stato stampato." },
  { min: 600, name: "Agente S.H.I.E.L.D.", line: "Missioni sul campo: il Multiverso ormai ti è familiare." },
  { min: 1500, name: "Vendicatore", line: "Hai un posto fisso sul Quinjet." },
  { min: 3600, name: "Stregone Supremo", line: "Il Multiverso non ha più segreti per te." },
  { min: 7200, name: "L'Osservatore", line: "Vedi tutto, da sempre. Nessuno ne sa più di te." },
];

// l'eroe che ti somiglia di più (in ordine di priorità)
const heroOf = (s) => {
  if (s.total >= 10 && s.pct >= 70) return { name: "Thanos", line: "Hai raccolto quasi tutto il catalogo. Sei inevitabile." };
  if (s.topTimes >= 3) return { name: "Doctor Strange", line: "Rivedi, rivedi, rivedi: hai già visto tutti i finali possibili." };
  if (s.bestStreak >= 7) return { name: "Captain America", line: "Puoi farlo tutto il giorno: la tua costanza è da Primo Vendicatore." };
  if (s.minutes >= 1500) return { name: "Hulk", line: "Quando parti con una maratona non ti ferma nessuno." };
  if (s.ratedCount >= 3 && s.avg <= 2.8) return { name: "Nick Fury", line: "Non ti fidi di nessuno: i tuoi voti sono severissimi." };
  if (s.ratedCount >= 3 && s.avg >= 4.3) return { name: "Spider-Man", line: "Il vicino di casa entusiasta: ami quasi tutto quello che guardi." };
  return { name: "Tony Stark", line: "La tua armatura è ancora in costruzione: il meglio deve venire." };
};

// le sei Gemme dell'Infinito: si sbloccano con piccoli traguardi
const stonesOf = (s) => [
  { k: "space", short: "Spazio", name: "Gemma dello Spazio", color: "#2d7bff", on: s.seen >= 5, need: "Guarda 5 progetti" },
  { k: "mind", short: "Mente", name: "Gemma della Mente", color: "#ffd23a", on: s.ratedCount >= 5, need: "Vota 5 titoli" },
  { k: "reality", short: "Realtà", name: "Gemma della Realtà", color: "#ff3b3b", on: s.minutes >= 1200, need: "Raggiungi 20 ore viste" },
  { k: "power", short: "Potere", name: "Gemma del Potere", color: "#a05cff", on: s.bestStreak >= 7, need: "Fai una streak di 7 giorni" },
  { k: "time", short: "Tempo", name: "Gemma del Tempo", color: "#2fe07a", on: s.rewatched, need: "Rivedi un titolo già visto" },
  { k: "soul", short: "Anima", name: "Gemma dell'Anima", color: "#ff9a2b", on: s.pct >= 50, need: "Completa il 50% del catalogo" },
];

export function computeStats(media = [], user = {}, categories = []) {
  const w = new Set(user.watched || []), plays = user.plays || {}, ratings = user.ratings || {};
  let minutes = 0, seen = 0, views = 0, filmsSeen = 0, seriesSeen = 0;
  const seenIds = new Set();
  const times = [];
  for (const m of media) {
    if (m.type === "series") {
      const all = (m.seasons || []).flatMap((s) => s.episodes || []);
      const withVideo = all.filter((e) => e.hasVideo);
      const per = m.runtime && all.length ? Math.round(m.runtime / all.length) : 0;
      const mins = (e) => e.runtime || per;
      // le ore contano SOLO le visioni reali (video ricevuto dal bot), non i "segna come visto" a mano
      for (const e of all) { minutes += mins(e) * (plays[e.id] || 0); views += plays[e.id] || 0; }
      if (w.has(m.id) || (withVideo.length && withVideo.every((e) => w.has(e.id)))) { seen++; seriesSeen++; seenIds.add(m.id); }
      // quante volte hai visto la serie intera = il minimo tra le visioni dei suoi episodi
      const full = withVideo.length ? Math.min(...withVideo.map((e) => plays[e.id] || 0)) : 0;
      if (full > 0) times.push({ m, v: full });
    } else {
      if (w.has(m.id)) { seen++; filmsSeen++; seenIds.add(m.id); }
      minutes += (m.runtime || 0) * (plays[m.id] || 0);
      views += plays[m.id] || 0;
      if (plays[m.id] > 0) times.push({ m, v: plays[m.id] });
    }
  }
  const rated = media.filter((m) => ratings[m.id]).map((m) => ({ m, v: ratings[m.id] }));
  const best = tops(rated, (a) => Math.max(...a)), worst = tops(rated, (a) => Math.min(...a));
  const top = tops(times, (a) => Math.max(...a));
  const { cur, best: bestStreak } = streaks(user.days);

  // universo preferito: la categoria principale con più titoli visti
  let universe = null;
  for (const c of categories.filter((x) => !x.parentId)) {
    const ids = descIds(categories, c.id);
    const n = media.filter((m) => seenIds.has(m.id) && m.categoryIds?.some((x) => ids.includes(x))).length;
    if (n > 0 && (!universe || n > universe.n)) universe = { name: c.name, emoji: c.emoji || "", n };
  }

  const s = {
    minutes, seen, total: media.length, views, filmsSeen, seriesSeen,
    pct: media.length ? Math.round((seen / media.length) * 100) : 0,
    top: top[0]?.v > 1 ? top : [],            // "più visto" ha senso solo se qualcosa è stato rivisto
    topTimes: top[0]?.v > 1 ? top[0].v : 0,
    rewatched: times.some((t) => t.v > 1),
    streak: cur, bestStreak,
    activeDays: new Set(user.days || []).size,
    best, worst: best[0] && worst[0] && best[0].v === worst[0].v ? [] : worst,
    ratedCount: rated.length,
    avg: rated.length ? Math.round((rated.reduce((t, r) => t + r.v, 0) / rated.length) * 10) / 10 : 0,
    missingRuntime: media.some((m) => plays[m.id] > 0 && !m.runtime && m.type !== "series"),
    endgames: Math.round((minutes / ENDGAME_MIN) * 10) / 10,
    universe,
  };
  const ri = RANKS.reduce((a, r, i) => (minutes >= r.min ? i : a), 0);
  s.rank = RANKS[ri];
  s.nextRank = RANKS[ri + 1] || null;
  s.rankPct = s.nextRank ? Math.round(((minutes - s.rank.min) / (s.nextRank.min - s.rank.min)) * 100) : 100;
  s.hero = heroOf(s);
  s.stones = stonesOf(s);
  s.stonesOn = s.stones.filter((x) => x.on).length;
  return s;
}

export const fmt1 = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

export const fmtHours = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m` : `${Math.round(min)}m`);
