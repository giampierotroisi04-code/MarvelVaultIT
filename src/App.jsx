import { useEffect, useState } from "react";
import { api, imgUrl, art } from "./api.js";
import { descIds, byRelease } from "./lib/util.js";
import { I } from "./Icons.jsx";
import Admin from "./Admin.jsx";
import logo from "./logo.jpg";

const tg = window.Telegram?.WebApp;
const catSort = (c) => { const o = c?.mediaOrder || []; const rel = byRelease("asc"); return (a, b) => { const x = o.indexOf(a.id), y = o.indexOf(b.id); return x >= 0 && y >= 0 ? x - y : x >= 0 ? -1 : y >= 0 ? 1 : rel(a, b); }; };
const byNum = (a, b) => (a.number || 0) - (b.number || 0);
const kind = (m) => (m.type === "movie" ? "Film" : "Serie TV");

function Poster({ m }) {
  const src = art(m, "poster");
  return src ? <img src={src} loading="lazy" alt="" /> : <div className="ph"><I.Film size={28} /></div>;
}

function Card({ m, go, seen }) {
  return (
    <div className="card" onClick={() => go({ n: "media", id: m.id })}>
      <div className="pw">
        <Poster m={m} />
        <span className="tag">{m.type === "series" ? <I.Tv size={11} /> : <I.Film size={11} />} {m.type === "series" ? "Serie" : "Film"}</span>
        {seen && <span className="seen"><I.Check size={12} /></span>}
      </div>
      <b className="ct">{m.title}</b>
    </div>
  );
}

const Grid = ({ items, go, user }) =>
  items.length
    ? <div className="grid">{items.map((m) => <Card key={m.id} m={m} go={go} seen={user.watched.includes(m.id)} />)}</div>
    : null;

const Rail = ({ title, items, go, user }) =>
  items.length ? (
    <section className="blk">
      <div className="sec">
        <h2>{title}</h2>
        {items.length > 8 && <button onClick={() => go({ n: "coll", title, ids: items.map((m) => m.id) })}>Vedi tutti <I.Chevron size={16} /></button>}
      </div>
      <div className="rail">{items.slice(0, 20).map((m) => <Card key={m.id} m={m} go={go} seen={user.watched.includes(m.id)} />)}</div>
    </section>
  ) : null;

