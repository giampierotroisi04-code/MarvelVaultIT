import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, imgUrl, art } from "./api.js";
import { descIds, byRelease } from "./lib/util.js";
import { I } from "./Icons.jsx";
import Admin from "./Admin.jsx";
import { StatsView, WrapView } from "./Stats.jsx";
import logo from "./logo.jpg";

const tg = window.Telegram?.WebApp;
const catSort = (c) => { const o = c?.mediaOrder || []; const rel = byRelease("asc"); return (a, b) => { const x = o.indexOf(a.id), y = o.indexOf(b.id); return x >= 0 && y >= 0 ? x - y : x >= 0 ? -1 : y >= 0 ? 1 : rel(a, b); }; };
const byNum = (a, b) => (a.number || 0) - (b.number || 0);
const kind = (m) => (m.type === "movie" ? "Film" : "Serie TV");

// Testo lungo: accorciato, con "Leggi tutto" / "Riduci"
function Clamp({ text, lines = 3, className = "" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const check = () => { const el = ref.current; if (el && !open) setOver(el.scrollHeight > el.clientHeight + 1); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, open, lines]);
  if (!text) return null;
  return (
    <div className="xwrap">
      <p ref={ref} className={"xp " + className + (open ? " open" : "")} style={{ "--l": lines }}>{text}</p>
      {(over || open) && <button className="lnk more" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? "Riduci" : "Leggi tutto"}</button>}
    </div>
  );
}

// Attribuzione TMDB (richiesta dai ToS)
const TMDB_URL = "https://www.themoviedb.org";
const openTmdb = (e) => {
  e.preventDefault(); e.stopPropagation();
  tg?.openLink ? tg.openLink(TMDB_URL) : window.open(TMDB_URL, "_blank", "noopener");
};
const TmdbCredit = () => (
  <p className="tmdb">Dati forniti da <a href={TMDB_URL} target="_blank" rel="noopener noreferrer" onClick={openTmdb}>TMDB</a></p>
);

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

