import { useEffect, useState } from "react";
import { api, imgUrl, art } from "./api.js";
import { descIds } from "./lib/util.js";
import Admin from "./Admin.jsx";

const tg = window.Telegram?.WebApp;
const byNum = (a, b) => (a.number || 0) - (b.number || 0);

function Poster({ m }) {
  const src = art(m, "poster");
  return src ? <img src={src} loading="lazy" alt="" /> : <div className="ph">{m.title?.[0]}</div>;
}

function Card({ m, go }) {
  return (
    <div className="card" onClick={() => go({ n: "media", id: m.id })}>
      <Poster m={m} />
      <span>{m.title}</span>
    </div>
  );
}

const Row = ({ title, items, go }) =>
  items.length ? (
    <>
      <h2>{title}</h2>
      <div className="row">{items.map((m) => <Card key={m.id} m={m} go={go} />)}</div>
    </>
  ) : null;

const Grid = ({ items, go }) =>
  items.length ? <div className="grid">{items.map((m) => <Card key={m.id} m={m} go={go} />)}</div> : <p className="empty">Niente qui, per ora.</p>;

function Detail({ m, user, watch, toggle }) {
  const seasons = [...(m.seasons || [])].sort(byNum);
  const [sid, setSid] = useState(seasons[0]?.id);
  const season = seasons.find((s) => s.id === sid);
  const seen = (id) => user.watched.includes(id);
  return (
    <div>
      <div className="hero small" style={{ backgroundImage: `url(${art(m, "backdrop") || art(m, "poster")})` }}><div className="fade" /></div>
      <div className="page">
        <h1>{m.title}</h1>
        <p className="meta">{[m.year, m.type === "movie" ? "Film" : "Serie TV"].filter(Boolean).join(" · ")}</p>
        <p className="overview">{m.overview}</p>
        <div className="actions">
          {m.type === "movie" && m.hasVideo && <button className="btn red" onClick={() => watch(m.id)}>▶ Guarda</button>}
          <button className="btn" onClick={() => toggle("watchlist", m.id)}>{user.watchlist.includes(m.id) ? "✓ Nella lista" : "+ La mia lista"}</button>
          {m.type === "movie" && <button className="btn" onClick={() => toggle("watched", m.id)}>{seen(m.id) ? "✓ Visto" : "Segna visto"}</button>}
        </div>
        {m.type === "series" && (
          <>
            <div className="chips">
              {seasons.map((s) => (
                <button key={s.id} className={"chip" + (s.id === sid ? " on" : "")} onClick={() => setSid(s.id)}>
                  {s.name || `Stagione ${s.number}`}
                </button>
              ))}
            </div>
            {season && [...season.episodes].sort(byNum).map((e) => (
              <div className="ep" key={e.id}>
                <div className="thumb" onClick={() => e.hasVideo && watch(m.id, e.id)}>
                  {e.cover ? <img src={imgUrl(e.cover)} alt="" loading="lazy" /> : <div className="ph">▶</div>}
                </div>
                <div className="ep-info">
                  <b>{e.number}. {e.title || `Episodio ${e.number}`}</b>
                  {e.overview && <p>{e.overview}</p>}
                  <div className="actions">
                    {e.hasVideo && <button className="btn small red" onClick={() => watch(m.id, e.id)}>▶ Guarda</button>}
                    <button className="btn small" onClick={() => toggle("watched", e.id)}>{seen(e.id) ? "✓ Visto" : "Visto?"}</button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Search({ media, go }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const items = media.filter((m) =>
    (f === "all" || m.type === f) &&
    (m.title + " " + (m.overview || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <h1>Cerca</h1>
      <input className="in" placeholder="Cerca film e serie…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {[["all", "Tutti"], ["movie", "Film"], ["series", "Serie"]].map(([k, l]) => (
          <button key={k} className={"chip" + (f === k ? " on" : "")} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      <Grid items={items} go={go} />
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
      const [me, cat] = await Promise.all([api("me"), api("catalog")]);
      setBoot({ me, ...cat });
    } catch (e) { setBoot({ error: e.message }); }
  };

  useEffect(() => {
    tg?.ready(); tg?.expand();
    tg?.setHeaderColor?.("#0B0B0D"); tg?.setBackgroundColor?.("#0B0B0D");
    load();
    setTimeout(() => setSplash(false), 1500);
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
      say("Video inviato nella chat ✅");
      setTimeout(() => tg?.close(), 1200);
    } catch (e) {
      const err = e.data?.error;
      if (err === "start_required") {
        say("Premi START sul bot per ricevere i video");
        setTimeout(() => tg?.openTelegramLink?.(`https://t.me/${me?.botUsername}`), 1400);
      } else say(err === "rate" ? "Vai piano! Riprova tra poco" : "Errore nell'invio del video");
    }
  };
  const toggle = async (kind, id) => {
    const u = await api("toggle", { body: { kind, id } });
    setBoot((b) => ({ ...b, user: u }));
    tg?.HapticFeedback?.impactOccurred("light");
  };

  const cats = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
  const inCat = (id) => { const ids = descIds(categories, id); return media.filter((m) => m.categoryIds?.some((c) => ids.includes(c))); };
  const recent = [...media].sort((a, b) => b.createdAt - a.createdAt);
  const find = (id) => media.find((m) => m.id === id);

  let body = null;
  if (boot.error)
    body = <div className="center"><h1>MARVEL ITALIA STREAMING</h1><p>{boot.error === "unauthorized" ? "Apri questa app da Telegram." : "Errore: " + boot.error}</p></div>;
  else if (!boot.loading) {
    if (view.n === "home") {
      const hero = media.find((m) => m.featured) || recent[0];
      body = (
        <div>
          {hero && (
            <div className="hero" style={{ backgroundImage: `url(${art(hero, "backdrop") || art(hero, "poster")})` }} onClick={() => go({ n: "media", id: hero.id })}>
              <div className="fade" />
              <div className="hero-in">
                <h1>{hero.title}</h1>
                <p className="clamp">{hero.overview}</p>
                <div className="actions">
                  <button className="btn red" onClick={(e) => { e.stopPropagation(); hero.type === "movie" ? watch(hero.id) : go({ n: "media", id: hero.id }); }}>▶ Guarda</button>
                  <button className="btn" onClick={(e) => { e.stopPropagation(); toggle("watchlist", hero.id); }}>{user.watchlist.includes(hero.id) ? "✓ In lista" : "+ Lista"}</button>
                </div>
              </div>
            </div>
          )}
          <Row title="Aggiunti di recente" items={recent.slice(0, 15)} go={go} />
          <Row title="Film" items={recent.filter((m) => m.type === "movie")} go={go} />
          <Row title="Serie TV" items={recent.filter((m) => m.type === "series")} go={go} />
          {cats.filter((c) => c.showInHome).map((c) => <Row key={c.id} title={`${c.emoji || ""} ${c.name}`} items={inCat(c.id)} go={go} />)}
          <Row title="La mia lista" items={media.filter((m) => user.watchlist.includes(m.id))} go={go} />
          {!media.length && <p className="empty">Il catalogo è vuoto. Aggiungi contenuti dal pannello Admin.</p>}
        </div>
      );
    } else if (view.n === "media" && find(view.id)) body = <Detail m={find(view.id)} user={user} watch={watch} toggle={toggle} />;
    else if (view.n === "cats")
      body = (
        <div className="page"><h1>Categorie</h1>
          <div className="catgrid">
            {cats.filter((c) => !c.parentId).map((c) => (
              <div key={c.id} className="catcard" style={c.cover ? { backgroundImage: `url(${imgUrl(c.cover)})` } : {}} onClick={() => go({ n: "cat", id: c.id })}>
                <span>{c.emoji}</span><b>{c.name}</b>
              </div>
            ))}
          </div>
          {!cats.length && <p className="empty">Nessuna categoria.</p>}
        </div>
      );
    else if (view.n === "cat") {
      const c = categories.find((x) => x.id === view.id);
      body = c && (
        <div className="page"><h1>{c.emoji} {c.name}</h1>
          <div className="chips">{cats.filter((k) => k.parentId === c.id).map((k) => <button key={k.id} className="chip" onClick={() => go({ n: "cat", id: k.id })}>{k.emoji} {k.name}</button>)}</div>
          <Grid items={inCat(c.id)} go={go} />
        </div>
      );
    } else if (view.n === "search") body = <Search media={media} go={go} />;
    else if (view.n === "list") body = <div className="page"><h1>La mia lista</h1><Grid items={media.filter((m) => user.watchlist.includes(m.id))} go={go} /></div>;
    else if (view.n === "admin" && me?.isAdmin) body = <Admin say={say} onChange={load} />;
  }

  return (
    <>
      {splash && (
        <div className="splash">
          <i /><i /><i />
          <h1>MARVEL<br />ITALIA<br />STREAMING</h1>
        </div>
      )}
      {body}
      {!boot.error && (
        <nav className="nav">
          {[["home", "🏠", "Home"], ["cats", "🗂", "Categorie"], ["search", "🔍", "Cerca"], ["list", "★", "Lista"], ...(me?.isAdmin ? [["admin", "⚙️", "Admin"]] : [])].map(([n, i, l]) => (
            <button key={n} className={view.n === n ? "on" : ""} onClick={() => tab({ n })}>{i}<small>{l}</small></button>
          ))}
        </nav>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