function CatTiles({ cats, count, go }) {
  return (
    <div className="tiles">
      {cats.map((c) => {
        const n = count(c.id);
        return (
          <div key={c.id} className="tile" style={c.cover ? { backgroundImage: `url(${imgUrl(c.cover)})` } : {}} onClick={() => go({ n: "cat", id: c.id })}>
            {!c.cover && <I.Folder size={46} className="tf" />}
            <div className="tl">
              <b>{c.emoji} {c.name}</b>
              {n > 0 && <small>{n} {n === 1 ? "titolo" : "titoli"}</small>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Header = ({ onSearch }) => (
  <header className="top">
    <img src={logo} alt="" />
    <div className="brand"><b>Marvel Italia</b><small>STREAMING</small></div>
    <button className="ico" onClick={onSearch} aria-label="Cerca"><I.Search size={20} /></button>
  </header>
);

function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-h"><b>{title}</b><button className="ico" onClick={onClose} aria-label="Chiudi"><I.X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function RequestSheet({ initial, onClose, say }) {
  const [t, setT] = useState(initial || "");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (t.trim().length < 2) return;
    setBusy(true);
    try { await api("request", { body: { text: t } }); say("Richiesta inviata"); onClose(); }
    catch (e) { say(e.data?.error === "limit" ? "Hai raggiunto il limite di richieste di oggi" : "Invio non riuscito"); setBusy(false); }
  };
  return (
    <Sheet title="Richiedi un titolo" onClose={onClose}>
      <p className="hint">Scrivi il nome del film o della serie che vorresti vedere.</p>
      <input className="in" maxLength={120} placeholder="Titolo" value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn primary" disabled={busy} onClick={send}><I.Send size={16} /> Invia richiesta</button>
    </Sheet>
  );
}

const REASONS = [["no_play", "Il video non parte"], ["audio", "Audio o sottotitoli"], ["quality", "Qualità scadente"], ["wrong", "Contenuto sbagliato"], ["other", "Altro"]];

function ReportSheet({ m, onClose, say }) {
  const [reason, setReason] = useState("no_play");
  const [ep, setEp] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const eps = [...(m.seasons || [])].sort(byNum).flatMap((s) =>
    [...s.episodes].sort(byNum).map((e) => ({ id: e.id, label: `S${s.number} · E${e.number}${e.title ? " – " + e.title : ""}` })));
  const send = async () => {
    setBusy(true);
    try { await api("report", { body: { mediaId: m.id, episodeId: ep || undefined, reason, note } }); say("Segnalazione inviata, grazie"); onClose(); }
    catch (e) { say(e.data?.error === "limit" ? "Hai raggiunto il limite di segnalazioni di oggi" : "Invio non riuscito"); setBusy(false); }
  };
  return (
    <Sheet title="Segnala un problema" onClose={onClose}>
      <p className="hint">{m.title}</p>
      <div className="wrapchips">
        {REASONS.map(([k, l]) => <button key={k} className={"chip" + (reason === k ? " on" : "")} onClick={() => setReason(k)}>{l}</button>)}
      </div>
      {eps.length > 0 && (
        <select className="in" value={ep} onChange={(e) => setEp(e.target.value)}>
          <option value="">Tutta la serie</option>
          {eps.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      )}
      <textarea className="in" rows={3} maxLength={300} placeholder="Dettagli (facoltativo)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn primary" disabled={busy} onClick={send}><I.Flag size={16} /> Invia segnalazione</button>
    </Sheet>
  );
}

function Stars({ value = 0, onRate }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} className={"star" + (n <= value ? " on" : "")} aria-label={`${n} stelle`} onClick={() => onRate(n === value ? 0 : n)}>★</button>
      ))}
    </span>
  );
}

function Detail({ m, user, watch, toggle, say, rate }) {
  const seasons = [...(m.seasons || [])].sort(byNum);
  const [sid, setSid] = useState(seasons[0]?.id);
  const [rep, setRep] = useState(false);
  const season = seasons.find((s) => s.id === sid);
  const seen = (id) => user.watched.includes(id);
  const bg = art(m, "backdrop") || art(m, "poster");
  const inList = user.watchlist.includes(m.id);
  return (
    <div>
      <div className="dhero" style={bg ? { backgroundImage: `url(${bg})` } : {}}><div className="hshade" /></div>
      <div className="page dbody">
        <div className="pills">
          <span className="pill">{m.type === "movie" ? <I.Film size={13} /> : <I.Tv size={13} />} {kind(m)}</span>
          {m.year && <span className="pill">{m.year}</span>}
          {m.type === "series" && <span className="pill">{seasons.length} {seasons.length === 1 ? "stagione" : "stagioni"}</span>}
          {m.type === "series" && (() => { const all = seasons.flatMap((x) => x.episodes).filter((e) => e.hasVideo); const n = all.filter((e) => seen(e.id)).length; return all.length > 0 && n > 0 ? <span className="pill">{n}/{all.length} visti</span> : null; })()}
        </div>
        <h1 className="dtitle">{m.title}</h1>
        <div className="actions">
          {m.type === "movie" && m.hasVideo && <button className="btn primary" onClick={() => watch(m.id)}><I.Play size={18} /> Guarda</button>}
          <button className="btn round" aria-label="Lista" onClick={() => toggle("watchlist", m.id)}><I.Bookmark size={20} fill={inList ? "currentColor" : "none"} /></button>
          {m.type === "movie" && <button className="btn round" aria-label="Visto" onClick={() => toggle("watched", m.id)}>{seen(m.id) ? <I.Check size={20} /> : <I.Eye size={20} />}</button>}
        </div>
        <div className="rating">
          <span className="ravg">★ {m.rating ? m.rating.avg.toFixed(1) : "–"}<small>{m.rating ? ` (${m.rating.count} ${m.rating.count === 1 ? "voto" : "voti"})` : " nessun voto"}</small></span>
          <div className="rmine"><small>Il tuo voto</small><Stars value={user.ratings?.[m.id] || 0} onRate={(v) => rate(m.id, v)} /></div>
        </div>
        <p className="overview">{m.overview}</p>
        {m.type === "series" && (
          <>
            <div className="chips">
              {seasons.map((s) => (
                <button key={s.id} className={"chip" + (s.id === sid ? " on" : "")} onClick={() => setSid(s.id)}>{s.name || `Stagione ${s.number}`}</button>
              ))}
            </div>
            {season && [...season.episodes].sort(byNum).map((e) => (
              <div className="ep" key={e.id}>
                <div className="thumb" onClick={() => e.hasVideo && watch(m.id, e.id)}>
                  {e.cover || e.coverUrl ? <img src={imgUrl(e.cover) || e.coverUrl} alt="" loading="lazy" /> : <div className="ph"><I.Film size={22} /></div>}
                  {e.hasVideo && <span className="pl"><I.Play size={16} /></span>}
                  {seen(e.id) && <span className="seen"><I.Check size={12} /></span>}
                </div>
                <div className="ep-info">
                  <b>{e.number}. {e.title || `Episodio ${e.number}`}</b>
                  {e.overview && <p>{e.overview}</p>}
                  <button className="lnk" onClick={() => toggle("watched", e.id)}>{seen(e.id) ? "Visto" : "Segna come visto"}</button>
                </div>
              </div>
            ))}
          </>
        )}
        <button className="lnk flag" onClick={() => setRep(true)}><I.Flag size={14} /> Segnala un problema</button>
      </div>
      {rep && <ReportSheet m={m} say={say} onClose={() => setRep(false)} />}
    </div>
  );
}

// ---------- TIMELINE MARVEL (stile monitor TVA) ----------
function TimelineView({ media, timeline = [], out = [], user, go }) {
  const [mode, setMode] = useState("story");
  const rel = byRelease("asc");
  const pos = (m) => { const i = timeline.indexOf(m.id); return i < 0 ? Infinity : i; };
  const base = media.filter((m) => !out.includes(m.id));
  const items = [...base].sort(mode === "story" ? (a, b) => (pos(a) === pos(b) ? rel(a, b) : pos(a) - pos(b)) : rel);
  const pct = items.length ? Math.round((items.filter((m) => user.watched?.includes(m.id)).length / items.length) * 100) : 0;
  return (
    <div className="page tva">
      <div className="tva-scan" />
      <div className="tva-head">
        <small>T.V.A. · AUTORITÀ VARIAZIONE TEMPORALE</small>
        <h1>TIMELINE MARVEL</h1>
        <div className="tva-mode">
          <button className={mode === "story" ? "on" : ""} onClick={() => setMode("story")}>Cronologico (Storia)</button>
          <button className={mode === "release" ? "on" : ""} onClick={() => setMode("release")}>Di uscita</button>
        </div>
        <div className="tva-stat"><span>LINEA SACRA OSSERVATA</span><b>{pct}%</b></div>
      </div>
      <div className="tva-line">
        <div className="tva-spine" />
        {items.map((m, i) => {
          const seen = user.watched?.includes(m.id);
          return (
            <div key={m.id} className={"tnode " + (i % 2 ? "r" : "l")}>
              <button className="tcard" onClick={() => go({ n: "media", id: m.id })}>
                <span className="tposter" style={{ backgroundImage: `url(${art(m, "poster")})` }} />
                <span className="tinfo">
                  <small>FILE #{String(i + 1).padStart(3, "0")}{m.year ? ` · ${m.year}` : ""}</small>
                  <b>{m.title}</b>
                  <em>{seen ? "▣ OSSERVATO" : "▢ NON OSSERVATO"}</em>
                </span>
              </button>
              <span className="tdot" />
            </div>
          );
        })}
      </div>
      {!items.length && <p className="hint">Nessun titolo nella timeline.</p>}
    </div>
  );
}

// ---------- ROAD TO DOOMSDAY (stile Doctor Doom) ----------
const DOOM_OPEN_UNTIL = Date.parse("2026-12-16T23:59:59+01:00"); // la sezione sparisce dopo il 16 dicembre
const CALC_UNTIL = Date.parse("2026-12-15T23:59:59+01:00");     // il piano si calcola fino al 15 dicembre
const fmtH = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return `${h}h ${String(m).padStart(2, "0")}m`; };
const readHpd = () => { try { return Number(localStorage.getItem("doom_hpd")) || 0; } catch { return 0; } };

