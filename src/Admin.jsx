import { useEffect, useState } from "react";
import { api, imgUrl } from "./api.js";
import { parseLink, buildLink, flatTree, descIds } from "./lib/util.js";

const tg = window.Telegram?.WebApp;
const uid = () => Math.random().toString(16).slice(2, 12);
const srcFrom = (link) => ({ link, ...(parseLink(link) || {}) });
const ask = (msg) => new Promise((ok) => (tg?.showConfirm ? tg.showConfirm(msg, ok) : ok(window.confirm(msg))));
const choose = (title, message, buttons) =>
  new Promise((ok) => (tg?.showPopup ? tg.showPopup({ title, message, buttons }, ok) : ok(window.confirm(message) ? buttons[0].id : null)));

// ---------- Upload immagine (compressa nel browser, salva su Netlify Blobs) ----------
function Img({ value, url, onChange, label = "Immagine" }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setBusy(true);
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const { id } = await api("admin/image", { body: { dataUrl: c.toDataURL("image/jpeg", 0.82) } });
      onChange(id);
    } catch { alert("Upload non riuscito"); }
    setBusy(false);
  };
  const src = imgUrl(value) || url;
  return (
    <div className="imgup">
      {src ? <img src={src} alt="" /> : <div className="ph">＋</div>}
      <label className="btn small">{busy ? "Carico…" : label}<input type="file" accept="image/*" hidden onChange={pick} /></label>
      {value ? <button className="btn small" onClick={() => onChange("")}>✕</button> : null}
    </div>
  );
}

