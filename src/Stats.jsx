import { useState } from "react";
import { computeStats, fmtHours } from "./lib/stats.js";
import { I } from "./Icons.jsx";

const WRAP_YEAR = 2026;
const names = (rows) => rows.map((r) => r.m.title).join(" · ");
const stars = (v) => "★".repeat(v) + "☆".repeat(5 - v);

// ---------- Le mie statistiche ----------
export function StatsView({ media, user, go, wrapOn, openWrap }) {
  const s = computeStats(media, user);
  const empty = !s.seen && !s.streak;
  return (
    <div className="st">
      {wrapOn && (
        <button className="st-wrap" onClick={openWrap}>
          <small>NOVITÀ</small>
          <b>Il tuo MCU Wrapped {WRAP_YEAR} è pronto</b>
          <span>Scoprilo ora <I.Chevron size={16} /></span>
        </button>
      )}
      {empty && <p className="hint">Segna i titoli che hai visto o guardali dal bot: qui compaiono ore, streak e molto altro.</p>}
      <div className="st-grid">
        <div className="st-card big"><small>Ore viste</small><b>{fmtHours(s.minutes)}</b>{s.missingRuntime && <em>Alcuni titoli non hanno ancora la durata</em>}</div>
        <div className="st-card"><small>Streak</small><b>{s.streak} <i>{s.streak === 1 ? "giorno" : "giorni"}</i></b><em>Record: {s.bestStreak}</em></div>
        <div className="st-card"><small>Completamento</small><b>{s.pct}%</b><em>{s.seen} su {s.total} progetti</em></div>
      </div>
      <div className="st-bar"><i style={{ width: s.pct + "%" }} /></div>

      <div className="st-row">
        <small>Progetto più visto</small>
        {s.top.length ? <><b>{names(s.top)}</b><em>{s.top.length > 1 ? "ognuno" : ""} visto {s.topTimes} volte</em></> : <em>Nessun rewatch ancora: rivedi qualcosa!</em>}
      </div>
      <div className="st-row">
        <small>Progetto votato meglio</small>
        {s.best.length ? <><b>{names(s.best)}</b><em>{stars(s.best[0].v)}</em></> : <em>Non hai ancora votato niente</em>}
      </div>
      {s.worst.length > 0 && (
        <div className="st-row">
          <small>Progetto votato peggio</small>
          <b>{names(s.worst)}</b><em>{stars(s.worst[0].v)}</em>
        </div>
      )}
      <div className="st-row">
        <small>Media dei tuoi voti</small>
        {s.ratedCount ? <><b>{s.avg} / 5</b><em>su {s.ratedCount} {s.ratedCount === 1 ? "voto" : "voti"}</em></> : <em>Vota i titoli dalla loro scheda</em>}
      </div>
    </div>
  );
}

// ---------- Wrap (visibile solo quando lo pubblichi dall'admin) ----------
export function WrapView({ media, user, me, onClose }) {
  const s = computeStats(media, user);
  const days = Math.floor(s.minutes / 1440);
  const slides = [
    { k: "intro", a: "MCU WRAPPED", t: String(WRAP_YEAR), d: "Il tuo anno nell'universo Marvel. Pronto?" },
    { k: "hours", a: "Hai guardato per", t: fmtHours(s.minutes), d: days >= 1 ? `Più di ${days} ${days === 1 ? "giorno intero" : "giorni interi"} di fila.` : s.minutes ? `Circa ${Math.max(1, Math.round(s.minutes / 130))} film di durata media.` : "Il prossimo anno si riparte!" },
    { k: "top", a: "Il tuo progetto più rivisto", t: s.top.length ? names(s.top) : "Nessuno... per ora", d: s.top.length ? `Visto ${s.topTimes} volte. Un vero guilty pleasure.` : "Nessun rewatch quest'anno: l'anno nuovo è il momento giusto." },
    { k: "streak", a: "La tua streak", t: `${s.streak} ${s.streak === 1 ? "giorno" : "giorni"}`, d: `Il tuo record è di ${s.bestStreak} ${s.bestStreak === 1 ? "giorno" : "giorni"} consecutivi.` },
    { k: "pct", a: "Hai completato", t: `${s.pct}%`, d: `${s.seen} progetti su ${s.total} del catalogo.` },
    { k: "best", a: "Il tuo preferito", t: s.best.length ? names(s.best) : "Nessun voto", d: s.best.length ? stars(s.best[0].v) : "Vota i titoli per vederli qui." },
    ...(s.worst.length ? [{ k: "worst", a: "Il tuo flop", t: names(s.worst), d: stars(s.worst[0].v) }] : []),
    { k: "avg", a: "La media dei tuoi voti", t: s.ratedCount ? `${s.avg} / 5` : "—", d: s.ratedCount ? `Su ${s.ratedCount} ${s.ratedCount === 1 ? "voto" : "voti"}.` : "Nessun voto quest'anno." },
    { k: "end", a: `Il tuo ${WRAP_YEAR} in breve`, t: fmtHours(s.minutes), d: `${s.seen} progetti · streak record ${s.bestStreak} · ${s.pct}% completato` },
  ];
  const [i, setI] = useState(0);
  const sl = slides[i];
  const share = () => {
    const text = `Il mio MCU Wrapped ${WRAP_YEAR}: ${fmtHours(s.minutes)} guardate, ${s.seen} progetti visti, streak record ${s.bestStreak} giorni 🔥`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${me?.botUsername || ""}`)}&text=${encodeURIComponent(text)}`;
    window.Telegram?.WebApp?.openTelegramLink ? window.Telegram.WebApp.openTelegramLink(url) : window.open(url, "_blank");
  };
  return (
    <div className={"wrap wrap-" + sl.k}>
      <div className="wrap-dots">{slides.map((_, n) => <i key={n} className={n <= i ? "on" : ""} />)}</div>
      <button className="wrap-x" onClick={onClose} aria-label="Chiudi"><I.X size={22} /></button>
      <div className="wrap-body" key={i}>
        <small>{sl.a}</small>
        <h1>{sl.t}</h1>
        <p>{sl.d}</p>
      </div>
      <div className="wrap-nav">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Indietro</button>
        {i < slides.length - 1
          ? <button className="btn red" onClick={() => setI(i + 1)}>Avanti</button>
          : <button className="btn red" onClick={share}>Condividi</button>}
      </div>
    </div>
  );
}
