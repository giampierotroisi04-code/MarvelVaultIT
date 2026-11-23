import { useEffect, useRef, useState } from "react";
import { computeStats, fmtHours, fmt1 } from "./lib/stats.js";
import { makeWrapImage } from "./lib/wrapimg.js";
import { api, art, getLang } from "./api.js";
import { tr } from "./i18n.js";
import { I } from "./Icons.jsx";
import { logoUrl } from "./Logos.jsx";

const WRAP_YEAR = 2026;
const names = (rows) => rows.map((r) => r.m.title).join(" · ");
const stars = (v) => "★".repeat(v) + "☆".repeat(5 - v);
const poster = (m) => art(m, "poster") || art(m, "backdrop");

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
      {empty && <p className="hint">Segna i titoli che hai visto o guardali dal bot: qui compaiono ore, streak e molto altro.</p>}

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
const Meme = ({ t }) => (t ? <div className="w-meme"><b aria-hidden="true">“</b><span>{t}</span></div> : null);

const Ring = ({ pct, color }) => (
  <svg className="w-ring" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
    <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(Math.min(100, pct) / 100) * 326.7} 327`} transform="rotate(-90 60 60)" />
    <text x="60" y="71" textAnchor="middle" fontSize="32" fill="#fff" fontFamily='"Bebas Neue",Impact,sans-serif'>{pct}%</text>
  </svg>
);

export function WrapView({ media, user, me, categories = [], onClose }) {
  const s = computeStats(media, user, categories);
  const m = s.memes;
  const days = Math.floor(s.minutes / 1440);
  const tu = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
  const who = tu.username ? "@" + tu.username : tu.first_name || me?.user?.name || "Utente";
  const [avatar, setAvatar] = useState("");
  useEffect(() => { api("avatar").then((r) => setAvatar(r.photo || "")).catch(() => {}); }, []);
  const egN = Math.min(12, Math.floor(s.endgames));

  const slides = [
    { k: "intro", a: "MCU WRAPPED", t: String(WRAP_YEAR), d: "Il tuo anno nell'universo Marvel. Pronto a schioccare le dita?", meme: m.intro,
      vis: <div className="w-me">{avatar ? <img src={avatar} alt="" /> : <span>{who.replace("@", "").charAt(0).toUpperCase()}</span>}<b>{who}</b></div> },
    { k: "hours", a: "Hai guardato per", t: fmtHours(s.minutes),
      d: !s.minutes ? "Il prossimo anno si riparte!"
        : s.endgames >= 1 ? `Come rivedere Avengers: Endgame ${fmt1(s.endgames)} volte di fila${days >= 1 ? ` · più di ${days} ${days === 1 ? "giorno intero" : "giorni interi"}` : ""}.`
        : `Circa ${Math.max(1, Math.round(s.minutes / 130))} film di durata media.`,
      meme: m.hours,
      vis: egN > 0 ? <div className="w-eg">{Array.from({ length: egN }, (_, n) => <I.Film key={n} size={22} />)}{s.endgames >= 13 && <b>+</b>}</div> : null },
    s.top.length
      ? { k: "top", a: "Il tuo progetto più rivisto", t: names(s.top), d: `Visto ${s.topTimes} volte. Un vero guilty pleasure.`, meme: m.rewatch, bg: poster(s.top[0].m), pic: poster(s.top[0].m) }
      : { k: "top", a: "Il tuo progetto più rivisto", t: "Nessuno... per ora", d: "Nessun rewatch quest'anno: l'anno nuovo è il momento giusto.", meme: m.rewatch },
    { k: "streak", a: "La tua streak", t: `${s.streak} ${s.streak === 1 ? "giorno" : "giorni"}`, d: `Il tuo record è di ${s.bestStreak} ${s.bestStreak === 1 ? "giorno" : "giorni"} consecutivi.`, meme: m.streak, ac: "#ff9a2b",
      vis: <div className="w-heat" aria-label="Ultimi 14 giorni">{s.last14.map((x) => <i key={x.d} className={x.on ? "on" : ""} title={x.d} />)}</div> },
    { k: "pct", a: "Hai completato", t: `${s.pct}%`, d: `${s.seen} progetti su ${s.total} del catalogo.`, meme: m.pct, ac: "#2fe07a", vis: <Ring pct={s.pct} color="#2fe07a" /> },
    { k: "best", a: "Il tuo preferito", t: s.best.length ? names(s.best) : "Nessun voto", d: s.best.length ? stars(s.best[0].v) : "Vota i titoli per vederli qui.", meme: m.best, ac: "#ffd23a", bg: s.best.length ? poster(s.best[0].m) : "", pic: s.best.length ? poster(s.best[0].m) : "" },
    ...(s.worst.length ? [{ k: "worst", a: "Il tuo flop", t: names(s.worst), d: stars(s.worst[0].v), meme: m.worst, bg: poster(s.worst[0].m), pic: poster(s.worst[0].m) }] : []),
    { k: "avg", a: "La media dei tuoi voti", t: s.ratedCount ? `${s.avg} / 5` : "—", d: s.ratedCount ? `Su ${s.ratedCount} ${s.ratedCount === 1 ? "voto" : "voti"}.` : "Nessun voto quest'anno.", meme: m.avg, ac: "#ffd23a",
      vis: s.ratedCount ? <div className="w-stars">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(s.avg) ? "on" : ""}>★</span>)}</div> : null },
    { k: "end", a: "Il tuo MCU Wrapped è pronto", t: "", d: "" },
  ];
  const [i, setI] = useState(0);
  const [pic, setPic] = useState(null); // { blob, url }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const urlRef = useRef("");
  const sl = slides[i];
  const last = i === slides.length - 1;
  const next = () => setI((n) => Math.min(slides.length - 1, n + 1));
  const prev = () => setI((n) => Math.max(0, n - 1));

  // la foto si crea quando arrivi all'ultima schermata
  useEffect(() => {
    if (!last || pic) return;
    let alive = true;
    makeWrapImage({ s, name: who, year: WRAP_YEAR, bot: me?.botUsername, logo: logoUrl(getLang()), avatar })
      .then((blob) => { if (!alive) return; const url = URL.createObjectURL(blob); urlRef.current = url; setPic({ blob, url }); })
      .catch(() => alive && setMsg("Non sono riuscito a creare la foto"));
    return () => { alive = false; };
  }, [last, avatar]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const text = getLang() === "en" ? `My MCU Wrapped ${WRAP_YEAR}: ${fmtHours(s.minutes)} watched, ${s.seen} titles seen. ${tr(m.card)}` : `Il mio MCU Wrapped ${WRAP_YEAR}: ${fmtHours(s.minutes)} guardate, ${s.seen} progetti visti. ${m.card}`;
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
      <div className="wrap-head"><img src={logoUrl(getLang())} alt="" /><span>MCU WRAPPED {WRAP_YEAR}</span></div>
      <button className="wrap-x" onClick={onClose} aria-label="Chiudi"><I.X size={22} /></button>
      {!last && <><button className="wrap-tap l" aria-label="Indietro" onClick={prev} /><button className="wrap-tap r" aria-label="Avanti" onClick={next} /></>}
      <div className="wrap-body" key={i}>
        <small>{sl.a}</small>
        {sl.pic && <div className="w-poster" style={{ backgroundImage: `url(${sl.pic})` }} />}
        {sl.t && <h1>{sl.t}</h1>}
        {sl.d && <p>{sl.d}</p>}
        {sl.vis}
        <Meme t={sl.meme} />
        {last && (
          <>
            <div className="wrap-pic">{pic ? <img src={pic.url} alt="Il tuo MCU Wrapped" /> : <span className="wrap-wait">Sto creando la tua foto…</span>}</div>
            {msg && <p className="wrap-msg">{msg}</p>}
          </>
        )}
      </div>
      {last ? (
        <div className="wrap-nav col">
          <button className="btn red" disabled={!pic || busy} onClick={sharePhoto}>Condividi la foto</button>
          <button className="btn" disabled={!pic || busy} onClick={sendChat}>Ricevi la foto in chat</button>
          <div className="wrap-sub"><button className="lnk" onClick={prev}>Indietro</button><button className="lnk" onClick={shareText}>Condividi come testo</button></div>
        </div>
      ) : (
        <div className="wrap-nav">
          <button className="btn" disabled={i === 0} onClick={prev}>Indietro</button>
          <button className="btn red" onClick={next}>Avanti</button>
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
