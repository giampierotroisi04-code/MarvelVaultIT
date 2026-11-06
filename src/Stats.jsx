import { useEffect, useRef, useState } from "react";
import { computeStats, fmtHours, fmt1 } from "./lib/stats.js";
import { makeWrapImage } from "./lib/wrapimg.js";
import { api, art } from "./api.js";
import { I } from "./Icons.jsx";
import logo from "./logo.jpg";

const WRAP_YEAR = 2026;
const names = (rows) => rows.map((r) => r.m.title).join(" · ");
const stars = (v) => "★".repeat(v) + "☆".repeat(5 - v);
const poster = (m) => art(m, "poster") || art(m, "backdrop");

// Gemma dell'Infinito (spenta = solo contorno)
function Gem({ color, on, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="-1 -1.1 2 2.2" aria-hidden="true" style={{ filter: on ? `drop-shadow(0 0 6px ${color})` : "none", flex: "none" }}>
      <path d="M0 -1 L.85 -.4 L.6 .9 L-.6 .9 L-.85 -.4 Z" fill={on ? color : "rgba(255,255,255,.04)"} stroke={on ? "#fff" : "rgba(255,255,255,.3)"} strokeWidth=".09" strokeLinejoin="round" />
      <path d="M-.85 -.4 H.85 M0 -1 L-.3 -.4 L-.2 .9 M0 -1 L.3 -.4 L.2 .9" fill="none" stroke={on ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.14)"} strokeWidth=".06" />
    </svg>
  );
}

const StoneRow = ({ stones }) => (
  <div className="stones">
    {stones.map((x) => (
      <div key={x.k} className={"stone" + (x.on ? " on" : "")} style={{ "--g": x.color }}>
        <Gem color={x.color} on={x.on} size={34} />
        <small>{x.short}</small>
      </div>
    ))}
  </div>
);