const DoomMask = () => (
  <svg className="dm-mask" viewBox="0 0 64 64" fill="none" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <defs>
      <linearGradient id="dmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9f5d0" /><stop offset="1" stopColor="#3fae78" /></linearGradient>
      <radialGradient id="dmglow" cx="50%" cy="42%" r="55%"><stop offset="0" stopColor="#7be0a4" stopOpacity=".35" /><stop offset="1" stopColor="#7be0a4" stopOpacity="0" /></radialGradient>
    </defs>
    <circle cx="32" cy="32" r="31" fill="url(#dmglow)" />
    {/* cappuccio */}
    <path d="M8 61l4-31C13.5 13 21 4 32 3c11 1 18.500 10 20 27l4 31" stroke="url(#dmg)" strokeWidth="2.2" />
    <path d="M14 33C16 19 22 12 32 11c10 1 16 8 18 22" stroke="url(#dmg)" strokeWidth="1.2" opacity=".55" />
    {/* maschera */}
    <path d="M19.500 22.500L32 17l12.500 5.500-1.200 17.500c-.4 5-3.400 9.200-11.300 15.500C24.100 49.200 21.100 45 20.700 40z" fill="#0c1511" stroke="url(#dmg)" strokeWidth="2" />
    {/* arcata del sopracciglio */}
    <path d="M21.500 27l9 2.200M42.500 27l-9 2.200" stroke="url(#dmg)" strokeWidth="1.800" />
    {/* occhi */}
    <path d="M22.500 31.200l7.500 1.600-.7 3.400-6.800-1.500z" fill="#7be0a4" />
    <path d="M41.500 31.200L34 32.800l.7 3.400 6.800-1.500z" fill="#7be0a4" />
    {/* naso */}
    <path d="M32 33l-2.200 9h4.400z" stroke="url(#dmg)" strokeWidth="1.400" />
    {/* bocca a griglia */}
    <path d="M27.500 47.500h9M28.500 50.500h7M29.800 53.200h4.400" stroke="url(#dmg)" strokeWidth="1.500" />
    {/* rivetti */}
    <circle cx="22.800" cy="38.500" r="1" fill="#7be0a4" /><circle cx="41.200" cy="38.500" r="1" fill="#7be0a4" />
  </svg>
);

