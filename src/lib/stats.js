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

// ultimi n giorni (il più vecchio per primo) con "on" se hai guardato qualcosa
export function lastDays(days = [], n = 14) {
  const set = new Set(days), today = rome();
  return Array.from({ length: n }, (_, i) => { const d = shift(today, i - (n - 1)); return { d, on: set.has(d) }; });
}

const tops = (rows, pick) => { // massimo (o minimo) con pari merito: al massimo 2 titoli
  if (!rows.length) return [];
  const v = pick(rows.map((r) => r.v));
  return rows.filter((r) => r.v === v).sort((a, b) => a.m.title.localeCompare(b.m.title)).slice(0, 2);
};

// ---------- Roba a tema Marvel ----------
export const ENDGAME_MIN = 181; // durata di Avengers: Endgame, per i paragoni

// sceglie la frase della soglia più alta raggiunta
const tier = (tiers, v) => tiers.reduce((a, [min, t]) => (v >= min ? t : a), tiers[0][1]);

const memesOf = (s) => {
  const m = {
    intro: "Resta fino in fondo: c'è una scena dopo i titoli di coda.",
    hours: tier([
      [0, "Zero ore. Anche Groot ha detto di più quest'anno."],
      [1, "Hai appena iniziato. Anche Tony è partito da una caverna."],
      [300, "Avengers... Assemble! Il tuo divano è ufficialmente una base operativa."],
      [900, "Più di 15 ore: lo S.H.I.E.L.D. ti ha aperto un fascicolo."],
      [1800, "Hulk fa a pugni, tu fai maratone. Chi è più forte?"],
      [3600, "Hai visto più Marvel di quante cose Nick Fury nasconda ai suoi agenti."],
      [7200, "Hai visto 14.000.605 futuri. In tutti eri sul divano."],
    ], s.minutes),
    streak: tier([
      [0, "Streak spenta. Anche Thanos si è preso una pausa in campagna."],
      [3, "Tre giorni di fila: stai facendo il training montage."],
      [7, "Una settimana intera. «Posso farlo tutto il giorno»."],
      [14, "Due settimane di fila: Capitan America ti ha appena dato il cinque."],
      [30, "Un mese di fila: la T.V.A. vuole studiarti."],
    ], s.bestStreak),
    rewatch: tier([
      [0, "Nessun rewatch. Doctor Strange ha provato 14.000.605 volte, tu neanche una."],
      [2, "Seconda visione: hai cercato di nuovo il cameo di Stan Lee."],
      [3, "Tre volte: ormai le battute le sai a memoria."],
      [5, "Cinque rewatch: capisci le scene post-credit meglio degli sceneggiatori."],
      [10, "Dieci volte? Sei in un loop temporale: chiama la T.V.A."],
    ], s.topTimes),
    pct: tier([
      [0, "Hai solo grattato la superficie: il Multiverso è enorme."],
      [25, "Un quarto del catalogo: lo S.H.I.E.L.D. ti ha appena dato il badge."],
      [50, "Metà catalogo: perfettamente bilanciato, come tutte le cose dovrebbero essere."],
      [75, "Ne manca poco: «Sono inevitabile»."],
      [100, "Catalogo completo. «Io sono Iron Man»."],
    ], s.total ? s.pct : 0),
    best: s.best.length ? "Il tuo Tesseract: tutto il resto gli ruota intorno." : "Nessun voto: il trono di Asgard è vuoto.",
    worst: "Ogni universo ha il suo Ultron. Questo è il tuo.",
    avg: !s.ratedCount ? "Nessun voto: più riservato di Wakanda prima del 2018."
      : s.avg >= 4.5 ? "Voti altissimi: per te è tutto un capolavoro. Tony Stark ti vuole nel marketing."
      : s.avg <= 2.5 ? "Voti bassissimi: Nick Fury ti vuole come critico ufficiale."
      : "Giudizio equilibrato: né Thor in estasi né Fury sospettoso.",
  };
  // la frase che finisce sulla foto: la più "epica" tra quelle raggiunte
  m.card = s.total && s.pct >= 100 ? m.pct : s.topTimes >= 10 ? m.rewatch : s.bestStreak >= 14 ? m.streak : m.hours;
  return m;
};

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
  };
  s.last14 = lastDays(user.days, 14);
  s.memes = memesOf(s);
  return s;
}

export const fmt1 = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

export const fmtHours = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m` : `${Math.round(min)}m`);