// ---------- Stagione con episodi ----------
function SeasonBlock({ s, up, delSeason, verify }) {
  const [r, setR] = useState({ a: "", b: "" });
  const eps = [...s.episodes].sort((x, y) => x.number - y.number);
  const upEp = (id, p) => up({ episodes: s.episodes.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const nextNum = () => Math.max(0, ...s.episodes.map((e) => e.number || 0)) + 1;
  const addEp = () => up({ episodes: [...s.episodes, { id: uid(), number: nextNum(), title: "", overview: "", cover: "", visible: true, source: null }] });
  const addRange = () => {
    const a = parseLink(r.a), b = parseLink(r.b);
    if (!a || !b || a.channelId !== b.channelId || b.messageId < a.messageId || b.messageId - a.messageId > 200) return alert("Link non validi");
    let n = nextNum();
    const eps2 = [];
    for (let i = a.messageId; i <= b.messageId; i++)
      eps2.push({ id: uid(), number: n++, title: "", overview: "", cover: "", visible: true, source: srcFrom(buildLink(a.channelId, i)) });
    up({ episodes: [...s.episodes, ...eps2] });
    setR({ a: "", b: "" });
  };
  return (
    <div className="box">
      <div className="row2">
        <input className="in sm" type="number" value={s.number} onChange={(e) => up({ number: +e.target.value })} />
        <input className="in" placeholder="Nome stagione (opzionale)" value={s.name || ""} onChange={(e) => up({ name: e.target.value })} />
        <button className="btn small" onClick={delSeason}>🗑</button>
      </div>
      <Img value={s.cover} label="Copertina stagione" onChange={(cover) => up({ cover })} />
      {eps.map((e) => (
        <div className="ep-edit" key={e.id}>
          <div className="row2">
            <input className="in sm" type="number" value={e.number} onChange={(ev) => upEp(e.id, { number: +ev.target.value })} />
            <input className="in" placeholder="Titolo episodio" value={e.title} onChange={(ev) => upEp(e.id, { title: ev.target.value })} />
          </div>
          <textarea className="in" rows={2} placeholder="Descrizione" value={e.overview || ""} onChange={(ev) => upEp(e.id, { overview: ev.target.value })} />
          <Img value={e.cover} label="Immagine episodio" onChange={(cover) => upEp(e.id, { cover })} />
          <input className="in" placeholder="Link messaggio del canale" value={e.source?.link || ""} onChange={(ev) => upEp(e.id, { source: ev.target.value ? srcFrom(ev.target.value) : null })} />
          <div className="row2">
            <button className="btn small" onClick={() => verify(e.source?.link)}>🔎 Verifica</button>
            <label className="chk"><input type="checkbox" checked={e.visible !== false} onChange={(ev) => upEp(e.id, { visible: ev.target.checked })} /> Visibile</label>
            <button className="btn small" onClick={() => up({ episodes: s.episodes.filter((x) => x.id !== e.id) })}>🗑</button>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={addEp}>＋ Episodio</button>
      <div className="row2">
        <input className="in" placeholder="Link primo episodio" value={r.a} onChange={(e) => setR({ ...r, a: e.target.value })} />
        <input className="in" placeholder="Link ultimo" value={r.b} onChange={(e) => setR({ ...r, b: e.target.value })} />
        <button className="btn small" onClick={addRange}>＋ Intervallo</button>
      </div>
    </div>
  );
}

// ---------- Form film/serie ----------
function MediaForm({ init, cats, onDone, onCancel }) {
  const [m, setM] = useState(init);
  const [res, setRes] = useState([]);
  const [msg, setMsg] = useState("");
  const set = (p) => setM((x) => ({ ...x, ...p }));
  const newSeason = () => ({ id: uid(), number: (m.seasons?.length || 0) + 1, name: "", cover: "", episodes: [] });
  const setType = (type) => set({ type, seasons: type === "series" && !m.seasons?.length ? [newSeason()] : m.seasons });
  const upSeason = (id, p) => set({ seasons: m.seasons.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  const tmdb = async () => {
    try { setRes((await api("admin/tmdb?q=" + encodeURIComponent(m.title))).results); }
    catch { setMsg("TMDB non configurato (serve TMDB_API_KEY)"); }
  };
  const verify = async (link) => {
    if (!link) return setMsg("Incolla prima un link");
    const r = await api("admin/verify", { body: { link } }).catch((e) => e.data || {});
    setMsg(r.ok ? "✅ Video inviato nella tua chat col bot: controlla che sia quello giusto" : "❌ " + (r.error || "Errore"));
  };
  const save = async () => {
    if (!m.title.trim()) return alert("Inserisci un titolo");
    const bad = [m.source, ...(m.seasons || []).flatMap((s) => s.episodes.map((e) => e.source))].some((x) => x?.link && !x.messageId);
    if (bad) return alert("C'è un link non valido");
    await api("admin/media", { body: m });
    onDone();
  };

  return (
    <div className="page">
      <h1>{m.id ? "Modifica" : "Nuovo contenuto"}</h1>
      <div className="row2">
        <select className="in" value={m.type} onChange={(e) => setType(e.target.value)}><option value="movie">Film</option><option value="series">Serie TV</option></select>
        <input className="in sm" placeholder="Anno" value={m.year || ""} onChange={(e) => set({ year: e.target.value })} />
      </div>
      <div className="row2">
        <input className="in" placeholder="Titolo" value={m.title} onChange={(e) => set({ title: e.target.value })} />
        <button className="btn small" onClick={tmdb}>TMDB</button>
      </div>
      {res.map((r, i) => (
        <button key={i} className="btn tmdb" onClick={() => { set({ title: r.title, year: r.year, overview: r.overview, posterUrl: r.posterUrl, backdropUrl: r.backdropUrl, type: r.type, seasons: r.type === "series" && !m.seasons?.length ? [newSeason()] : m.seasons }); setRes([]); }}>
          {r.title} ({r.year}) · {r.type === "movie" ? "Film" : "Serie"}
        </button>
      ))}
      <textarea className="in" rows={4} placeholder="Trama / descrizione" value={m.overview || ""} onChange={(e) => set({ overview: e.target.value })} />
      <Img value={m.posterImg} url={m.posterUrl} label="Poster" onChange={(posterImg) => set({ posterImg, posterUrl: posterImg ? "" : m.posterUrl })} />
      <Img value={m.backdropImg} url={m.backdropUrl} label="Sfondo (16:9)" onChange={(backdropImg) => set({ backdropImg })} />
      <div className="row2">
        <label className="chk"><input type="checkbox" checked={m.visible !== false} onChange={(e) => set({ visible: e.target.checked })} /> Visibile</label>
        <label className="chk"><input type="checkbox" checked={!!m.featured} onChange={(e) => set({ featured: e.target.checked })} /> In evidenza in Home (uno solo)</label>
      </div>

      <h2>Categorie</h2>
      <div className="box">
        {flatTree(cats).map((c) => (
          <label key={c.id} className="chk" style={{ paddingLeft: c.depth * 18, display: "block" }}>
            <input type="checkbox" checked={m.categoryIds?.includes(c.id)} onChange={(e) => set({ categoryIds: e.target.checked ? [...(m.categoryIds || []), c.id] : m.categoryIds.filter((x) => x !== c.id) })} /> {c.emoji} {c.name}
          </label>
        ))}
        {!cats.length && <small>Nessuna categoria: creale dalla tab Categorie.</small>}
      </div>

      {m.type === "movie" ? (
        <>
          <h2>Video</h2>
          <input className="in" placeholder="Link del messaggio (https://t.me/c/…/45)" value={m.source?.link || ""} onChange={(e) => set({ source: e.target.value ? srcFrom(e.target.value) : null })} />
          <button className="btn small" onClick={() => verify(m.source?.link)}>🔎 Verifica link</button>
        </>
      ) : (
        <>
          <h2>Stagioni ed episodi</h2>
          {[...(m.seasons || [])].sort((a, b) => a.number - b.number).map((s) => (
            <SeasonBlock key={s.id} s={s} up={(p) => upSeason(s.id, p)} verify={verify}
              delSeason={async () => (await ask("Eliminare la stagione?")) && set({ seasons: m.seasons.filter((x) => x.id !== s.id) })} />
          ))}
          <button className="btn small" onClick={() => set({ seasons: [...(m.seasons || []), newSeason()] })}>＋ Stagione</button>
        </>
      )}
      {msg && <p className="msg">{msg}</p>}
      <div className="actions sticky"><button className="btn red" onClick={save}>💾 Salva</button><button className="btn" onClick={onCancel}>Annulla</button></div>
    </div>
  );
}

// ---------- Categorie ----------
function Cats({ cats, reload }) {
  const [edit, setEdit] = useState(null);
  const list = flatTree(cats);
  const save = async () => { if (!edit.name?.trim()) return alert("Nome mancante"); await api("admin/category", { body: edit }); setEdit(null); reload(); };
  const del = async (c) => {
    const mode = await choose("Elimina «" + c.name + "»", "I contenuti NON verranno cancellati.", [
      { id: "keep", type: "default", text: "Solo questa categoria" },
      { id: "cascade", type: "destructive", text: "Anche le sottocategorie" },
      { type: "cancel" },
    ]);
    if (!mode) return;
    await api(`admin/category/${c.id}?mode=${mode}`, { method: "DELETE" });
    reload();
  };
  const move = async (c, dir) => {
    const sibs = cats.filter((x) => (x.parentId || null) === (c.parentId || null)).sort((a, b) => (a.order || 0) - (b.order || 0));
    const i = sibs.findIndex((x) => x.id === c.id), j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
    await api("admin/reorder", { body: { ids: sibs.map((x) => x.id) } });
    reload();
  };

  if (edit) {
    const ban = new Set(edit.id ? descIds(cats, edit.id) : []);
    return (
      <div className="page">
        <h1>{edit.id ? "Modifica categoria" : "Nuova categoria"}</h1>
        <div className="row2">
          <input className="in sm" placeholder="😀" value={edit.emoji || ""} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} />
          <input className="in" placeholder="Nome" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
        </div>
        <select className="in" value={edit.parentId || ""} onChange={(e) => setEdit({ ...edit, parentId: e.target.value || null })}>
          <option value="">— Categoria principale —</option>
          {list.filter((c) => !ban.has(c.id)).map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}</option>)}
        </select>
        <Img value={edit.cover} label="Copertina" onChange={(cover) => setEdit({ ...edit, cover })} />
        <div className="row2">
          <label className="chk"><input type="checkbox" checked={!!edit.showInHome} onChange={(e) => setEdit({ ...edit, showInHome: e.target.checked })} /> Riga in Home</label>
          <label className="chk"><input type="checkbox" checked={edit.visible !== false} onChange={(e) => setEdit({ ...edit, visible: e.target.checked })} /> Visibile</label>
        </div>
        <div className="actions"><button className="btn red" onClick={save}>💾 Salva</button><button className="btn" onClick={() => setEdit(null)}>Annulla</button></div>
      </div>
    );
  }
  return (
    <div className="page">
      <button className="btn red" onClick={() => setEdit({ name: "", emoji: "", parentId: null, visible: true, showInHome: true })}>＋ Nuova categoria</button>
      {list.map((c) => (
        <div className="item" key={c.id} style={{ marginLeft: c.depth * 16 }}>
          <b>{c.emoji} {c.name}</b>{c.visible === false && <small> (nascosta)</small>}
          <div className="actions">
            <button className="btn small" onClick={() => move(c, -1)}>⬆</button>
            <button className="btn small" onClick={() => move(c, 1)}>⬇</button>
            <button className="btn small" onClick={() => setEdit({ name: "", emoji: "", parentId: c.id, visible: true, showInHome: false })}>＋ Sub</button>
            <button className="btn small" onClick={() => setEdit(c)}>✏️</button>
            <button className="btn small" onClick={() => del(c)}>🗑</button>
          </div>
        </div>
      ))}
      {!list.length && <p className="empty">Nessuna categoria. Creane una!</p>}
    </div>
  );
}

// ---------- Pannello ----------
export default function Admin({ say, onChange }) {
  const [tab, setTab] = useState("media");
  const [db, setDb] = useState(null);
  const [form, setForm] = useState(null);
  const reload = () => api("admin/catalog").then((d) => { setDb(d); onChange?.(); });
  useEffect(() => { api("admin/catalog").then(setDb).catch(() => say("Accesso negato")); }, []);
  if (!db) return <div className="page">Carico…</div>;
  if (form)
    return <MediaForm init={form} cats={db.categories} onCancel={() => setForm(null)} onDone={() => { setForm(null); reload(); say("Salvato ✅"); }} />;

  const del = async (m) => { if (await ask(`Eliminare «${m.title}»?`)) { await api("admin/media/" + m.id, { method: "DELETE" }); reload(); } };
  return (
    <div className="page">
      <h1>Admin <span className="badge">ADMIN</span></h1>
      <div className="chips">
        <button className={"chip" + (tab === "media" ? " on" : "")} onClick={() => setTab("media")}>Contenuti</button>
        <button className={"chip" + (tab === "cats" ? " on" : "")} onClick={() => setTab("cats")}>Categorie</button>
      </div>
      {tab === "cats" ? <Cats cats={db.categories} reload={reload} /> : (
        <>
          <button className="btn red" onClick={() => setForm({ type: "movie", title: "", year: "", overview: "", categoryIds: [], visible: true, featured: false, seasons: [], source: null })}>＋ Aggiungi contenuto</button>
          {[...db.media].sort((a, b) => b.createdAt - a.createdAt).map((m) => (
            <div className="item" key={m.id}>
              <b>{m.title}</b> <small>{m.type === "movie" ? "Film" : `Serie · ${m.seasons?.reduce((n, s) => n + s.episodes.length, 0)} ep.`}{m.visible === false ? " · nascosto" : ""}</small>
              <div className="actions"><button className="btn small" onClick={() => setForm(m)}>✏️ Modifica</button><button className="btn small" onClick={() => del(m)}>🗑</button></div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