function DoomView({ media, doom = {}, user, go, watch }) {
  const [now, setNow] = useState(Date.now());
  const [hpd, setHpd] = useState(readHpd());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const rel = new Date(`${doom.date || "2026-12-16"}T00:00:00+01:00`).getTime();
  const left = Math.max(0, rel - now);
  const d = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000), mi = Math.floor((left % 3600000) / 60000), sc = Math.floor((left % 60000) / 1000);

  const picks = (doom.ids || []).map((id) => media.find((m) => m.id === id)).filter(Boolean).map((m) => {
    const total = doom.minutes?.[m.id] || 0;
    let rem = total;
    if (user.watched?.includes(m.id)) rem = 0;
    else if (m.type === "series") {
      const eps = (m.seasons || []).flatMap((x) => x.episodes).filter((e) => e.hasVideo);
      if (eps.length) rem = Math.round(total * (eps.filter((e) => !user.watched?.includes(e.id)).length / eps.length));
    }
    return { m, total, rem, done: rem === 0 && user.watched?.includes(m.id) };
  });
  const remaining = picks.reduce((t, x) => t + x.rem, 0);
  const next = picks.find((x) => !x.done && x.rem > 0) || picks.find((x) => !x.done);
  const daysLeft = Math.max(1, Math.ceil((CALC_UNTIL - now) / 86400000));
  const need = remaining / 60 / daysLeft;               // ore al giorno necessarie
  const rec = Math.max(0.5, Math.ceil(need * 2) / 2);   // consigliato, a passi di mezz'ora
  const perDay = (hpd || rec) * 60;

  // piano: riempie ogni giorno fino al limite di ore, in ordine, fino al 15 dicembre
  const plan = [];
  let queue = picks.filter((x) => x.rem > 0).map((x) => ({ title: x.m.title, left: x.rem, id: x.m.id }));
  for (let i = 0; i < daysLeft && queue.length; i++) {
    let budget = perDay; const day = [];
    while (budget > 0 && queue.length) {
      const q = queue[0], take = Math.min(budget, q.left);
      day.push({ title: q.title, id: q.id, min: take, part: take < q.left || q.left < (picks.find((x) => x.m.id === q.id)?.total || 0) });
      q.left -= take; budget -= take;
      if (q.left <= 0) queue.shift();
    }
    plan.push({ date: new Date(now + i * 86400000), items: day });
  }
  const fits = queue.length === 0;
  const setH = (v) => { const n = Math.min(12, Math.max(0.5, v)); setHpd(n); try { localStorage.setItem("doom_hpd", String(n)); } catch {} };

  const totalAll = picks.reduce((t, x) => t + x.total, 0);
  const pct = totalAll ? Math.round(((totalAll - remaining) / totalAll) * 100) : 0;
  const doneCount = picks.filter((x) => x.done).length;
  const hh = (v) => v.toString().replace(".", ",");
  const relLabel = new Date(rel).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="page dm">
      <div className="dm-title">
        <DoomMask />
        <div><small>Avengers: Doomsday</small><h1>Road to Doomsday</h1></div>
      </div>

      <section className="dm-card dm-count">
        <small>Uscita il {relLabel}</small>
        <div className="dm-cd">
          {[["giorni", d], ["ore", h], ["min", mi], ["sec", sc]].map(([l, v]) => <div key={l}><b>{String(v).padStart(2, "0")}</b><span>{l}</span></div>)}
        </div>
      </section>

      <section className="dm-card">
        <div className="dm-row"><small>Ancora da vedere</small><b className="dm-big">{fmtH(remaining)}</b></div>
        <div className="dm-bar"><i style={{ width: pct + "%" }} /></div>
        <div className="dm-row dm-sub"><span>{doneCount} di {picks.length} progetti completati</span><span>{pct}%</span></div>
      </section>

      {next && (
        <section className="dm-card dm-next">
          <span className="dm-poster" style={{ backgroundImage: `url(${art(next.m, "poster")})` }} />
          <div className="dm-nextinfo">
            <small>Prossimo da vedere</small>
            <b>{next.m.title}</b>
            <span>{next.total ? fmtH(next.rem || next.total) : "durata mancante"}</span>
            <button className="dm-btn" onClick={() => (next.m.type === "movie" ? watch(next.m.id) : go({ n: "media", id: next.m.id }))}>{next.m.type === "movie" ? "Guarda ora" : "Apri"}</button>
          </div>
        </section>
      )}

      {!picks.length ? <p className="hint">Nessun progetto scelto per la Road to Doomsday.</p> : (
        <>
          <h2 className="dm-h">Da vedere</h2>
          <div className="dm-list">
            {picks.map(({ m, total, rem, done }, i) => (
              <button key={m.id} className={"dm-item" + (done ? " done" : "")} onClick={() => go({ n: "media", id: m.id })}>
                <span className="dm-n">{i + 1}</span>
                <span className="dm-th" style={{ backgroundImage: `url(${art(m, "poster")})` }} />
                <span className="dm-in"><b>{m.title}</b><small>{total ? `${fmtH(total)}${rem !== total && rem > 0 ? ` · restano ${fmtH(rem)}` : ""}` : "durata mancante"}</small></span>
                <span className={"dm-tag" + (done ? " ok" : "")}>{done ? "Visto" : "Da vedere"}</span>
              </button>
            ))}
          </div>

          <h2 className="dm-h">Calendario fino al 15 dicembre</h2>
          <section className="dm-card dm-ctl">
            <div className="dm-row"><span>Ore al giorno</span>
              <div className="dm-step"><button onClick={() => setH((hpd || rec) - 0.5)}>−</button><b>{hh(hpd || rec)} h</b><button onClick={() => setH((hpd || rec) + 0.5)}>+</button></div>
            </div>
            <button className="dm-link" onClick={() => setH(rec)}>Usa il consigliato: {hh(rec)} h al giorno</button>
          </section>
          {remaining === 0 ? <p className="dm-note">Hai già visto tutto: sei in pari per l'uscita.</p>
            : !fits ? <p className="dm-note warn">Con {hh(hpd || rec)} h al giorno non finisci entro il 15 dicembre: servono almeno {need.toFixed(1).replace(".", ",")} h al giorno.</p>
            : <p className="dm-note">Finisci il {plan[plan.length - 1].date.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}, prima dell'uscita.</p>}
          <div className="dm-plan">
            {plan.map((p, i) => (
              <div key={i} className="dm-day">
                <div className="dm-date"><b>{p.date.toLocaleDateString("it-IT", { day: "numeric" })}</b><small>{p.date.toLocaleDateString("it-IT", { weekday: "short", month: "short" })}</small></div>
                <div className="dm-todo">{p.items.map((it, j) => <div key={j}><span>{it.title}{it.part ? " (parte)" : ""}</span><em>{fmtH(it.min)}</em></div>)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Continua a guardare ----------
function Continue({ recent = [], media, watch, go, watched = [] }) {
  const rows = recent.map((r) => {
    const m = media.find((x) => x.id === r.mediaId);
    if (!m) return null;
    if (m.type !== "series") return m.hasVideo ? { m, key: m.id } : null;
    const eps = [...(m.seasons || [])].sort((a, b) => a.number - b.number).flatMap((x) => [...x.episodes].sort((a, b) => a.number - b.number).map((e) => ({ ...e, sn: x.number })));
    const i = eps.findIndex((e) => e.id === r.episodeId);
    if (i < 0) return null;
    const after = eps.slice(i + 1).filter((e) => e.hasVideo);
    if (!after.length) return null; // arrivato all'ultimo episodio disponibile: sparisce da "Continua a guardare"
    const next = after.find((e) => !watched.includes(e.id)) || after[0];
    return { m, ep: eps[i], next, key: m.id };
  }).filter(Boolean).slice(0, 8);
  if (!rows.length) return null;
  return (
    <section className="blk">
      <div className="sec"><h2>Continua a guardare</h2></div>
      <div className="rail cont">
        {rows.map(({ m, ep, next, key }) => (
          <div key={key} className="ccard">
            <div className="cimg" style={{ backgroundImage: `url(${(ep && (ep.cover ? imgUrl(ep.cover) : ep.coverUrl)) || art(m, "backdrop") || art(m, "poster")})` }} onClick={() => go({ n: "media", id: m.id })} />
            <b className="ct">{m.title}</b>
            <small>{ep ? `S${ep.sn} · E${ep.number}${ep.title ? " · " + ep.title : ""}` : "Film"}</small>
            <div className="actions">
              <button className="btn primary small" onClick={() => watch(m.id, ep?.id)}><I.Play size={14} /> Riprendi</button>
              {next && <button className="btn small" onClick={() => watch(m.id, next.id)}>Prossimo E{next.number}</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Ricerca "che capisce tutto": ignora accenti/punteggiatura, tollera errori di battitura, capisce "loki ep 3" / "s1e2" ----------
const nz = (t = "") => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const STOP = new Set(["film", "serie", "serietv", "episodio", "ep", "puntata", "stagione", "di", "il", "la", "lo", "e", "the", "a"]);
function parseQ(q) {
  const t = String(q).toLowerCase();
  let m = t.match(/\bs(\d{1,2})\s*e(\d{1,3})\b/) || t.match(/\b(\d{1,2})x(\d{1,3})\b/);
  let season = null, ep = null, rest = t;
  if (m) { season = +m[1]; ep = +m[2]; rest = t.replace(m[0], " "); }
  else {
    const e = t.match(/\b(?:episodio|ep|puntata|e)\.?\s*(\d{1,3})\b/), s = t.match(/\b(?:stagione|s)\s*(\d{1,2})\b/);
    if (e) { ep = +e[1]; rest = rest.replace(e[0], " "); }
    if (s) { season = +s[1]; rest = rest.replace(s[0], " "); }
  }
  return { tokens: nz(rest).split(" ").filter((w) => w && !STOP.has(w)), season, ep };
}
function tokScore(tok, words) {
  let best = 0;
  for (const w of words) {
    if (w === tok) best = Math.max(best, 3);
    else if (tok.length >= 2 && w.startsWith(tok)) best = Math.max(best, 2.5);
    else if (tok.length >= 3 && w.includes(tok)) best = Math.max(best, 1.5);
    else if (tok.length >= 4 && Math.abs(w.length - tok.length) <= 2 && lev(tok, w) <= (tok.length >= 7 ? 2 : 1)) best = Math.max(best, 1.2);
  }
  return best;
}
function smartSearch(media, q) {
  const { tokens, season, ep } = parseQ(q);
  if (!tokens.length && ep == null) return { items: media, ep: null };
  const scored = media.map((m) => {
    const tw = nz(m.title + " " + (m.year || "")).split(" "); tw.push(nz(m.title).replace(/ /g, "")); // "ironman" = "iron man"
    const ow = nz(m.overview || "").split(" ");
    const ew = (m.seasons || []).flatMap((x) => x.episodes.map((e) => nz(e.title)).join(" ").split(" "));
    let total = 0;
    for (const tk of tokens) {
      const sc = Math.max(tokScore(tk, tw), tokScore(tk, ew) * 0.7, tokScore(tk, ow) * 0.35);
      if (!sc) return { m, s: 0 };
      total += sc;
    }
    return { m, s: total };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const items = scored.map((x) => x.m);
  let hit = null;
  if (ep != null && items[0]?.type === "series") {
    const m = items[0], sn = season != null ? m.seasons.find((x) => x.number === season) : m.seasons.length === 1 ? m.seasons[0] : null;
    const e = sn?.episodes.find((x) => x.number === ep);
    if (e) hit = { m, e, sn: sn.number };
  }
  return { items, ep: hit };
}

function Search({ media, go, user, say, watch }) {
  const [q, setQ] = useState("");
  const [req, setReq] = useState(false);
  const [f, setF] = useState("all");
  const res = smartSearch(media, q);
  const items = res.items.filter((m) => f === "all" || m.type === f);
  return (
    <div className="page">
      <div className="searchbox"><I.Search size={18} /><input autoFocus placeholder="Cerca un titolo, un episodio…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {res.ep && (
        <div className="reqcard">
          <div><b>{res.ep.m.title}</b><small>S{res.ep.sn} · E{res.ep.e.number}{res.ep.e.title ? " · " + res.ep.e.title : ""}</small></div>
          <button className="btn red small" onClick={() => watch(res.ep.m.id, res.ep.e.id)}><I.Play size={14} /> Guarda</button>
        </div>
      )}
      <div className="chips">
        {[["all", "Tutti"], ["movie", "Film"], ["series", "Serie TV"]].map(([k, l]) => (
          <button key={k} className={"chip" + (f === k ? " on" : "")} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      <Grid items={items} go={go} user={user} />
      <div className="reqcard">
        <div><b>Non trovi un titolo?</b><small>Richiedilo qui.</small></div>
        <button className="btn red small" onClick={() => setReq(true)}><I.Send size={14} /> Richiedi</button>
      </div>
      {req && <RequestSheet initial={q} say={say} onClose={() => setReq(false)} />}
    </div>
  );
}

export default function App() {
  const [boot, setBoot] = useState({ loading: true });
  const [stack, setStack] = useState([location.search.includes("admin=1") ? { n: "admin" } : { n: "home" }]);
  const [toast, setToast] = useState("");
  const [splash, setSplash] = useState(true);
  const view = stack[stack.length - 1];
  const go = (v) => setStack((s) => [...s, v]);
  const tab = (v) => setStack([v]);
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const say = (t) => { setToast(t); setTimeout(() => setToast(""), 2500); };

  const load = async () => {
    try {
      const me = await api("me");
      if (!me.subscribed) return setBoot({ me, gate: true });
      const cat = await api("catalog");
      setBoot({ me, ...cat });
    } catch (e) {
      if (e.data?.error === "not_subscribed") api("me").then((me) => setBoot({ me, gate: true })).catch(() => {});
      else setBoot({ error: e.message });
    }
  };

  useEffect(() => {
    tg?.ready(); tg?.expand();
    tg?.setHeaderColor?.("#000000"); tg?.setBackgroundColor?.("#000000");
    load();
    setTimeout(() => setSplash(false), 1800);
  }, []);

  useEffect(() => {
    if (!tg?.BackButton) return;
    stack.length > 1 ? tg.BackButton.show() : tg.BackButton.hide();
    tg.BackButton.onClick(back);
    return () => tg.BackButton.offClick(back);
  }, [stack.length]);

  const { media = [], categories = [], timeline = [], timelineOut = [], doomsday, features = {}, user = { watchlist: [], watched: [] }, me } = boot;

  const watch = async (mediaId, episodeId) => {
    try {
      await api("watch", { body: { mediaId, episodeId } });
      tg?.HapticFeedback?.notificationOccurred("success");
      say("Video inviato nella chat");
      setTimeout(() => tg?.close(), 1200);
    } catch (e) {
      const err = e.data?.error;
      if (err === "not_subscribed") { say("Iscriviti al canale per continuare"); load(); }
      else if (err === "start_required") {
        say("Premi START sul bot per ricevere i video");
        setTimeout(() => tg?.openTelegramLink?.(`https://t.me/${me?.botUsername}`), 1400);
      } else say(err === "rate" ? "Vai piano! Riprova tra poco" : "Errore nell'invio del video");
    }
  };
  const rate = async (mediaId, value) => {
    try {
      const r = await api("rate", { body: { mediaId, value } });
      setBoot((b) => ({ ...b, user: r.user, media: b.media.map((x) => (x.id === mediaId ? { ...x, rating: r.rating } : x)) }));
      tg?.HapticFeedback?.impactOccurred("light");
    } catch { say("Voto non riuscito"); }
  };
  const toggle = async (k, id) => {
    const u = await api("toggle", { body: { kind: k, id } });
    setBoot((b) => ({ ...b, user: u }));
    tg?.HapticFeedback?.impactOccurred("light");
  };

  const cats = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
  const inCat = (id) => { const ids = descIds(categories, id); return media.filter((m) => m.categoryIds?.some((c) => ids.includes(c))); };
  const recent = [...media].sort(byRelease("desc"));
  const find = (id) => media.find((m) => m.id === id);

  let body = null;
  if (boot.error)
    body = (
      <div className="center">
        <img className="biglogo" src={logo} alt="" />
        <p>{boot.error === "unauthorized" ? "Apri questa app da Telegram." : "Errore: " + boot.error}</p>
      </div>
    );
  else if (boot.gate) {
    const ch = boot.me?.channel || "";
    const link = `https://t.me/${ch.replace("@", "")}`;
    body = (
      <div className="center">
        <img className="biglogo" src={logo} alt="" />
        <h1 className="ptitle">Iscriviti per continuare</h1>
        <p>Per usare Marvel Italia Streaming devi essere iscritto a {ch}.</p>
        <button className="btn primary" onClick={() => (tg?.openTelegramLink ? tg.openTelegramLink(link) : window.open(link))}>Iscriviti al canale</button>
        <button className="btn" onClick={load}>Ho già fatto, controlla</button>
      </div>
    );
  } else if (!boot.loading) {
    if (view.n === "home") {
      const hero = media.find((m) => m.featured) || recent[0];
      const roots = cats.filter((c) => !c.parentId);
      body = (
        <div>
          {hero && (
            <div className="hero" style={{ backgroundImage: `url(${art(hero, "backdrop") || art(hero, "poster")})` }} onClick={() => go({ n: "media", id: hero.id })}>
              <div className="hshade" />
              <div className="hin">
                <div className="pills">
                  <span className="pill acc">In evidenza</span>
                  <span className="pill">{hero.type === "movie" ? <I.Film size={13} /> : <I.Tv size={13} />} {kind(hero)}</span>
                  {hero.year && <span className="pill">{hero.year}</span>}
                </div>
                <h1>{hero.title}</h1>
                <p className="clamp">{hero.overview}</p>
                <div className="actions">
                  <button className="btn primary" onClick={(e) => { e.stopPropagation(); hero.type === "movie" ? watch(hero.id) : go({ n: "media", id: hero.id }); }}><I.Play size={18} /> Guarda</button>
                  <button className="btn round" aria-label="Dettagli"><I.Info size={20} /></button>
                  <button className="btn round" aria-label="Lista" onClick={(e) => { e.stopPropagation(); toggle("watchlist", hero.id); }}><I.Bookmark size={20} fill={user.watchlist.includes(hero.id) ? "currentColor" : "none"} /></button>
                </div>
              </div>
            </div>
          )}
          <div className="page">
            <Continue recent={user.recent} watched={user.watched} media={media} watch={watch} go={go} />
            {roots.length > 0 && (
              <section className="blk">
                <div className="sec"><h2>Categorie</h2></div>
                <CatTiles cats={roots} count={(id) => inCat(id).length} go={go} />
              </section>
            )}
            <Rail title="Ultime uscite" items={recent.slice(0, 12)} go={go} user={user} />
            <Rail title="Film" items={recent.filter((m) => m.type === "movie")} go={go} user={user} />
            <Rail title="Serie TV" items={recent.filter((m) => m.type === "series")} go={go} user={user} />
            <Rail title="La mia lista" items={media.filter((m) => user.watchlist.includes(m.id))} go={go} user={user} />
          </div>
        </div>
      );
    } else if (view.n === "media" && find(view.id)) body = <Detail m={find(view.id)} user={user} watch={watch} toggle={toggle} say={say} rate={rate} />;
    else if (view.n === "coll") body = <div className="page"><h1 className="ptitle">{view.title}</h1><Grid items={media.filter((m) => view.ids.includes(m.id)).sort(byRelease("asc"))} go={go} user={user} /></div>;
    else if (view.n === "cat") {
      const c = categories.find((x) => x.id === view.id);
      const subs = cats.filter((k) => k.parentId === view.id);
      const direct = media.filter((m) => m.categoryIds?.includes(view.id)).sort(catSort(c));
      body = c && (
        <div className="page">
          <button className="btn small" style={{ marginBottom: 12 }} onClick={back}><I.Chevron size={16} style={{ transform: "rotate(180deg)" }} /> Indietro</button>
          <div><h1 className="ptitle">{c.emoji} {c.name}</h1></div>
          {subs.length > 0 && <CatTiles cats={subs} count={(id) => inCat(id).length} go={go} />}
          {direct.length > 0 && (
            <>
              {subs.length > 0 && <div className="sec gap"><h2>Titoli</h2></div>}
              <Grid items={direct} go={go} user={user} />
            </>
          )}
        </div>
      );
    } else if (view.n === "search") body = <Search media={media} go={go} user={user} say={say} watch={watch} />;
    else if (view.n === "timeline" && features.timeline) body = <TimelineView media={media} timeline={timeline} out={timelineOut} user={user} go={go} />;
    else if (view.n === "doom" && features.doom && Date.now() <= DOOM_OPEN_UNTIL) body = <DoomView media={media} doom={doomsday} user={user} go={go} watch={watch} />;
    else if (view.n === "list") body = <div className="page"><h1 className="ptitle">La mia lista</h1><Grid items={media.filter((m) => user.watchlist.includes(m.id))} go={go} user={user} /></div>;
    else if (view.n === "admin" && me?.isAdmin) body = <Admin say={say} onChange={load} />;
  }

  const items = [["home", I.Home, "Home"], ["search", I.Search, "Cerca"], ...(features.timeline ? [["timeline", I.Clock, "Timeline"]] : []), ...(features.doom && Date.now() <= DOOM_OPEN_UNTIL ? [["doom", I.Mask, "Doomsday"]] : []), ["list", I.Bookmark, "Lista"], ...(me?.isAdmin ? [["admin", I.Shield, "Admin"]] : [])];
  return (
    <>
      {splash && <div className="splash"><img src={logo} alt="" /><div className="tri" /></div>}
      {!boot.error && !boot.gate && <Header onSearch={() => tab({ n: "search" })} />}
      {body}
      {!boot.error && !boot.gate && (
        <nav className="nav">
          {items.map(([n, Ic, l]) => (
            <button key={n} className={view.n === n ? "on" : ""} onClick={() => tab({ n })}><span><Ic size={21} /></span><small>{l}</small></button>
          ))}
        </nav>
      )}
      {toast && <div className="toast"><I.Check size={16} /> {toast}</div>}
    </>
  );
}