// ---------- Le mie statistiche ----------
export function StatsView({ media, user, categories = [], wrapOn, openWrap }) {
  const s = computeStats(media, user, categories);
  const empty = !s.seen && !s.streak && !s.views;
  return (
    <div className="st">
      {wrapOn && (
        <button className="st-wrap" onClick={openWrap}>
          <small>NOVITÀ</small>
          <b>Il tuo MCU Wrapped {WRAP_YEAR} è pronto</b>
          <span>Scoprilo ora <I.Chevron size={16} /></span>
        </button>
      )}
      {empty && <p className="hint">Segna i titoli che hai visto o guardali dal bot: qui compaiono ore, streak, gemme e molto altro.</p>}

      <div className="st-rank">
        <div className="st-rank-top">
          <span className="st-rank-ic"><I.Shield size={22} /></span>
          <div><small>Il tuo grado</small><b>{s.rank.name}</b></div>
        </div>
        <em>{s.rank.line}</em>
        <div className="st-bar thin"><i style={{ width: s.rankPct + "%" }} /></div>
        <small className="st-rank-f">{s.nextRank ? `Ancora ${fmtHours(s.nextRank.min - s.minutes)} per diventare ${s.nextRank.name}` : "Hai raggiunto il grado massimo"}</small>
        <div className="st-hero">
          <small>Il tuo eroe</small>
          <b>{s.hero.name}</b>
          <em>{s.hero.line}</em>
        </div>
      </div>

      <div className="st-grid">
        <div className="st-card big">
          <small>Ore viste</small><b>{fmtHours(s.minutes)}</b>
          {s.endgames >= 0.1 && <em>= {fmt1(s.endgames)} maratone di Avengers: Endgame</em>}
          {s.missingRuntime && <em>Alcuni titoli non hanno ancora la durata</em>}
        </div>
        <div className="st-card"><small>Streak</small><b>{s.streak} <i>{s.streak === 1 ? "giorno" : "giorni"}</i></b><em>Record: {s.bestStreak}</em></div>
        <div className="st-card"><small>Completamento</small><b>{s.pct}%</b><em>{s.seen} su {s.total} progetti</em></div>
        <div className="st-card"><small>Film visti</small><b>{s.filmsSeen}</b><em>nel catalogo</em></div>
        <div className="st-card"><small>Serie viste</small><b>{s.seriesSeen}</b><em>complete</em></div>
        <div className="st-card"><small>Visioni totali</small><b>{s.views}</b><em>con rewatch</em></div>
        <div className="st-card"><small>Giorni attivi</small><b>{s.activeDays}</b><em>in cui hai guardato</em></div>
      </div>
      <div className="st-bar"><i style={{ width: s.pct + "%" }} /></div>

      <div className="st-stones">
        <div className="st-stones-h"><small>Gemme dell'Infinito</small><b>{s.stonesOn}/6</b></div>
        <StoneRow stones={s.stones} />
        <div className="st-stl">
          {s.stones.map((x) => (
            <div key={x.k} className={x.on ? "on" : ""}>
              <Gem color={x.color} on={x.on} size={22} />
              <span><b>{x.name}</b><small>{x.on ? "Sbloccata" : x.need}</small></span>
              {x.on && <I.Check size={16} />}
            </div>
          ))}
        </div>
        {s.stonesOn === 6 && <p className="st-snap">Guanto completo: puoi schioccare le dita.</p>}
      </div>

      {s.universe && (
        <div className="st-row">
          <small>Universo preferito</small>
          <b>{s.universe.emoji} {s.universe.name}</b><em>{s.universe.n} {s.universe.n === 1 ? "titolo visto" : "titoli visti"} qui dentro</em>
        </div>
      )}
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
export function WrapView({ media, user, me, categories = [], onClose }) {
  const s = computeStats(media, user, categories);
  const days = Math.floor(s.minutes / 1440);
  const tu = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
  const who = tu.username ? "@" + tu.username : tu.first_name || me?.user?.name || "te";
  const slides = [
    { k: "intro", a: "MCU WRAPPED", t: String(WRAP_YEAR), d: "Il tuo anno nell'universo Marvel. Pronto a schioccare le dita?" },
    { k: "hours", a: "Hai guardato per", t: fmtHours(s.minutes),
      d: !s.minutes ? "Il prossimo anno si riparte!"
        : s.endgames >= 1 ? `Come rivedere Avengers: Endgame ${fmt1(s.endgames)} volte di fila${days >= 1 ? ` · più di ${days} ${days === 1 ? "giorno intero" : "giorni interi"}` : ""}.`
        : `Circa ${Math.max(1, Math.round(s.minutes / 130))} film di durata media.` },
    { k: "rank", a: "Il tuo grado", t: s.rank.name, d: s.rank.line, ac: "#ffd23a", bar: s.rankPct,
      foot: s.nextRank ? `Ancora ${fmtHours(s.nextRank.min - s.minutes)} per diventare ${s.nextRank.name}` : "Grado massimo raggiunto" },
    { k: "hero", a: "L'eroe che ti somiglia", t: s.hero.name, d: s.hero.line, ac: "#2d7bff" },
    s.top.length
      ? { k: "top", a: "Il tuo progetto più rivisto", t: names(s.top), d: `Visto ${s.topTimes} volte. Un vero guilty pleasure.`, bg: poster(s.top[0].m) }
      : { k: "top", a: "Il tuo progetto più rivisto", t: "Nessuno... per ora", d: "Nessun rewatch quest'anno: l'anno nuovo è il momento giusto." },
    ...(s.universe ? [{ k: "uni", a: "Il tuo universo preferito", t: `${s.universe.emoji} ${s.universe.name}`.trim(), d: `${s.universe.n} ${s.universe.n === 1 ? "titolo visto" : "titoli visti"} qui dentro.`, ac: "#2fe07a" }] : []),
    { k: "streak", a: "La tua streak", t: `${s.streak} ${s.streak === 1 ? "giorno" : "giorni"}`, d: `Il tuo record è di ${s.bestStreak} ${s.bestStreak === 1 ? "giorno" : "giorni"} consecutivi. Puoi farlo tutto il giorno.` },
    { k: "stones", a: "Gemme dell'Infinito", t: `${s.stonesOn} su 6`, d: s.stonesOn === 6 ? "Guanto completo: puoi schioccare le dita." : "Ognuna si sblocca con un traguardo: ti manca ancora qualcosa.", ac: "#a05cff", stones: s.stones },
    { k: "pct", a: "Hai completato", t: `${s.pct}%`, d: `${s.seen} progetti su ${s.total} del catalogo.` },
    { k: "best", a: "Il tuo preferito", t: s.best.length ? names(s.best) : "Nessun voto", d: s.best.length ? stars(s.best[0].v) : "Vota i titoli per vederli qui.", bg: s.best.length ? poster(s.best[0].m) : "" },
    ...(s.worst.length ? [{ k: "worst", a: "Il tuo flop", t: names(s.worst), d: stars(s.worst[0].v), bg: poster(s.worst[0].m) }] : []),
    { k: "avg", a: "La media dei tuoi voti", t: s.ratedCount ? `${s.avg} / 5` : "—", d: s.ratedCount ? `Su ${s.ratedCount} ${s.ratedCount === 1 ? "voto" : "voti"}.` : "Nessun voto quest'anno." },
    { k: "end", a: "Il tuo MCU Wrapped è pronto", t: "", d: "" },
  ];
  const [i, setI] = useState(0);
  const [pic, setPic] = useState(null); // { blob, url }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const urlRef = useRef("");
  const sl = slides[i];
  const last = i === slides.length - 1;

  // la foto si crea quando arrivi all'ultima schermata
  useEffect(() => {
    if (!last || pic) return;
    let alive = true;
    makeWrapImage({ s, name: who, year: WRAP_YEAR, bot: me?.botUsername, logo, bgUrl: poster((s.top[0] || s.best[0])?.m) })
      .then((blob) => { if (!alive) return; const url = URL.createObjectURL(blob); urlRef.current = url; setPic({ blob, url }); })
      .catch(() => alive && setMsg("Non sono riuscito a creare la foto"));
    return () => { alive = false; };
  }, [last]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const text = `Il mio MCU Wrapped ${WRAP_YEAR}: ${fmtHours(s.minutes)} guardate, grado ${s.rank.name}, ${s.stonesOn}/6 Gemme dell'Infinito`;
  const shareText = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${me?.botUsername || ""}`)}&text=${encodeURIComponent(text)}`;
    window.Telegram?.WebApp?.openTelegramLink ? window.Telegram.WebApp.openTelegramLink(url) : window.open(url, "_blank");
  };
  // il bot manda la foto nella chat: da lì si salva o si inoltra a chi vuoi
  const sendChat = async () => {
    if (!pic || busy) return;
    setBusy(true); setMsg("");
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(pic.blob); });
      await api("wrapped-photo", { body: { image: data } });
      setMsg("Foto inviata nella chat con il bot: salvala o inoltrala da lì!");
    } catch (e) {
      const err = e.data?.error;
      if (err === "start_required") {
        setMsg("Premi START sul bot per ricevere la foto.");
        setTimeout(() => window.Telegram?.WebApp?.openTelegramLink?.(`https://t.me/${me?.botUsername}`), 1400);
      } else setMsg(err === "rate" ? "Un attimo, riprova tra poco" : "Invio non riuscito");
    }
    setBusy(false);
  };
  const sharePhoto = async () => {
    if (!pic) return;
    const file = new File([pic.blob], "mcu-wrapped.jpg", { type: "image/jpeg" });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch (e) { if (e?.name === "AbortError") return; }
    sendChat(); // dentro Telegram la condivisione diretta spesso non c'è: la foto arriva in chat
  };

  return (
    <div className={"wrap wrap-" + sl.k} style={sl.ac ? { "--ac": sl.ac } : undefined}>
      {sl.bg && <div className="wrap-bg" key={"bg" + i} style={{ backgroundImage: `url(${sl.bg})` }} />}
      <div className="wrap-dots">{slides.map((_, n) => <i key={n} className={n <= i ? "on" : ""} />)}</div>
      <button className="wrap-x" onClick={onClose} aria-label="Chiudi"><I.X size={22} /></button>
      <div className="wrap-body" key={i}>
        <small>{sl.a}</small>
        {sl.t && <h1>{sl.t}</h1>}
        {sl.d && <p>{sl.d}</p>}
        {sl.bar != null && <div className="wrap-prog"><i style={{ width: sl.bar + "%" }} /></div>}
        {sl.foot && <em className="wrap-foot">{sl.foot}</em>}
        {sl.stones && <div className="wrap-stones">{sl.stones.map((x) => <div key={x.k} className={"stone" + (x.on ? " on" : "")}><Gem color={x.color} on={x.on} size={44} /><small>{x.short}</small></div>)}</div>}
        {last && (
          <>
            <div className="wrap-pic">{pic ? <img src={pic.url} alt="Il tuo MCU Wrapped" /> : <span className="wrap-wait">Sto creando la tua foto…</span>}</div>
            <p className="wrap-sum">{s.seen} progetti · streak record {s.bestStreak} · {s.pct}% completato</p>
            {msg && <p className="wrap-msg">{msg}</p>}
          </>
        )}
      </div>
      {last ? (
        <div className="wrap-nav col">
          <button className="btn red" disabled={!pic || busy} onClick={sharePhoto}>Condividi la foto</button>
          <button className="btn" disabled={!pic || busy} onClick={sendChat}>Ricevi la foto in chat</button>
          <div className="wrap-sub"><button className="lnk" onClick={() => setI(i - 1)}>Indietro</button><button className="lnk" onClick={shareText}>Condividi come testo</button></div>
        </div>
      ) : (
        <div className="wrap-nav">
          <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Indietro</button>
          <button className="btn red" onClick={() => setI(i + 1)}>Avanti</button>
        </div>
      )}
    </div>
  );
}

// ---------- Sezione Statistiche (come Timeline e Doomsday) ----------
export function StatsPage({ media, user, me, categories = [], features = {} }) {
  const [wrap, setWrap] = useState(false);
  return (
    <div className="page">
      <h1 className="ptitle">Le mie statistiche</h1>
      <StatsView media={media} user={user} categories={categories} wrapOn={!!features.wrap} openWrap={() => setWrap(true)} />
      {wrap && features.wrap && <WrapView media={media} user={user} me={me} categories={categories} onClose={() => setWrap(false)} />}
    </div>
  );
}
