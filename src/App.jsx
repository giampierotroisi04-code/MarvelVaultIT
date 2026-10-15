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

function Detail({ m, user, watch, toggle, say }) {
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
        </div>
        <h1 className="dtitle">{m.title}</h1>
        <div className="actions">
          {m.type === "movie" && m.hasVideo && <button className="btn primary" onClick={() => watch(m.id)}><I.Play size={18} /> Guarda</button>}
          <button className="btn round" aria-label="Lista" onClick={() => toggle("watchlist", m.id)}><I.Bookmark size={20} fill={inList ? "currentColor" : "none"} /></button>
          {m.type === "movie" && <button className="btn round" aria-label="Visto" onClick={() => toggle("watched", m.id)}>{seen(m.id) ? <I.Check size={20} /> : <I.Eye size={20} />}</button>}
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

function Search({ media, go, user, say }) {
  const [q, setQ] = useState("");
  const [req, setReq] = useState(false);
  const [f, setF] = useState("all");
  const items = media.filter((m) =>
    (f === "all" || m.type === f) &&
    (m.title + " " + (m.overview || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <div className="searchbox"><I.Search size={18} /><input placeholder="Cerca film e serie" value={q} onChange={(e) => setQ(e.target.value)} /></div>
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

  const { media = [], categories = [], user = { watchlist: [], watched: [] }, me } = boot;

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
    } else if (view.n === "media" && find(view.id)) body = <Detail m={find(view.id)} user={user} watch={watch} toggle={toggle} say={say} />;
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
    } else if (view.n === "search") body = <Search media={media} go={go} user={user} say={say} />;
    else if (view.n === "list") body = <div className="page"><h1 className="ptitle">La mia lista</h1><Grid items={media.filter((m) => user.watchlist.includes(m.id))} go={go} user={user} /></div>;
    else if (view.n === "admin" && me?.isAdmin) body = <Admin say={say} onChange={load} />;
  }

  const items = [["home", I.Home, "Home"], ["search", I.Search, "Cerca"], ["list", I.Bookmark, "Lista"], ...(me?.isAdmin ? [["admin", I.Shield, "Admin"]] : [])];
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