function ReportSheet({ m: fixed, media = [], onClose, say }) {
  const [mid, setMid] = useState("");
  const m = fixed || media.find((x) => x.id === mid);
  const [reason, setReason] = useState("no_play");
  const [ep, setEp] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const eps = [...(m?.seasons || [])].sort(byNum).flatMap((s) =>
    [...s.episodes].sort(byNum).map((e) => ({ id: e.id, label: `S${s.number} · E${e.number}${e.title ? " – " + e.title : ""}` })));
  const send = async () => {
    if (!m) return say("Scegli prima il titolo");
    setBusy(true);
    try { await api("report", { body: { mediaId: m.id, episodeId: ep || undefined, reason, note } }); say("Segnalazione inviata, grazie"); onClose(); }
    catch (e) { say(e.data?.error === "limit" ? "Hai raggiunto il limite di segnalazioni di oggi" : "Invio non riuscito"); setBusy(false); }
  };
  return (
    <Sheet title="Segnala un problema" onClose={onClose}>
      {fixed
        ? <p className="hint">{fixed.title}</p>
        : (
          <select className="in" value={mid} onChange={(e) => { setMid(e.target.value); setEp(""); }}>
            <option value="">Scegli il film o la serie…</option>
            {[...media].sort((a, b) => a.title.localeCompare(b.title)).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        )}
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

function Detail({ m, user, me, watch, toggle, say, rate, initSeason }) {
  const seasons = [...(m.seasons || [])].sort(byNum);
  const [sid, setSid] = useState(seasons.some((x) => x.id === initSeason) ? initSeason : seasons[0]?.id);
  const [rep, setRep] = useState(false);
  const season = seasons.find((s) => s.id === sid);
  const seen = (id) => user.watched.includes(id);
  const [shown, setShown] = useState({}); // episodi con spoiler sbloccati a mano
  const spoil = (e) => !!user.settings?.antispoiler && m.type === "series" && !seen(e.id) && !shown[e.id];
  const share = () => {
    const link = me?.botUsername ? `https://t.me/${me.botUsername}${me.appName ? "/" + me.appName : ""}?startapp=t_${m.id}` : "";
    if (!link) return say("Link non disponibile");
    const u = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Guarda ${m.title} su Marvel Italia Streaming`)}`;
    tg?.openTelegramLink ? tg.openTelegramLink(u) : window.open(u, "_blank");
  };
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
          <button className="btn round" aria-label="Condividi" onClick={share}><I.Share size={20} /></button>
          {m.type === "movie" && <button className="btn round" aria-label="Visto" onClick={() => toggle("watched", m.id)}>{seen(m.id) ? <I.Check size={20} /> : <I.Eye size={20} />}</button>}
        </div>
        <div className="rating">
          <span className="ravg">★ {m.rating ? m.rating.avg.toFixed(1) : "–"}<small>{m.rating ? ` (${m.rating.count} ${m.rating.count === 1 ? "voto" : "voti"})` : " nessun voto"}</small></span>
          <div className="rmine"><small>Il tuo voto</small><Stars value={user.ratings?.[m.id] || 0} onRate={(v) => rate(m.id, v)} /></div>
        </div>
        <Clamp text={m.overview} lines={4} className="overview" />
        <TmdbCredit />
        {m.type === "series" && (
          <>
            <div className="chips">
              {seasons.map((s) => (
                <button key={s.id} className={"chip" + (s.id === sid ? " on" : "")} onClick={() => setSid(s.id)}>{s.name || `Stagione ${s.number}`}</button>
              ))}
            </div>
            {season && [...season.episodes].sort(byNum).map((e) => (
              <div className="ep" key={e.id}>
                <div className={"thumb" + (spoil(e) ? " spoil" : "")} onClick={() => e.hasVideo && watch(m.id, e.id)}>
                  {e.cover || e.coverUrl ? <img src={imgUrl(e.cover) || e.coverUrl} alt="" loading="lazy" /> : <div className="ph"><I.Film size={22} /></div>}
                  {e.hasVideo && <span className="pl"><I.Play size={16} /></span>}
                  {seen(e.id) && <span className="seen"><I.Check size={12} /></span>}
                </div>
                <div className="ep-info">
                  <b>{e.number}. {e.title || `Episodio ${e.number}`}</b>
                  {spoil(e)
                    ? <button className="spoil-btn" onClick={() => setShown((x) => ({ ...x, [e.id]: true }))}><I.Eye size={14} /> Spoiler nascosto · tocca per mostrare</button>
                    : e.overview && <Clamp text={e.overview} lines={2} />}
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

// ---------- PROFILO ----------
function ProfilePage({ media, user, me, features = {}, go, say, setSetting }) {
  const [wrap, setWrap] = useState(false);
  const [rep, setRep] = useState(false);
  const [req, setReq] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const [tab, setTabRaw] = useState(() => { try { return sessionStorage.getItem("prof_tab") || "list"; } catch { return "list"; } });
  const setTab = (t) => { setTabRaw(t); try { sessionStorage.setItem("prof_tab", t); } catch {} };
  const tu = tg?.initDataUnsafe?.user || {};
  const username = tu.username || "";
  const full = [tu.first_name || me?.user?.name, tu.last_name].filter(Boolean).join(" ");
  const name = username ? "@" + username : full || "Utente";
  const [pic, setPic] = useState("");
  useEffect(() => { api("avatar").then((r) => setPic(r.photo || "")).catch(() => {}); }, []);
  const photo = !imgErr ? pic || tu.photo_url || "" : "";
  const list = media.filter((m) => user.watchlist.includes(m.id));
  const seenN = media.filter((m) => user.watched.includes(m.id)).length;
  const tabs = [["list", I.Bookmark, "Lista"], ["stats", I.Chart, "Statistiche"], ["settings", I.Sliders, "Impostazioni"], ["help", I.Flag, "Assistenza"]];
  const idx = Math.max(0, tabs.findIndex((t) => t[0] === tab));
  const anti = !!user.settings?.antispoiler;
  return (
    <div className="page prof">
      <div className="prof-card">
        {photo
          ? <img className="avatar" src={photo} alt="" onError={() => setImgErr(true)} />
          : <span className="avatar ph">{name.replace("@", "").charAt(0).toUpperCase()}</span>}
        <div className="prof-id">
          <h1 className="ptitle">{name}</h1>
          <div className="prof-nums"><span><b>{list.length}</b> in lista</span><span><b>{seenN}</b> visti</span></div>
        </div>
      </div>

      <div className="seg" role="tablist" style={{ "--n": tabs.length }}>
        <span className="seg-ind" style={{ transform: `translateX(${idx * 100}%)` }} />
        {tabs.map(([k, Ic, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); tg?.HapticFeedback?.selectionChanged?.(); }}>
            <Ic size={16} /> <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="prof-pane" key={tab}>
        {tab === "list" && (list.length
          ? <Grid items={list} go={go} user={user} />
          : <div className="prof-empty"><I.Bookmark size={28} /><b>La tua lista è vuota</b><p>Salva film e serie con il segnalibro per ritrovarli qui.</p></div>)}

        {tab === "stats" && <StatsView media={media} user={user} wrapOn={!!features.wrap} openWrap={() => setWrap(true)} />}

        {tab === "settings" && (
          <div className="prof-help">
            <button className="set-row" role="switch" aria-checked={anti} onClick={() => { setSetting("antispoiler", !anti); tg?.HapticFeedback?.selectionChanged?.(); }}>
              <span className="help-tx"><b>Modalità anti-spoiler</b><small>Nelle serie nasconde le descrizioni degli episodi che non hai ancora visto. Le copertine restano sfocate finché non le sblocchi.</small></span>
              <span className={"sw" + (anti ? " on" : "")}><i /></span>
            </button>
          </div>
        )}

        {tab === "help" && (
          <div className="prof-help">
            <button className="help-card" onClick={() => setRep(true)}>
              <span className="help-ic"><I.Flag size={20} /></span>
              <span className="help-tx"><b>Segnala un problema</b><small>Video che non parte, episodio sbagliato, descrizione errata…</small></span>
              <span className="help-go">›</span>
            </button>
            <button className="help-card" onClick={() => setReq(true)}>
              <span className="help-ic"><I.Send size={20} /></span>
              <span className="help-tx"><b>Richiedi un progetto</b><small>Manca un film o una serie? Chiedilo qui.</small></span>
              <span className="help-go">›</span>
            </button>
          </div>
        )}
      </div>

      <TmdbCredit />
      {wrap && features.wrap && <WrapView media={media} user={user} me={me} onClose={() => setWrap(false)} />}
      {rep && <ReportSheet media={media} say={say} onClose={() => setRep(false)} />}
      {req && <RequestSheet say={say} onClose={() => setReq(false)} />}
    </div>
  );
}

// ---------- TIMELINE MARVEL (stile monitor TVA) ----------
function TimelineView({ media, timeline = [], out = [], user, go }) {
  const [mode, setMode] = useState("story");
  const rel = byRelease("asc");
  const byId = Object.fromEntries(media.map((m) => [m.id, m]));
  // voci: ogni titolo intero + le singole stagioni inserite a mano ("mediaId~seasonId")
  const all = [
    ...media.map((m) => ({ key: m.id, m, s: null })),
    ...timeline.filter((k) => k.includes("~")).map((k) => {
      const [mid, sid] = k.split("~"), m = byId[mid], s = m?.seasons?.find((x) => x.id === sid);
      return m && s ? { key: k, m, s } : null;
    }).filter(Boolean),
  ];
  const pos = (e) => { const i = timeline.indexOf(e.key); return i < 0 ? Infinity : i; };
  const byRel = (a, b) => rel(a.m, b.m) || (a.s?.number || 0) - (b.s?.number || 0);
  const items = all.filter((e) => !out.includes(e.key)).sort(mode === "story" ? (a, b) => (pos(a) === pos(b) ? byRel(a, b) : pos(a) - pos(b)) : byRel);
  const isSeen = ({ m, s }) => {
    if (user.watched?.includes(m.id)) return true;
    if (!s) return false;
    const eps = (s.episodes || []).filter((e) => e.hasVideo);
    return eps.length > 0 && eps.every((e) => user.watched?.includes(e.id));
  };
  const pct = items.length ? Math.round((items.filter(isSeen).length / items.length) * 100) : 0;
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
        {items.map((e, i) => {
          const { m, s } = e, seen = isSeen(e);
          const poster = (s && (s.cover ? imgUrl(s.cover) : s.coverUrl)) || art(m, "poster");
          return (
            <div key={e.key} className={"tnode " + (i % 2 ? "r" : "l")}>
              <button className="tcard" onClick={() => go({ n: "media", id: m.id, season: s?.id })}>
                <span className="tposter" style={{ backgroundImage: `url(${poster})` }} />
                <span className="tinfo">
                  <small>FILE #{String(i + 1).padStart(3, "0")}{m.year ? ` · ${m.year}` : ""}</small>
                  <b>{m.title}{s ? ` · ${s.name || `Stagione ${s.number}`}` : ""}</b>
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
  <svg className="dm-mask" viewBox="112 24 328 486" fill="none" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <defs>
      <linearGradient id="dmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1f6f3" /><stop offset="1" stopColor="#8fa59a" /></linearGradient>
      <radialGradient id="dmglow" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#1fe06a" stopOpacity=".22" /><stop offset="1" stopColor="#1fe06a" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="276" cy="268" rx="170" ry="250" fill="url(#dmglow)" />
    {/* sagoma del viso (misurata sulla foto di riferimento) */}
    <path d="M257.7 29.0 L236.2 35.0 L217.4 41.0 L200.9 47.0 L187.3 53.0 L178.4 59.0 L169.4 65.0 L163.2 71.0 L159.6 77.0 L156.1 83.0 L153.0 89.0 L149.0 95.0 L145.8 101.0 L142.1 107.0 L138.8 113.0 L136.4 119.0 L133.8 125.0 L132.2 131.0 L131.1 137.0 L129.4 143.0 L127.9 149.0 L127.2 155.0 L125.6 161.0 L124.5 167.0 L123.9 173.0 L122.7 179.0 L121.7 185.0 L121.0 191.0 L120.1 197.0 L119.1 203.0 L118.4 209.0 L117.9 215.0 L117.1 221.0 L117.1 227.0 L116.5 233.0 L116.2 239.0 L116.2 245.0 L115.6 251.0 L115.3 257.0 L115.6 263.0 L115.1 269.0 L115.2 275.0 L115.7 281.0 L115.9 287.0 L116.6 293.0 L118.2 299.0 L122.0 305.0 L125.6 311.0 L128.4 317.0 L130.1 323.0 L131.7 329.0 L133.3 335.0 L134.9 341.0 L136.3 347.0 L137.7 353.0 L139.1 359.0 L140.5 365.0 L142.0 371.0 L143.5 377.0 L145.0 383.0 L146.5 389.0 L147.6 395.0 L148.6 401.0 L149.6 407.0 L150.6 413.0 L151.7 419.0 L153.2 425.0 L155.1 431.0 L157.8 437.0 L161.1 443.0 L165.4 449.0 L171.0 455.0 L178.0 461.0 L185.5 467.0 L200.5 480.0 L210.5 490.0 L218.5 500.0 L222.5 506.0 L328.5 506.0 L332.5 500.0 L340.5 490.0 L350.5 480.0 L365.5 467.0 L373.0 461.0 L380.0 455.0 L385.6 449.0 L389.9 443.0 L393.2 437.0 L395.9 431.0 L397.8 425.0 L399.3 419.0 L400.4 413.0 L401.4 407.0 L402.4 401.0 L403.4 395.0 L404.5 389.0 L406.0 383.0 L407.5 377.0 L409.0 371.0 L410.5 365.0 L411.9 359.0 L413.3 353.0 L414.7 347.0 L416.1 341.0 L417.7 335.0 L419.3 329.0 L420.9 323.0 L422.6 317.0 L425.4 311.0 L429.0 305.0 L432.8 299.0 L434.4 293.0 L435.1 287.0 L435.3 281.0 L435.8 275.0 L435.9 269.0 L435.4 263.0 L435.7 257.0 L435.4 251.0 L434.8 245.0 L434.8 239.0 L434.5 233.0 L433.9 227.0 L433.9 221.0 L433.1 215.0 L432.6 209.0 L431.9 203.0 L430.9 197.0 L430.0 191.0 L429.3 185.0 L428.3 179.0 L427.1 173.0 L426.5 167.0 L425.4 161.0 L423.8 155.0 L423.1 149.0 L421.6 143.0 L419.9 137.0 L418.8 131.0 L417.2 125.0 L414.6 119.0 L412.2 113.0 L408.9 107.0 L405.2 101.0 L402.0 95.0 L398.0 89.0 L394.9 83.0 L391.4 77.0 L387.8 71.0 L381.6 65.0 L372.6 59.0 L363.7 53.0 L350.1 47.0 L333.6 41.0 L314.8 35.0 L293.3 29.0 Z" fill="#0c1511" stroke="url(#dmg)" strokeWidth="4" />
    {/* calotta della fronte con il bordo a V rivettato */}
    <path d="M257.7 29.0 L236.2 35.0 L217.4 41.0 L200.9 47.0 L187.3 53.0 L178.4 59.0 L169.4 65.0 L163.2 71.0 L172 70 L176 108 Q200 128 250 148 L275 155 L300 148 Q350 128 374 108 L378 70 L387.8 71.0 L381.6 65.0 L372.6 59.0 L363.7 53.0 L350.1 47.0 L333.6 41.0 L314.8 35.0 L293.3 29.0 Z" fill="#18231e" stroke="url(#dmg)" strokeWidth="2.5" />
    <path d="M172 70 L176 108 Q200 128 250 148 L275 155 L300 148 Q350 128 374 108 L378 70" stroke="#dfe8e2" strokeWidth="6" strokeDasharray="0 12" />
    {/* arcate sopraccigliari rivettate */}
    <path d="M133 229 Q160 212 200 217 Q240 228 268 247" stroke="#dfe8e2" strokeWidth="6" strokeDasharray="0 12" />
    <path d="M418 229 Q391 212 351 217 Q311 228 283 247" stroke="#dfe8e2" strokeWidth="6" strokeDasharray="0 12" />
    <path d="M133 229 Q160 212 200 217 Q240 228 268 247" stroke="url(#dmg)" strokeWidth="2.5" />
    <path d="M418 229 Q391 212 351 217 Q311 228 283 247" stroke="url(#dmg)" strokeWidth="2.5" />
    {/* occhi */}
    <path d="M155 236 L252 241 L250 281 L158 281 Z" fill="#1fe06a" stroke="url(#dmg)" strokeWidth="3" />
    <path d="M396 236 L299 241 L301 281 L393 281 Z" fill="#1fe06a" stroke="url(#dmg)" strokeWidth="3" />
    <path d="M158 295 L248 295" stroke="#dfe8e2" strokeWidth="6" strokeDasharray="0 12" />
    <path d="M303 295 L393 295" stroke="#dfe8e2" strokeWidth="6" strokeDasharray="0 12" />
    {/* naso sfaccettato */}
    <path d="M259 250 L292 250 L312 325 L276 356 L240 325 Z" fill="#0c1511" stroke="url(#dmg)" strokeWidth="3" />
    <path d="M240 325 L276 340 L312 325 M276 252 V340" stroke="url(#dmg)" strokeWidth="2" opacity=".7" />
    {/* piani delle guance */}
    <path d="M134 312 Q146 350 168 398" stroke="url(#dmg)" strokeWidth="2.5" opacity=".75" />
    <path d="M417 312 Q405 350 383 398" stroke="url(#dmg)" strokeWidth="2.5" opacity=".75" />
    {/* bocca a broncio con griglia */}
    <path d="M207 388 Q240 374 276 374 Q311 374 344 388 L350 414 Q312 404 276 404 Q240 404 202 414 Z" fill="#050a08" stroke="url(#dmg)" strokeWidth="3" />
    <path d="M228 396 H324 V404 H228 Z" fill="#0e1814" stroke="url(#dmg)" strokeWidth="2" />
    <path d="M246 396V404M264 396V404M288 396V404M306 396V404" stroke="url(#dmg)" strokeWidth="2" />
    <path d="M212 413 Q245 404 276 404 Q307 404 339 413" stroke="#dfe8e2" strokeWidth="6" strokeDasharray="0 12" />
    {/* mento */}
    <path d="M243 416 L309 416 L316 506 L236 506 Z" fill="#0e1814" stroke="url(#dmg)" strokeWidth="3" />
    <path d="M243 432 H309" stroke="url(#dmg)" strokeWidth="2.5" />
    <path d="M276 432V506" stroke="url(#dmg)" strokeWidth="2" opacity=".6" />
  </svg>
);

function DoomView({ media, doom = {}, user, go, watch, toggle, setSeen }) {
  const [now, setNow] = useState(Date.now());
  const [pick, setPick] = useState(null); // serie di cui scegliere le stagioni viste
  const seasonsOf = (m) => [...(m.seasons || [])].sort(byNum).map((s) => ({ s, eps: (s.episodes || []).filter((e) => e.hasVideo) })).filter((x) => x.eps.length);
  const markSeen = (m, done) => {
    const ss = m.type === "series" ? seasonsOf(m) : [];
    if (!ss.length) return toggle("watched", m.id);
    const w = new Set(user.watched || []);
    setPick({ m, sel: new Set(ss.filter(({ s, eps }) => w.has(m.id) || eps.every((e) => w.has(e.id))).map(({ s }) => s.id)) });
  };
  const confirmSeasons = async () => {
    const { m, sel } = pick, w = new Set(user.watched || []), ss = seasonsOf(m), add = [], remove = [];
    for (const { s, eps } of ss) for (const e of eps) {
      if (sel.has(s.id) && !w.has(e.id)) add.push(e.id);
      if (!sel.has(s.id) && w.has(e.id)) remove.push(e.id);
    }
    const all = ss.every(({ s }) => sel.has(s.id));
    if (all && !w.has(m.id)) add.push(m.id);
    if (!all && w.has(m.id)) remove.push(m.id);
    setPick(null);
    await setSeen(add, remove);
  };
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
              <div key={m.id} className={"dm-item" + (done ? " done" : "")}>
                <button className="dm-open" onClick={() => go({ n: "media", id: m.id })}>
                  <span className="dm-n">{i + 1}</span>
                  <span className="dm-th" style={{ backgroundImage: `url(${art(m, "poster")})` }} />
                  <span className="dm-in"><b>{m.title}</b><small>{total ? `${fmtH(total)}${rem !== total && rem > 0 ? ` · restano ${fmtH(rem)}` : ""}` : "durata mancante"}</small></span>
                </button>
                <button className={"dm-tag dm-chk" + (done ? " ok" : "")} onClick={() => markSeen(m, done)}>{done ? "✓ Visto" : "Segna visto"}</button>
              </div>
            ))}
          </div>

          {pick && createPortal(
            <div className="dm dm-ov" onClick={() => setPick(null)}>
              <div className="dm-sheet" onClick={(e) => e.stopPropagation()}>
                <b>{pick.m.title}</b>
                <small>Quali stagioni hai già visto?</small>
                <div className="dm-seas">
                  {seasonsOf(pick.m).map(({ s }) => {
                    const on = pick.sel.has(s.id);
                    return (
                      <button key={s.id} className={on ? "on" : ""} onClick={() => { const n = new Set(pick.sel); on ? n.delete(s.id) : n.add(s.id); setPick({ ...pick, sel: n }); }}>
                        <i>{on ? "✓" : ""}</i>{s.name || `Stagione ${s.number}`}
                      </button>
                    );
                  })}
                </div>
                <div className="dm-sheet-act">
                  <button className="dm-link" onClick={() => setPick({ ...pick, sel: pick.sel.size === seasonsOf(pick.m).length ? new Set() : new Set(seasonsOf(pick.m).map(({ s }) => s.id)) })}>{pick.sel.size === seasonsOf(pick.m).length ? "Deseleziona tutte" : "Seleziona tutte"}</button>
                  <button className="dm-btn" onClick={confirmSeasons}>Conferma</button>
                </div>
              </div>
            </div>,
            document.body
          )}

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
  const setSeen = async (add, remove) => {
    try {
      const u = await api("watched-set", { body: { add, remove } });
      setBoot((b) => ({ ...b, user: u }));
      tg?.HapticFeedback?.impactOccurred("light");
    } catch { say("Salvataggio non riuscito"); }
  };
  const setSetting = async (key, value) => {
    setBoot((b) => ({ ...b, user: { ...b.user, settings: { ...(b.user.settings || {}), [key]: value } } }));
    try { const u = await api("settings", { body: { key, value } }); setBoot((b) => ({ ...b, user: u })); }
    catch { setBoot((b) => ({ ...b, user: { ...b.user, settings: { ...(b.user.settings || {}), [key]: !value } } })); say("Impostazione non salvata"); }
  };
  const deep = useRef(false);
  useEffect(() => { // link condiviso: t.me/bot?startapp=t_<id> apre direttamente la scheda
    if (deep.current || !boot.media) return;
    deep.current = true;
    const sp = tg?.initDataUnsafe?.start_param || "";
    if (sp.startsWith("t_") && boot.media.some((x) => x.id === sp.slice(2))) go({ n: "media", id: sp.slice(2) });
  }, [boot.media]);

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
    } else if (view.n === "media" && find(view.id)) body = <Detail key={view.id + (view.season || "")} m={find(view.id)} user={user} me={me} watch={watch} toggle={toggle} say={say} rate={rate} initSeason={view.season} />;
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
    else if (view.n === "doom" && features.doom && Date.now() <= DOOM_OPEN_UNTIL) body = <DoomView media={media} doom={doomsday} user={user} go={go} watch={watch} toggle={toggle} setSeen={setSeen} />;
    else if (view.n === "profile" || view.n === "list" || view.n === "stats") body = <ProfilePage media={media} user={user} me={me} features={features} go={go} say={say} setSetting={setSetting} />;
    else if (view.n === "admin" && me?.isAdmin) body = <Admin say={say} onChange={load} />;
  }

  const items = [["home", I.Home, "Home"], ["search", I.Search, "Cerca"], ...(features.timeline ? [["timeline", I.Clock, "Timeline"]] : []), ...(features.doom && Date.now() <= DOOM_OPEN_UNTIL ? [["doom", I.Mask, "Doomsday"]] : []), ["profile", I.User, "Profilo"], ...(me?.isAdmin ? [["admin", I.Shield, "Admin"]] : [])];
  return (
    <>
      {splash && <div className="splash"><img src={logo} alt="" /><div className="tri" /></div>}
      {!boot.error && !boot.gate && <Header onSearch={() => tab({ n: "search" })} />}
      {body}
      {!boot.error && !boot.gate && (
        <nav className={"nav" + (items.length > 5 ? " many" : "")}>
          {items.map(([n, Ic, l]) => (
            <button key={n} className={view.n === n ? "on" : ""} onClick={() => tab({ n })}><span><Ic size={21} /></span><small>{l}</small></button>
          ))}
        </nav>
      )}
      {toast && <div className="toast"><I.Check size={16} /> {toast}</div>}
    </>
  );
}
