import { useEffect, useState } from "react";
import { api, imgUrl } from "./api.js";
import { I } from "./Icons.jsx";
import { parseLink, buildLink, flatTree, descIds, byRelease } from "./lib/util.js";

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
      {src ? <img src={src} alt="" /> : <div className="ph"><I.Image size={22} /></div>}
      <label className="btn small">{busy ? "Carico…" : label}<input type="file" accept="image/*" hidden onChange={pick} /></label>
      {value ? <button className="btn small" onClick={() => onChange("")}><I.X size={16} /></button> : null}
    </div>
  );
}

// ---------- Stagione con episodi ----------
function SeasonBlock({ s, up, delSeason, verify, tmdbId, say }) {
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
  // Importa titolo, descrizione e immagine degli episodi da TMDB (compila solo i campi vuoti, non tocca i link)
  const importTmdb = async () => {
    if (!tmdbId) return alert("Prima cerca la serie con il bottone TMDB e selezionala");
    try {
      const { episodes } = await api(`admin/tmdb-season?id=${tmdbId}&season=${s.number}`);
      const have = new Map(s.episodes.map((e) => [e.number, e]));
      const merged = s.episodes.map((e) => {
        const t = episodes.find((x) => x.number === e.number);
        if (!t) return e;
        return { ...e, title: e.title || t.title, overview: e.overview || t.overview, coverUrl: e.cover ? e.coverUrl : t.coverUrl || e.coverUrl };
      });
      // se la stagione è vuota crea gli episodi (senza video collegato)
      const created = s.episodes.length ? [] : episodes.filter((t) => !have.has(t.number)).map((t) => ({ id: uid(), number: t.number, title: t.title, overview: t.overview, cover: "", coverUrl: t.coverUrl, visible: true, source: null }));
      up({ episodes: [...merged, ...created] });
      say?.(`Importati ${episodes.length} episodi da TMDB`);
    } catch (e) { alert(e.data?.error || "Import TMDB non riuscito"); }
  };
  return (
    <div className="box">
      <div className="row2">
        <input className="in sm" type="number" value={s.number} onChange={(e) => up({ number: +e.target.value })} />
        <input className="in" placeholder="Nome stagione (opzionale)" value={s.name || ""} onChange={(e) => up({ name: e.target.value })} />
        <button className="btn small" onClick={delSeason}><I.Trash size={16} /></button>
      </div>
      <Img value={s.cover} label="Copertina stagione" onChange={(cover) => up({ cover })} />
      <button className="btn small" onClick={importTmdb}>Importa episodi da TMDB</button>
      {eps.map((e) => (
        <div className="ep-edit" key={e.id}>
          <div className="row2">
            <input className="in sm" type="number" value={e.number} onChange={(ev) => upEp(e.id, { number: +ev.target.value })} />
            <input className="in" placeholder="Titolo episodio" value={e.title} onChange={(ev) => upEp(e.id, { title: ev.target.value })} />
          </div>
          <textarea className="in" rows={2} placeholder="Descrizione" value={e.overview || ""} onChange={(ev) => upEp(e.id, { overview: ev.target.value })} />
          <Img value={e.cover} url={e.coverUrl} label="Immagine episodio" onChange={(cover) => upEp(e.id, { cover })} />
          <input className="in" placeholder="Link messaggio del canale" value={e.source?.link || ""} onChange={(ev) => upEp(e.id, { source: ev.target.value ? srcFrom(ev.target.value) : null })} />
          <div className="row2">
            <button className="btn small" onClick={() => verify(e.source?.link)}><I.Eye size={16} /> Verifica</button>
            <label className="chk"><input type="checkbox" checked={e.visible !== false} onChange={(ev) => upEp(e.id, { visible: ev.target.checked })} /> Visibile</label>
            <button className="btn small" onClick={() => up({ episodes: s.episodes.filter((x) => x.id !== e.id) })}><I.Trash size={16} /></button>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={addEp}><I.Plus size={16} /> Episodio</button>
      <div className="row2">
        <input className="in" placeholder="Link primo episodio" value={r.a} onChange={(e) => setR({ ...r, a: e.target.value })} />
        <input className="in" placeholder="Link ultimo" value={r.b} onChange={(e) => setR({ ...r, b: e.target.value })} />
        <button className="btn small" onClick={addRange}><I.Plus size={16} /> Intervallo</button>
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
    setMsg(r.ok ? "Video inviato nella tua chat col bot: controlla che sia quello giusto" : "Errore: " + (r.error || "Errore"));
  };
  const save = async () => {
    if (!m.title.trim()) return alert("Inserisci un titolo");
    const bad = [m.source, ...(m.seasons || []).flatMap((s) => s.episodes.map((e) => e.source))].some((x) => x?.link && !x.messageId);
    if (bad) return alert("C'è un link non valido");
    try { await api("admin/media", { body: m }); } catch (e) { return alert(e.data?.error || "Errore nel salvataggio"); }
    onDone();
  };

  return (
    <div className="page">
      <h1>{m.id ? "Modifica" : "Nuovo contenuto"}</h1>
      <div className="row2">
        <select className="in" value={m.type} onChange={(e) => setType(e.target.value)}><option value="movie">Film</option><option value="series">Serie TV</option></select>
        <input className="in sm" placeholder="Anno" value={m.year || ""} onChange={(e) => set({ year: e.target.value })} />
        <input className="in" type="date" title="Data di uscita (solo per l'ordinamento, non visibile agli utenti)" value={m.releaseDate || ""} onChange={(e) => set({ releaseDate: e.target.value, year: e.target.value ? e.target.value.slice(0, 4) : m.year })} />
      </div>
      <div className="row2">
        <input className="in" placeholder="Titolo" value={m.title} onChange={(e) => set({ title: e.target.value })} />
        <button className="btn small" onClick={tmdb}>TMDB</button>
      </div>
      {res.map((r, i) => (
        <button key={i} className="btn tmdb" onClick={() => { set({ title: r.title, year: r.year, releaseDate: r.releaseDate, tmdbId: r.tmdbId, overview: r.overview, posterUrl: r.posterUrl, backdropUrl: r.backdropUrl, type: r.type, seasons: r.type === "series" && !m.seasons?.length ? [newSeason()] : m.seasons }); setRes([]); }}>
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
      </div>

      {m.type === "movie" ? (
        <>
          <h2>Video</h2>
          <input className="in" placeholder="Link del messaggio (https://t.me/c/…/45)" value={m.source?.link || ""} onChange={(e) => set({ source: e.target.value ? srcFrom(e.target.value) : null })} />
          <button className="btn small" onClick={() => verify(m.source?.link)}><I.Eye size={16} /> Verifica link</button>
        </>
      ) : (
        <>
          <h2>Stagioni ed episodi</h2>
          {[...(m.seasons || [])].sort((a, b) => a.number - b.number).map((s) => (
            <SeasonBlock key={s.id} s={s} up={(p) => upSeason(s.id, p)} verify={verify} tmdbId={m.tmdbId} say={setMsg}
              delSeason={async () => (await ask("Eliminare la stagione?")) && set({ seasons: m.seasons.filter((x) => x.id !== s.id) })} />
          ))}
          <button className="btn small" onClick={() => set({ seasons: [...(m.seasons || []), newSeason()] })}><I.Plus size={16} /> Stagione</button>
        </>
      )}
      {msg && <p className="msg">{msg}</p>}
      <div className="actions sticky"><button className="btn red" onClick={save}><I.Save size={16} /> Salva</button><button className="btn" onClick={onCancel}>Annulla</button></div>
    </div>
  );
}

// ---------- Categorie ----------
function Cats({ cats, media = [], reload }) {
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

  // titoli della categoria nell'ordine attuale: prima quelli ordinati a mano, poi per anno
  const orderedIn = (c) => {
    const o = c.mediaOrder || [], rel = byRelease("asc");
    return media.filter((m) => m.categoryIds?.includes(c.id)).sort((a, b) => {
      const x = o.indexOf(a.id), y = o.indexOf(b.id);
      return x >= 0 && y >= 0 ? x - y : x >= 0 ? -1 : y >= 0 ? 1 : rel(a, b);
    });
  };
  const moveTitle = (id, dir) => {
    const ids = orderedIn(edit).map((m) => m.id), i = ids.indexOf(id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setEdit({ ...edit, mediaOrder: ids });
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
          <label className="chk"><input type="checkbox" checked={edit.visible !== false} onChange={(e) => setEdit({ ...edit, visible: e.target.checked })} /> Visibile</label>
        </div>
        {edit.id && (
          <>
            <h2 className="sub">Ordine dei titoli</h2>
            {orderedIn(edit).map((m) => (
              <div className="item" key={m.id}>
                <b>{m.title}</b> <small>{m.year}</small>
                <div className="actions">
                  <button className="btn small" onClick={() => moveTitle(m.id, -1)}><I.ArrowUp size={16} /></button>
                  <button className="btn small" onClick={() => moveTitle(m.id, 1)}><I.ArrowDown size={16} /></button>
                </div>
              </div>
            ))}
            {(edit.mediaOrder?.length > 0) && <button className="btn small" onClick={() => setEdit({ ...edit, mediaOrder: [] })}>Ripristina ordine per anno</button>}
          </>
        )}
        <div className="actions"><button className="btn red" onClick={save}><I.Save size={16} /> Salva</button><button className="btn" onClick={() => setEdit(null)}>Annulla</button></div>
      </div>
    );
  }
  return (
    <div className="page">
      <button className="btn red" onClick={() => setEdit({ name: "", emoji: "", parentId: null, visible: true, showInHome: true })}><I.Plus size={16} /> Nuova categoria</button>
      {list.map((c) => (
        <div className="item" key={c.id} style={{ marginLeft: c.depth * 16 }}>
          <b>{c.emoji} {c.name}</b>{c.visible === false && <small> (nascosta)</small>}
          <div className="actions">
            <button className="btn small" onClick={() => move(c, -1)}><I.ArrowUp size={16} /></button>
            <button className="btn small" onClick={() => move(c, 1)}><I.ArrowDown size={16} /></button>
            <button className="btn small" onClick={() => setEdit({ name: "", emoji: "", parentId: c.id, visible: true, showInHome: false })}><I.Plus size={16} /> Sub</button>
            <button className="btn small" onClick={() => setEdit(c)}><I.Pencil size={16} /></button>
            <button className="btn small" onClick={() => del(c)}><I.Trash size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Statistiche ----------
const when = (ts) => new Date(ts).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const who = (x) => (x.username ? "@" + x.username : x.name || "utente");

function Stats() {
  const [s, setS] = useState(null);
  useEffect(() => { api("admin/stats").then(setS); }, []);
  if (!s) return <p className="hint">Carico…</p>;
  const max = Math.max(1, ...s.days.map((d) => d.sends));
  const sub = s.subscription;
  return (
    <div>
      <div className="stat-grid">
        {[[s.users, "Utenti totali"], [s.activeToday, "Attivi oggi"], [s.active7, "Attivi 7 giorni"], [s.newToday, "Nuovi oggi"],
          [s.sendsToday, "Video inviati oggi"], [s.sends7, "Video 7 giorni"], [s.sendsTotal, "Video totali"], [`${s.openRequests} / ${s.openReports}`, "Richieste / segnalazioni aperte"]]
          .map(([n, l]) => <div className="stat" key={l}><b>{n}</b><small>{l}</small></div>)}
      </div>
      <h2 className="sub">Video inviati, ultimi 7 giorni</h2>
      <div className="bars">
        {s.days.map((d) => (
          <div key={d.d} className="bcol"><span>{d.sends}</span><i style={{ height: 6 + (d.sends / max) * 70 }} /><small>{d.d.slice(8)}/{d.d.slice(5, 7)}</small></div>
        ))}
      </div>
      <h2 className="sub">Più guardati</h2>
      {s.top.map((t, i) => <div className="item" key={t.id}><b>{i + 1}. {t.title}</b> <small>{t.sends} invii</small></div>)}
      <h2 className="sub">Iscrizione obbligatoria</h2>
      <div className="box">
        {sub.state === "off" && "Non attiva. Imposta REQUIRED_CHANNEL su Netlify per attivarla."}
        {sub.state === "ok" && `Attiva su ${sub.channel}. Il controllo funziona.`}
        {sub.state === "error" && `Controllo non funzionante: ${sub.detail}. Aggiungi il bot come amministratore del canale ${sub.channel}.`}
      </div>
    </div>
  );
}

// ---------- Richieste e segnalazioni ----------
function Inbox({ kind }) {
  const [d, setD] = useState(null);
  const load = () => api("admin/inbox").then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <p className="hint">Carico…</p>;
  const list = [...(kind === "report" ? d.reports : d.requests)].sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || b.createdAt - a.createdAt);
  const toggleDone = async (it) => { await api("admin/inbox/status", { body: { kind, id: it.id, status: it.status === "done" ? "open" : "done" } }); load(); };
  const del = async (it) => { if (await ask("Eliminare?")) { await api(`admin/inbox/${kind}/${it.id}`, { method: "DELETE" }); load(); } };
  return (
    <>
      {list.map((it) => (
        <div className={"item" + (it.status === "done" ? " done" : "")} key={it.id}>
          {kind === "request"
            ? <b>{it.text}</b>
            : <><b>{it.title}{it.episodeLabel ? ` · ${it.episodeLabel}` : ""}</b><div className="hint">{d.reasons[it.reason]}{it.note ? ` — ${it.note}` : ""}</div></>}
          <small>{who(it)} · {when(it.createdAt)}</small>
          <div className="actions">
            <button className="btn small" onClick={() => toggleDone(it)}><I.Check size={16} /> {it.status === "done" ? "Riapri" : kind === "report" ? "Risolto" : "Aggiunto"}</button>
            <button className="btn small" onClick={() => del(it)}><I.Trash size={16} /></button>
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- Controllo link rotti ----------
function LinkCheck() {
  const [st, setSt] = useState(null); // { done, total, broken, running }
  const run = async () => {
    let from = 0, total = 1, broken = [];
    setSt({ done: 0, total: 0, broken: [], running: true });
    try {
      while (from < total) {
        const r = await api("admin/check-links", { body: { from, count: 4 } });
        total = r.total; from = r.next; broken = [...broken, ...r.broken];
        setSt({ done: Math.min(from, total), total, broken, running: from < total });
      }
    } catch (e) { alert(e.data?.error || "Controllo interrotto"); }
    setSt((x) => x && { ...x, running: false });
  };
  return (
    <>
      <button className="btn small" disabled={st?.running} onClick={run}>{st?.running ? `Controllo ${st.done}/${st.total}…` : "Controlla link rotti"}</button>
      {st && !st.running && <p className="hint">{st.broken.length ? `${st.broken.length} link da sistemare su ${st.total}` : `Tutti i ${st.total} link funzionano ✅`}</p>}
      {st?.broken.map((b, i) => <div className="item" key={i}><b>⚠️ {b.label}</b><small>{b.error} · <a href={b.link} target="_blank" rel="noreferrer">post</a></small></div>)}
    </>
  );
}

// ---------- Importa lista timeline (titoli in inglese) ----------
function ImportList({ media, onApply, hint = "Incolla un titolo per riga, nell'ordine cronologico.", applyLabel = "Applica ordine" }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const [tmdbOn, setTmdbOn] = useState(true);
  const [merged, setMerged] = useState(0);
  // Pulisce ogni riga: toglie numerazione, note tra parentesi e dopo il trattino lungo; l'anno (2008) resta come aiuto
  const clean = (line) => {
    let l = line.trim().replace(/^\d+[.)]\s+/, "").replace(/^[-•*]\s+/, "");
    l = l.replace(/\)\s+[–—]\s+.*$/, ")");
    let year = 0;
    for (;;) {
      const m = l.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
      if (!m) break;
      if (/^\d{4}$/.test(m[2].trim())) year = year || +m[2];
      l = m[1];
    }
    return { q: l.replace(/\s+[–—]\s+.*$/, "").trim(), year };
  };
  const parse = (t) => {
    const seen = new Set(), out = [];
    let lines = 0;
    for (const raw of t.split("\n")) {
      if (!raw.trim()) continue;
      lines++;
      const it = clean(raw);
      if (!it.q) continue;
      const k = it.q.toLowerCase();
      if (!seen.has(k)) { seen.add(k); out.push(it); }
    }
    return { out, merged: lines - out.length };
  };
  const run = async () => {
    const { out: items, merged } = parse(text);
    if (!items.length) return;
    setMerged(merged);
    setRows(null);
    const all = [];
    try {
      for (let i = 0; i < items.length; i += 8) {
        setBusy(`Analizzo ${Math.min(i + 8, items.length)} / ${items.length}…`);
        const r = await api("admin/timeline-match", { body: { items: items.slice(i, i + 8) } });
        setTmdbOn(r.tmdbOn);
        all.push(...r.results);
      }
      setRows(all);
    } catch { alert("Analisi non riuscita, riprova"); }
    setBusy("");
  };
  const setId = (i, id) => setRows(rows.map((r, k) => (k === i ? { ...r, id: id || null, how: id ? "manuale" : null } : r)));
  const by = Object.fromEntries(media.map((m) => [m.id, m]));
  const sorted = [...media].sort((a, b) => a.title.localeCompare(b.title));
  const label = (r) => `${r.tmdb?.title || r.q}${r.year || r.tmdb?.year ? ` (${r.year || r.tmdb.year})` : ""}`;
  const missing = rows ? rows.filter((r) => !r.id) : [];
  const ok = rows ? rows.filter((r) => r.id) : [];
  const listed = [...new Set(ok.map((r) => r.id))];
  return (
    <div className="box">
      <b>Importa lista (titoli in inglese)</b>
      <p className="hint">{hint} L'anno tra parentesi è facoltativo, es. Iron Man (2008).</p>
      <textarea className="in" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Captain America: The First Avenger\nCaptain Marvel\nIron Man"} />
      <button className="btn red small" disabled={!!busy || !text.trim()} onClick={run}>{busy || "Analizza"}</button>
      {rows && (
        <>
          <p className="hint">Abbinati {ok.length} su {rows.length}.{merged > 0 && ` ${merged} righe unite perché ripetute (una serie spezzata resta al punto della prima apparizione).`}{!tmdbOn && " TMDB non configurato: abbino solo i titoli identici."}</p>
          {missing.length > 0 && (
            <>
              <b>Da aggiungere ({missing.length})</b>
              {rows.map((r, i) => !r.id && (
                <div className="item" key={i}>
                  <b>{label(r)}</b>{r.tmdb?.it && r.tmdb.it !== r.tmdb.title && <small> · {r.tmdb.it}</small>}
                  <select className="in" value="" onChange={(e) => setId(i, e.target.value)}>
                    <option value="">Collega a un titolo già presente…</option>
                    {sorted.map((m) => <option key={m.id} value={m.id}>{m.title}{m.year ? ` (${m.year})` : ""}</option>)}
                  </select>
                </div>
              ))}
              <textarea className="in" rows={Math.min(8, missing.length + 1)} readOnly value={missing.map(label).join("\n")} onFocus={(e) => e.target.select()} />
            </>
          )}
          {ok.length > 0 && (
            <details>
              <summary>Abbinati ({ok.length})</summary>
              {rows.map((r, i) => r.id && by[r.id] && (
                <div className="item" key={i}>
                  <b>{r.q}</b> <small>→ {by[r.id].title} · {r.how}</small>
                  <div className="actions"><button className="btn small" onClick={() => setId(i, null)}><I.X size={16} /> Scollega</button></div>
                </div>
              ))}
            </details>
          )}
          <button className="btn red" disabled={!listed.length} onClick={() => onApply(listed)}><I.Check size={16} /> {applyLabel} ({listed.length} titoli)</button>
          {missing.length > 0 && <p className="hint">I mancanti restano fuori dall'ordine: aggiungili al catalogo e rilancia l'import.</p>}
        </>
      )}
    </div>
  );
}

// ---------- Ordine cronologico ----------
// Una voce è un titolo intero ("mediaId") oppure una singola stagione di una serie ("mediaId~seasonId")
function Timeline({ media, timeline = [], out: outInit = [], q = "", say, onDone }) {
  const rel = byRelease("asc");
  const by = Object.fromEntries(media.map((m) => [m.id, m]));
  const mOf = (k) => by[k.split("~")[0]];
  const sOf = (k) => { const sid = k.split("~")[1]; return sid ? mOf(k)?.seasons?.find((x) => x.id === sid) : null; };
  const valid = (k) => !!mOf(k) && (!k.includes("~") || !!sOf(k));
  const pos = (k) => { const i = timeline.indexOf(k); return i < 0 ? Infinity : i; };
  const [ids, setIds] = useState(() => [...media.map((m) => m.id), ...timeline.filter((k) => k.includes("~") && valid(k))].sort((a, b) => (pos(a) === pos(b) ? rel(mOf(a), mOf(b)) : pos(a) - pos(b))));
  const [dirty, setDirty] = useState(false);
  const [imp, setImp] = useState(false);
  const [pickM, setPickM] = useState("");
  const [pickS, setPickS] = useState("");
  const applyList = (listed) => { const set = new Set(listed); setIds([...listed, ...ids.filter((x) => !set.has(x))]); setDirty(true); setImp(false); say("Ordine applicato: premi Salva ordine"); };
  const [out, setOut] = useState(outInit);
  const toggleOut = (id) => { setOut(out.includes(id) ? out.filter((x) => x !== id) : [...out, id]); setDirty(true); };
  const move = (i, j) => {
    if (j < 0 || j >= ids.length || i === j) return;
    const a = [...ids]; const [x] = a.splice(i, 1); a.splice(j, 0, x);
    setIds(a); setDirty(true);
  };
  // aggiunge la stagione scelta subito dopo il titolo intero della serie
  const addSeason = () => {
    const key = `${pickM}~${pickS}`;
    if (!pickM || !pickS) return;
    if (ids.includes(key)) return say("Questa stagione è già in timeline");
    const a = [...ids], at = a.indexOf(pickM);
    let j = at < 0 ? a.length : at + 1;
    while (j < a.length && a[j].startsWith(pickM + "~")) j++; // dopo le altre stagioni già inserite
    a.splice(j, 0, key);
    setIds(a); setDirty(true); setPickS("");
    say("Stagione aggiunta: spostala nel punto giusto e premi Salva ordine");
  };
  const delSeason = (key) => { setIds(ids.filter((x) => x !== key)); setOut(out.filter((x) => x !== key)); setDirty(true); };
  const series = [...media].filter((m) => m.type === "series" && (m.seasons || []).length).sort((a, b) => a.title.localeCompare(b.title));
  const pickSeasons = [...(by[pickM]?.seasons || [])].sort((a, b) => a.number - b.number);
  const save = async () => { try { await api("admin/timeline", { body: { ids: ids.filter(valid), out: out.filter(valid) } }); setDirty(false); say("Ordine cronologico salvato"); onDone?.(); } catch { alert("Salvataggio non riuscito"); } };
  return (
    <>
      <p className="hint">Ordine cronologico (storia) della TIMELINE MARVEL: frecce, oppure scrivi la posizione e premi invio. Con "Escludi" una voce sparisce dalla timeline (sia cronologica sia di uscita). Per una serie puoi anche inserire una <b>singola stagione</b> in un punto preciso (es. Daredevil stagione 2): aggiungila qui sotto, poi escludi il titolo intero se non lo vuoi. Poi salva.</p>
      <button className="btn red small" disabled={!dirty} onClick={save}>Salva ordine</button>
      <button className="btn small" style={{ marginLeft: 8 }} onClick={() => setImp(!imp)}><I.Plus size={16} /> Importa lista</button>
      {imp && <ImportList media={media} onApply={applyList} />}
      <div className="box">
        <b>Aggiungi una stagione</b>
        <select className="in" value={pickM} onChange={(e) => { setPickM(e.target.value); setPickS(""); }}>
          <option value="">Scegli la serie…</option>
          {series.map((m) => <option key={m.id} value={m.id}>{m.title}{m.year ? ` (${m.year})` : ""}</option>)}
        </select>
        {pickM && (
          <select className="in" value={pickS} onChange={(e) => setPickS(e.target.value)}>
            <option value="">Scegli la stagione…</option>
            {pickSeasons.map((x) => <option key={x.id} value={x.id}>{x.name || `Stagione ${x.number}`}{ids.includes(`${pickM}~${x.id}`) ? " (già inserita)" : ""}</option>)}
          </select>
        )}
        <button className="btn small" disabled={!pickM || !pickS} onClick={addSeason}><I.Plus size={16} /> Aggiungi alla timeline</button>
      </div>
      {ids.map((id, i) => mOf(id) && matchQ(mOf(id), q) && (
        <div className="item" key={id} style={out.includes(id) ? { opacity: 0.45 } : undefined}>
          <input className="in sm" type="number" min="1" max={ids.length} defaultValue={i + 1} key={i + ":" + id} title="Posizione"
            onKeyDown={(e) => e.key === "Enter" && move(i, Math.min(ids.length, Math.max(1, +e.target.value || 1)) - 1)} />
          <b>{mOf(id).title}{sOf(id) ? ` · ${sOf(id).name || `Stagione ${sOf(id).number}`}` : ""}</b> <small>{mOf(id).year}</small>
          <div className="actions">
            <button className="btn small" onClick={() => toggleOut(id)}>{out.includes(id) ? "Includi" : "Escludi"}</button>
            <button className="btn small" onClick={() => move(i, i - 1)}><I.ArrowUp size={16} /></button>
            <button className="btn small" onClick={() => move(i, i + 1)}><I.ArrowDown size={16} /></button>
            {sOf(id) && <button className="btn small" onClick={() => delSeason(id)}><I.Trash size={16} /></button>}
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- Durate dei titoli (servono per le "ore viste") ----------
function Runtimes({ media, say, onDone }) {
  const [busy, setBusy] = useState("");
  const todo = media.filter((m) => !m.runtime);
  const run = async () => {
    const found = {};
    const flush = async () => { if (Object.keys(found).length) { await api("admin/runtimes", { body: { runtimes: { ...found } } }); Object.keys(found).forEach((k) => delete found[k]); } };
    let ok = 0;
    for (let i = 0; i < todo.length; i++) {
      const m = todo[i];
      setBusy(`TMDB ${i + 1}/${todo.length}…`);
      try {
        const qs = new URLSearchParams({ type: m.type, q: m.title, year: String(m.year || "").slice(0, 4) });
        if (m.tmdbId) qs.set("id", m.tmdbId);
        found[m.id] = (await api(`admin/tmdb-runtime?${qs}`)).minutes; ok++;
        if (Object.keys(found).length >= 10) await flush();
      } catch {}
    }
    try { await flush(); } catch {}
    setBusy("");
    say(`Durate trovate: ${ok} su ${todo.length}`);
    onDone?.();
  };
  return (
    <div className="box">
      <b>Durate per le ore viste</b>
      <p className="hint">{todo.length ? `${todo.length} titoli senza durata: le statistiche non li contano nelle ore.` : "Tutti i titoli hanno la durata."}</p>
      {todo.length > 0 && <button className="btn small" disabled={!!busy} onClick={run}>{busy || "↻ Prendi le durate da TMDB"}</button>}
    </div>
  );
}

// ---------- Visibilità di una novità ----------
function Vis({ k, features = {}, say, onDone, label = "Visibilità", def = "admin" }) {
  const cur = features[k] ?? def;
  const set = async (value) => { try { await api("admin/features", { body: { key: k, value } }); say(value === "all" ? "Ora è pubblica per tutti" : value === "admin" ? "Visibile solo agli admin" : "Nascosta"); onDone?.(); } catch { alert("Errore"); } };
  return (
    <div className="box">
      <b>{label}</b>
      <div className="chips">
        {[["off", "Nascosta"], ["admin", "Solo admin"], ["all", "Pubblica"]].map(([v, l]) => <button key={v} className={"chip" + (cur === v ? " on" : "")} onClick={() => set(v)}>{l}</button>)}
      </div>
      {cur !== "all" && <p className="hint">Gli utenti non la vedono. Quando è pronta, premi <b>Pubblica</b>.</p>}
    </div>
  );
}

// ---------- Road to Doomsday ----------
function DoomAdmin({ media, doom = {}, q = "", say, onDone }) {
  const [ids, setIds] = useState(doom.ids || []);
  const [mins, setMins] = useState(doom.minutes || {});
  const [date, setDate] = useState(doom.date || "2026-12-16");
  const [dirty, setDirty] = useState(false);
  const [imp, setImp] = useState(false);
  const [busy, setBusy] = useState("");
  const by = Object.fromEntries(media.map((m) => [m.id, m]));
  const mark = (fn) => (...a) => { fn(...a); setDirty(true); };
  const add = mark((id) => id && !ids.includes(id) && setIds([...ids, id]));
  const del = mark((id) => setIds(ids.filter((x) => x !== id)));
  const move = mark((i, j) => { if (j < 0 || j >= ids.length) return; const a = [...ids]; const [x] = a.splice(i, 1); a.splice(j, 0, x); setIds(a); });
  const setMin = mark((id, v) => setMins((p) => ({ ...p, [id]: Math.max(0, Math.round(Number(v) || 0)) })));
  // la lista importata diventa l'ordine: i progetti già presenti e non nella lista restano in fondo
  const applyList = (listed) => { const set = new Set(listed); setIds([...listed, ...ids.filter((x) => !set.has(x))]); setDirty(true); setImp(false); say("Lista applicata: premi Salva Road to Doomsday"); };
  // Durata da TMDB: cerca direttamente per titolo e anno, senza bisogno che il titolo sia già collegato a TMDB nel catalogo
  const getRuntime = async (m) => {
    const qs = new URLSearchParams({ type: m.type, q: m.title, year: String(m.year || "").slice(0, 4) });
    if (m.tmdbId) qs.set("id", m.tmdbId);
    return (await api(`admin/tmdb-runtime?${qs}`)).minutes;
  };
  const fromTmdb = async (m) => {
    try { setMin(m.id, await getRuntime(m)); }
    catch (e) { alert(e.data?.error || "Durata non trovata: scrivila a mano"); }
  };
  const fillMissing = async () => {
    const todo = ids.filter((id) => by[id] && !mins[id]);
    let ok = 0;
    for (let i = 0; i < todo.length; i++) {
      setBusy(`TMDB ${i + 1}/${todo.length}…`);
      try { setMin(todo[i], await getRuntime(by[todo[i]])); ok++; } catch {}
    }
    setBusy("");
    say(`Durate trovate: ${ok} su ${todo.length}`);
  };
  const total = ids.reduce((t, id) => t + (mins[id] || 0), 0);
  const missing = ids.filter((id) => by[id] && !mins[id]).length;
  const save = async () => { try { await api("admin/doomsday", { body: { ids, minutes: mins, date } }); setDirty(false); say("Road to Doomsday salvata"); onDone?.(); } catch { alert("Salvataggio non riuscito"); } };
  return (
    <>
      <p className="hint">Scegli i progetti da vedere prima di Avengers: Doomsday, nell'ordine consigliato, e indica la durata totale in minuti (il tasto TMDB la calcola da solo, anche se il titolo non è collegato a TMDB). La sezione resta visibile fino al 16 dicembre 2026.</p>
      <label className="hint">Data di uscita per il countdown (Italia)</label>
      <input className="in" type="date" value={date} onChange={(e) => { setDate(e.target.value); setDirty(true); }} />
      <select className="in" value="" onChange={(e) => add(e.target.value)}>
        <option value="">+ Aggiungi progetto…</option>
        {[...media].filter((m) => !ids.includes(m.id) && matchQ(m, q)).sort((a, b) => a.title.localeCompare(b.title)).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
      <p className="hint">{ids.length} progetti · {Math.floor(total / 60)}h {total % 60}m totali{missing > 0 && ` · ${missing} senza durata`}</p>
      <button className="btn red small" disabled={!dirty} onClick={save}>Salva Road to Doomsday</button>
      <button className="btn small" style={{ marginLeft: 8 }} onClick={() => setImp(!imp)}><I.Plus size={16} /> Importa lista</button>
      {missing > 0 && <button className="btn small" style={{ marginLeft: 8 }} disabled={!!busy} onClick={fillMissing}>{busy || "↻ Durate mancanti da TMDB"}</button>}
      {imp && <ImportList media={media} onApply={applyList} hint="Incolla un titolo per riga, nell'ordine in cui vanno visti." applyLabel="Applica lista" />}
      {ids.map((id, i) => by[id] && matchQ(by[id], q) && (
        <div className="item" key={id}>
          <b>{i + 1}. {by[id].title}</b>
          <div className="row2">
            <input className="in sm" type="number" min="0" placeholder="minuti" value={mins[id] || ""} onChange={(e) => setMin(id, e.target.value)} />
            <small>min</small>
            <button className="btn small" onClick={() => fromTmdb(by[id])}>↻ TMDB</button>
          </div>
          <div className="actions">
            <button className="btn small" onClick={() => move(i, i - 1)}><I.ArrowUp size={16} /></button>
            <button className="btn small" onClick={() => move(i, i + 1)}><I.ArrowDown size={16} /></button>
            <button className="btn small" onClick={() => del(id)}><I.Trash size={16} /></button>
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- Backup ----------
function Backup({ say }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await api("admin/backup", { body: {} }); say("Backup inviato nella chat col bot"); }
    catch (e) { alert(e.data?.error || "Backup non riuscito"); }
    setBusy(false);
  };
  return (
    <div className="box">
      <b>Backup del catalogo</b>
      <p className="hint">Il bot ti manda un file nella chat. Per ripristinarlo, rimandalo al bot con la didascalia <b>/ripristina</b>.</p>
      <button className="btn small" disabled={busy} onClick={run}>{busy ? "Invio…" : "Invia backup in chat"}</button>
    </div>
  );
}

// ---------- Anniversari ----------
function Anniv({ say }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const run = async () => {
    setBusy(true);
    try { setRes(await api("admin/anniv", { body: {} })); say("Ricerca completata"); }
    catch (e) { alert(e.data?.error || "Ricerca non riuscita"); }
    setBusy(false);
  };
  return (
    <div className="box">
      <b>Anniversari di uscita</b>
      <p className="hint">Ogni mattina il bot avvisa solo gli admin se oggi un titolo compie gli anni. Qui puoi forzare la ricerca subito: se c'è qualcosa, ti arriva in chat.</p>
      <button className="btn small" disabled={busy} onClick={run}>{busy ? "Cerco…" : "Forza ricerca"}</button>
      {res && (res.found.length
        ? <p className="hint">Oggi ({res.day}): {res.found.map((x) => `${x.title} (${x.years} ${x.years === 1 ? "anno" : "anni"})`).join(", ")}. Inviato in chat.</p>
        : <p className="hint">Nessun anniversario oggi ({res.day}). Contano solo i titoli con la data di uscita completa.</p>)}
    </div>
  );
}

// ---------- Da collegare (post del canale non riconosciuti con certezza) ----------
function AutoLink({ media, onDone }) {
  const [items, setItems] = useState(null);
  const [recent, setRecent] = useState([]);
  const [pick, setPick] = useState({}); // id -> { mediaId, episodeId }
  const load = () => api("admin/autolink").then((d) => { setRecent(d.recent || []); setItems(d.items); setPick(Object.fromEntries(d.items.map((x) => [x.id, { mediaId: x.mediaId || "", episodeId: x.episodeId || "" }]))); });
  useEffect(() => { load(); }, []);
  if (!items) return <p className="hint">Carico…</p>;
  const check = <LinkCheck />;
  const log = recent.length > 0 && (
    <>
      <h2 className="sub">Collegati di recente</h2>
      {[...recent].reverse().map((r, i) => <div className="item" key={i}><b>{r.saved === false ? "⚠️ " : "✅ "}{r.label}</b><small>{when(r.at)} · <a href={r.link} target="_blank" rel="noreferrer">post</a></small></div>)}
    </>
  );
  if (!items.length) return <>{check}<p className="hint">Nessun post da confermare 🎉</p>{log}</>;
  const epsOf = (mid) => { const m = media.find((x) => x.id === mid); return m?.type === "series" ? [...(m.seasons || [])].sort((a, b) => a.number - b.number).flatMap((s) => [...s.episodes].sort((a, b) => a.number - b.number).map((e) => ({ id: e.id, t: `S${s.number} E${e.number}${e.title ? " · " + e.title : ""}${e.source ? " (già collegato)" : ""}` }))) : null; };
  const set = (id, p) => setPick({ ...pick, [id]: { ...pick[id], ...p } });
  const confirm = async (it) => { try { await api("admin/autolink-confirm", { body: { id: it.id, ...pick[it.id] } }); await load(); onDone?.(); } catch (e) { alert(e.data?.error || "Errore"); } };
  const createTmdb = async (it) => { try { await api("admin/autolink-confirm", { body: { id: it.id, createFromTmdb: true } }); await load(); onDone?.(); } catch (e) { alert(e.data?.error || "Errore"); } };
  const dismiss = async (it) => { await api("admin/autolink-dismiss", { body: { id: it.id } }); load(); };
  return (
    <>
      {check}
      {items.map((it) => {
        const p = pick[it.id] || {}, eps = epsOf(p.mediaId);
        return (
          <div className="item" key={it.id}>
            <b>{it.text}</b>
            <div className="hint">{it.reason}{it.label ? ` — Suggerito: ${it.label}` : ""}</div>
            <small>{when(it.createdAt)} · <a href={it.link} target="_blank" rel="noreferrer">apri post</a></small>
            <select className="in" value={p.mediaId} onChange={(e) => set(it.id, { mediaId: e.target.value, episodeId: "" })}>
              <option value="">— Scegli titolo —</option>
              {[...media].sort((a, b) => a.title.localeCompare(b.title)).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            {eps && (
              <select className="in" value={p.episodeId} onChange={(e) => set(it.id, { episodeId: e.target.value })}>
                <option value="">— Scegli episodio —</option>
                {eps.map((e) => <option key={e.id} value={e.id}>{e.t}</option>)}
              </select>
            )}
            {it.tmdbSuggest && (
              <div className="hint">
                Suggerito da TMDB: <b>{it.tmdbSuggest.name}</b> {it.tmdbSuggest.year && `(${it.tmdbSuggest.year})`}
                <button className="btn small red" onClick={() => createTmdb(it)}>Crea serie e collega</button>
              </div>
            )}
            <div className="actions">
              <button className="btn small red" onClick={() => confirm(it)}><I.Check size={16} /> Conferma</button>
              <button className="btn small" onClick={() => dismiss(it)}><I.Trash size={16} /> Scarta</button>
            </div>
          </div>
        );
      })}
      {log}
    </>
  );
}

// ricerca progetti (titolo + anno, senza accenti né punteggiatura)
const nz = (t = "") => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const matchQ = (m, q) => !q || !q.trim() || nz(m.title + " " + (m.year || "")).includes(nz(q));

// ---------- Pannello ----------
export default function Admin({ say, onChange }) {
  const [tab, setTab] = useState("media");
  const [q, setQ] = useState("");
  useEffect(() => setQ(""), [tab]);
  const [db, setDb] = useState(null);
  const [form, setForm] = useState(null);
  const shown = (db?.media || []).filter((m) => matchQ(m, q)).sort((a, b) => b.createdAt - a.createdAt);
  const reload = () => api("admin/catalog").then((d) => { setDb(d); onChange?.(); });
  useEffect(() => { api("admin/catalog").then(setDb).catch(() => say("Accesso negato")); }, []);
  if (!db) return <div className="page">Carico…</div>;
  if (form)
    return <MediaForm init={form} cats={db.categories} onCancel={() => setForm(null)} onDone={() => { setForm(null); reload(); say("Salvato"); }} />;

  const del = async (m) => { if (await ask(`Eliminare «${m.title}»?`)) { await api("admin/media/" + m.id, { method: "DELETE" }); reload(); } };
  return (
    <div className="page">
      <h1>Admin <span className="badge">ADMIN</span></h1>
      <div className="chips">
        <button className={"chip" + (tab === "media" ? " on" : "")} onClick={() => setTab("media")}>Contenuti</button>
        <button className={"chip" + (tab === "cats" ? " on" : "")} onClick={() => setTab("cats")}>Categorie</button>
        <button className={"chip" + (tab === "timeline" ? " on" : "")} onClick={() => setTab("timeline")}>Timeline</button>
        <button className={"chip" + (tab === "doom" ? " on" : "")} onClick={() => setTab("doom")}>Doomsday</button>
        <button className={"chip" + (tab === "autolink" ? " on" : "")} onClick={() => setTab("autolink")}>Da collegare</button>
        <button className={"chip" + (tab === "requests" ? " on" : "")} onClick={() => setTab("requests")}>Richieste</button>
        <button className={"chip" + (tab === "reports" ? " on" : "")} onClick={() => setTab("reports")}>Segnalazioni</button>
        <button className={"chip" + (tab === "stats" ? " on" : "")} onClick={() => setTab("stats")}>Statistiche</button>
      </div>
      {db && ["media", "timeline", "doom"].includes(tab) && <input className="in" placeholder={`Cerca tra ${db.media.length} progetti…`} value={q} onChange={(e) => setQ(e.target.value)} />}
      {tab === "cats" ? <Cats cats={db.categories} media={db.media} reload={reload} /> : tab === "stats" ? <><Vis k="stats" label="Statistiche personali" features={db.features} say={say} onDone={reload} /><Vis k="wrap" label="MCU Wrapped (lancio manuale)" def="off" features={db.features} say={say} onDone={reload} /><Runtimes media={db.media} say={say} onDone={reload} /><Stats /><Backup say={say} /><Anniv say={say} /></> : tab === "timeline" ? <><Vis k="timeline" features={db.features} say={say} onDone={reload} /><Timeline media={db.media} timeline={db.timeline} out={db.timelineOut} q={q} say={say} onDone={reload} /></> : tab === "doom" ? <><Vis k="doom" features={db.features} say={say} onDone={reload} /><DoomAdmin media={db.media} doom={db.doomsday} q={q} say={say} onDone={reload} /></> : tab === "autolink" ? <AutoLink media={db.media} onDone={reload} /> : tab === "requests" ? <Inbox kind="request" /> : tab === "reports" ? <Inbox kind="report" /> : (
        <>
          <button className="btn red" onClick={() => setForm({ type: "movie", title: "", year: "", overview: "", categoryIds: [], visible: true, featured: false, seasons: [], source: null })}><I.Plus size={16} /> Aggiungi contenuto</button>
          {q.trim() && !shown.length && <p className="hint">Nessun progetto trovato.</p>}
          {shown.map((m) => (
            <div className="item" key={m.id}>
              <b>{m.title}</b> <small>{m.type === "movie" ? "Film" : `Serie · ${m.seasons?.reduce((n, s) => n + s.episodes.length, 0)} ep.`}{m.visible === false ? " · nascosto" : ""}</small>
              <div className="actions"><button className="btn small" onClick={() => setForm(m)}><I.Pencil size={16} /> Modifica</button><button className="btn small" onClick={() => del(m)}><I.Trash size={16} /></button></div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
