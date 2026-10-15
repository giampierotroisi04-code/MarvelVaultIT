import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import { parseLink } from "../../src/lib/util.js";

export const config = { path: "/api/*" };

// Legge le variabili d'ambiente (Netlify.env o process.env) e toglie spazi/a capo invisibili
for (const k of ["BOT_TOKEN", "WEBHOOK_SECRET", "ADMIN_IDS", "BOT_USERNAME", "SITE_URL", "REQUIRED_CHANNEL", "TMDB_API_KEY", "PROTECT_CONTENT", "MAX_SENDS_PER_MIN"]) {
  let v;
  try { v = globalThis.Netlify?.env?.get(k); } catch {}
  v = v ?? process.env[k];
  if (v) process.env[k] = String(v).trim();
}

let SITE = "";
const store = () => getStore({ name: "vault", consistency: "strong" });
const json = (d, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const uid = () => crypto.randomBytes(5).toString("hex");
const admins = () => (process.env.ADMIN_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);

// ---------- Auth: validazione initData di Telegram ----------
function checkInitData(initData) {
  if (!initData || !process.env.BOT_TOKEN) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get("hash");
  p.delete("hash");
  const str = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
  const calc = crypto.createHmac("sha256", secret).update(str).digest("hex");
  if (calc !== hash) return null;
  if (Date.now() / 1000 - Number(p.get("auth_date")) > 86400) return null;
  try { return JSON.parse(p.get("user")); } catch { return null; }
}

// ---------- Telegram ----------
const tg = (method, body) =>
  fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const flat = (m) =>
  [...(m.seasons || [])].sort((a, b) => a.number - b.number)
    .flatMap((s) => [...s.episodes].sort((a, b) => a.number - b.number))
    .filter((e) => e.visible !== false && e.source);

function keyboard(m, ep) {
  const rows = [];
  if (m.type === "series" && ep) rows.push([{ text: "⏭ Prossimo episodio", callback_data: `n:${m.id}:${ep.id}` }]);
  rows.push([{ text: "📋 Catalogo", web_app: { url: SITE } }]);
  return { inline_keyboard: rows };
}

// Didascalia: NOME (+ titolo episodio se serie), riga vuota, firma del canale
const TAIL = "\n\n\u{1F9B8}\u{1F3FB}\u200D\u2642\uFE0F @Marvel_Italia\n#\uFE0F\u20E3 #MarvelStudios #Marvel";
function captionFor(m, ep) {
  let head = m.title || "";
  if (ep) {
    const seasons = m.seasons || [];
    const season = seasons.find((s) => s.episodes.some((e) => e.id === ep.id));
    // stagione mostrata solo se la serie ne ha più di una
    const num = seasons.length > 1 && season ? `S${season.number} · E${ep.number}` : `E${ep.number}`;
    const t = (ep.title || "").trim();
    head = `${m.title} - ${num}${t ? " · " + t : ""}`;
  }
  return head.slice(0, 1024 - TAIL.length) + TAIL;
}

// copyMessage: il bot (admin del canale) copia il video nella chat dell'utente
function sendVideo(chatId, m, ep) {
  const src = ep ? ep.source : m.source;
  if (!src?.messageId) return Promise.resolve({ ok: false, description: "Nessun link collegato" });
  return tg("copyMessage", {
    chat_id: chatId,
    from_chat_id: src.channelId,
    message_id: src.messageId,
    caption: captionFor(m, ep),
    protect_content: process.env.PROTECT_CONTENT === "true",
    reply_markup: keyboard(m, ep),
  });
}

// ---------- Rate limit (best effort, in memoria) ----------
const hits = new Map();
function limited(id) {
  const now = Date.now(), max = Number(process.env.MAX_SENDS_PER_MIN || 6);
  const arr = (hits.get(id) || []).filter((t) => now - t < 60000);
  if (arr.length >= max) return true;
  arr.push(now); hits.set(id, arr);
  return false;
}

// ---------- Database (Netlify Blobs) ----------
const getDb = async () => (await store().get("catalog", { type: "json" })) || { media: [], categories: [] };
const saveDb = (db) => store().setJSON("catalog", db);
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
const toDay = (ts) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
const who = (u) => (u.username ? "@" + u.username : u.first_name || u.name || "utente");
const getStats = async () => (await store().get("stats", { type: "json" })) || { users: {}, days: {}, media: {} };
const saveStats = (s) => store().setJSON("stats", s);
const getInbox = async () => (await store().get("inbox", { type: "json" })) || { requests: [], reports: [] };
const saveInbox = (i) => store().setJSON("inbox", i);
const REASONS = { no_play: "Il video non parte", audio: "Audio o sottotitoli", quality: "Qualità scadente", wrong: "Contenuto sbagliato", other: "Altro" };

const notifyAdmins = (text) =>
  Promise.all(admins().map((id) =>
    tg("sendMessage", { chat_id: id, text, reply_markup: { inline_keyboard: [[{ text: "Apri pannello admin", web_app: { url: SITE + "/?admin=1" } }]] } }).catch(() => {})));

// ---------- Iscrizione obbligatoria al canale ----------
const subCache = new Map();
async function isSubscribed(userId) {
  const ch = process.env.REQUIRED_CHANNEL;
  if (!ch) return { ok: true };
  const c = subCache.get(userId);
  if (c && Date.now() - c.t < 5 * 60000) return { ok: true };
  const r = await tg("getChatMember", { chat_id: ch, user_id: userId });
  if (!r.ok) { console.warn("getChatMember:", r.description); return { ok: true, error: r.description }; } // se il controllo non funziona, non blocca nessuno
  const st = r.result.status;
  const ok = ["member", "administrator", "creator"].includes(st) || (st === "restricted" && r.result.is_member);
  if (ok) subCache.set(userId, { t: Date.now() });
  return { ok };
}

// ---------- Statistiche ----------
async function touch(user) {
  const st = await getStats(), now = Date.now(), u = st.users[user.id];
  if (u && now - u.l < 30 * 60000) return;
  st.users[user.id] = { n: user.first_name || "", u: user.username || "", f: u?.f || now, l: now, s: u?.s || 0 };
  await saveStats(st);
}
async function recordSend(user, m) {
  const st = await getStats(), now = Date.now(), d = today();
  const u = st.users[user.id] || { n: user.first_name || "", u: user.username || "", f: now, l: now, s: 0 };
  u.s++; u.l = now; st.users[user.id] = u;
  st.days[d] = { s: (st.days[d]?.s || 0) + 1 };
  const mm = st.media[m.id] || { t: m.title, s: 0 };
  mm.t = m.title; mm.s++; mm.l = now; st.media[m.id] = mm;
  Object.keys(st.days).sort().slice(0, -90).forEach((k) => delete st.days[k]);
  await saveStats(st);
}

const getUser = async (id) => (await store().get(`user:${id}`, { type: "json" })) || { watchlist: [], watched: [] };

const pub = (m) => ({
  ...m,
  source: undefined,
  hasVideo: !!m.source,
  seasons: (m.seasons || []).map((s) => ({
    ...s,
    episodes: s.episodes.filter((e) => e.visible !== false).map((e) => ({ ...e, source: undefined, hasVideo: !!e.source })),
  })),
});

function deleteCategory(db, id, mode) {
  const cat = db.categories.find((c) => c.id === id);
  if (!cat) return;
  const removed = new Set([id]);
  if (mode === "cascade") {
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of db.categories)
        if (c.parentId && removed.has(c.parentId) && !removed.has(c.id)) { removed.add(c.id); grew = true; }
    }
  } else {
    db.categories.forEach((c) => { if (c.parentId === id) c.parentId = cat.parentId || null; });
  }
  db.categories = db.categories.filter((c) => !removed.has(c.id));
  // I contenuti NON vengono mai cancellati: passano alla categoria superiore (o restano senza categoria)
  db.media.forEach((m) => {
    m.categoryIds = [...new Set((m.categoryIds || [])
      .map((x) => (removed.has(x) ? (mode === "keep" ? cat.parentId : null) : x))
      .filter(Boolean))];
  });
}

// ---------- Bot webhook ----------
async function bot(req) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== process.env.WEBHOOK_SECRET)
    return json({ ok: false }, 403);
  try {
    const u = await req.json();
    const msg = u.message;
    if (msg?.text) {
      const chat = msg.chat.id;
      if (msg.text.startsWith("/start"))
        await tg("sendMessage", {
          chat_id: chat,
          text: "🦸 Benvenuto in MARVEL ITALIA STREAMING!\nApri il catalogo qui sotto.",
          reply_markup: { inline_keyboard: [[{ text: "▶ Apri Marvel Italia Streaming", web_app: { url: SITE } }]] },
        });
      else if (msg.text.startsWith("/admin") && admins().includes(String(msg.from.id)))
        await tg("sendMessage", {
          chat_id: chat,
          text: "⚙️ Pannello admin",
          reply_markup: { inline_keyboard: [[{ text: "Apri Admin", web_app: { url: SITE + "/?admin=1" } }]] },
        });
    }
    const cb = u.callback_query;
    if (cb?.data?.startsWith("n:")) {
      const [, mid, eid] = cb.data.split(":");
      const db = await getDb();
      const m = db.media.find((x) => x.id === mid);
      const eps = m ? flat(m) : [];
      const i = eps.findIndex((e) => e.id === eid);
      const next = i >= 0 ? eps[i + 1] : null;
      if (!next) await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Era l'ultimo episodio 🎬" });
      else if (limited(cb.from.id)) await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Piano! Riprova tra poco" });
      else if (!admins().includes(String(cb.from.id)) && !(await isSubscribed(cb.from.id)).ok)
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Iscriviti al canale per continuare", show_alert: true });
      else {
        await tg("answerCallbackQuery", { callback_query_id: cb.id });
        const r = await sendVideo(cb.from.id, m, next);
        if (r.ok && !admins().includes(String(cb.from.id))) await recordSend(cb.from, m).catch(() => {});
      }
    }
  } catch (e) { console.error("bot error", e); }
  return json({ ok: true });
}

// ---------- Router ----------
export default async (req) => {
  const url = new URL(req.url);
  SITE = (process.env.SITE_URL || url.origin).replace(/\/$/, "");
  const [a, b, c, d] = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);

  if (a === "bot") return bot(req);

  if (a === "setup") { // apri UNA volta: /api/setup?key=WEBHOOK_SECRET
    if (url.searchParams.get("key") !== process.env.WEBHOOK_SECRET)
      return json({ error: "forbidden", secretSet: !!process.env.WEBHOOK_SECRET, secretLength: (process.env.WEBHOOK_SECRET || "").length, keyLength: (url.searchParams.get("key") || "").length, tokenSet: !!process.env.BOT_TOKEN }, 403);
    const w = await tg("setWebhook", { url: SITE + "/api/bot", secret_token: process.env.WEBHOOK_SECRET, allowed_updates: ["message", "callback_query"] });
    const mb = await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Marvel Italia Streaming", web_app: { url: SITE } } });
    return json({ webhook: w, menu: mb });
  }

  if (a === "img" && b) { // le immagini sono pubbliche (servono ai tag <img>)
    if (!/^[a-f0-9]{10}$/.test(b)) return json({ error: "bad id" }, 400);
    const r = await store().getWithMetadata(`img:${b}`, { type: "arrayBuffer" });
    if (!r) return new Response("not found", { status: 404 });
    return new Response(r.data, { headers: { "content-type": r.metadata?.type || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
  }

  const user = checkInitData(req.headers.get("x-init-data"));
  if (!user) return json({ error: "unauthorized" }, 401);
  const isAdmin = admins().includes(String(user.id));

  if (a === "me") {
    const sub = isAdmin ? { ok: true } : await isSubscribed(user.id);
    if (!isAdmin) await touch(user).catch(() => {});
    return json({ user: { id: user.id, name: user.first_name }, isAdmin, botUsername: process.env.BOT_USERNAME || "", subscribed: sub.ok, channel: process.env.REQUIRED_CHANNEL || "" });
  }

  // tutto il resto richiede l'iscrizione al canale (gli admin sono esclusi)
  if (!isAdmin && !(await isSubscribed(user.id)).ok) return json({ error: "not_subscribed" }, 403);

  if (a === "catalog") {
    const db = await getDb();
    return json({
      media: db.media.filter((m) => m.visible !== false).map(pub),
      categories: db.categories.filter((x) => x.visible !== false),
      user: await getUser(user.id),
    });
  }

  if (a === "toggle" && req.method === "POST") {
    const { kind, id } = await req.json();
    if (!["watchlist", "watched"].includes(kind) || !id) return json({ error: "bad request" }, 400);
    const u = await getUser(user.id);
    const set = new Set(u[kind]);
    set.has(id) ? set.delete(id) : set.add(id);
    u[kind] = [...set];
    await store().setJSON(`user:${user.id}`, u);
    return json(u);
  }

  if (a === "watch" && req.method === "POST") {
    const { mediaId, episodeId } = await req.json();
    const db = await getDb();
    const m = db.media.find((x) => x.id === mediaId && (x.visible !== false || isAdmin));
    const ep = episodeId ? m?.seasons?.flatMap((s) => s.episodes).find((e) => e.id === episodeId) : null;
    if (!m || (episodeId && !ep)) return json({ error: "not_found" }, 404);
    if (limited(user.id)) return json({ error: "rate" }, 429);
    const r = await sendVideo(user.id, m, ep);
    if (!r.ok) return json({ error: r.error_code === 403 ? "start_required" : "send_failed", detail: r.description }, 400);
    if (!isAdmin) await recordSend(user, m).catch(() => {});
    return json({ ok: true });
  }

  // ---------- Richiesta titolo ----------
  if (a === "request" && req.method === "POST") {
    const { text } = await req.json();
    const t = String(text || "").trim().slice(0, 120);
    if (t.length < 2) return json({ error: "bad request" }, 400);
    const inbox = await getInbox(), now = Date.now();
    if (inbox.requests.filter((r) => r.userId === user.id && now - r.createdAt < 864e5).length >= 5) return json({ error: "limit" }, 429);
    inbox.requests.unshift({ id: uid(), userId: user.id, name: user.first_name || "", username: user.username || "", text: t, status: "open", createdAt: now });
    inbox.requests = inbox.requests.slice(0, 300);
    await saveInbox(inbox);
    await notifyAdmins(`Nuova richiesta\n"${t}"\nda ${who(user)}`);
    return json({ ok: true });
  }

  // ---------- Segnalazione problema ----------
  if (a === "report" && req.method === "POST") {
    const { mediaId, episodeId, reason, note } = await req.json();
    if (!REASONS[reason]) return json({ error: "bad request" }, 400);
    const db = await getDb();
    const m = db.media.find((x) => x.id === mediaId);
    if (!m) return json({ error: "not_found" }, 404);
    let epLabel = "";
    if (episodeId) for (const s of m.seasons || []) { const e = s.episodes.find((x) => x.id === episodeId); if (e) epLabel = `S${s.number} E${e.number}${e.title ? " – " + e.title : ""}`; }
    const inbox = await getInbox(), now = Date.now();
    if (inbox.reports.filter((r) => r.userId === user.id && now - r.createdAt < 864e5).length >= 10) return json({ error: "limit" }, 429);
    const n = String(note || "").trim().slice(0, 300);
    inbox.reports.unshift({ id: uid(), userId: user.id, name: user.first_name || "", username: user.username || "", mediaId, title: m.title, episodeId: episodeId || "", episodeLabel: epLabel, reason, note: n, status: "open", createdAt: now });
    inbox.reports = inbox.reports.slice(0, 300);
    await saveInbox(inbox);
    await notifyAdmins(`Segnalazione: ${m.title}${epLabel ? " (" + epLabel + ")" : ""}\nMotivo: ${REASONS[reason]}${n ? "\nNota: " + n : ""}\nda ${who(user)}`);
    return json({ ok: true });
  }

  // ---------- SOLO ADMIN (controllo nel backend) ----------
  if (a === "admin") {
    if (!isAdmin) { console.warn("admin negato per", user.id); return json({ error: "forbidden" }, 403); }

    if (b === "catalog") return json(await getDb());

    if (b === "verify" && req.method === "POST") {
      const { link } = await req.json();
      const p = parseLink(link);
      if (!p) return json({ ok: false, error: "Link non valido" });
      const r = await tg("copyMessage", { chat_id: user.id, from_chat_id: p.channelId, message_id: p.messageId });
      if (r.ok) return json({ ok: true });
      const d = r.description || "";
      const error = /chat not found/i.test(d) ? "Il bot non è admin del canale"
        : /message to copy not found|MESSAGE_ID_INVALID/i.test(d) ? "Messaggio inesistente o cancellato"
        : /can't initiate|Forbidden/i.test(d) ? "Premi START sul bot e riprova" : d;
      return json({ ok: false, error });
    }

    if (b === "media" && req.method === "POST") {
      const body = await req.json();
      const db = await getDb();
      const i = db.media.findIndex((x) => x.id === body.id);
      const m = {
        ...body,
        id: body.id || uid(),
        createdAt: i >= 0 ? db.media[i].createdAt : Date.now(),
        categoryIds: body.categoryIds || [],
        seasons: body.type === "series" ? body.seasons || [] : [],
        source: body.type === "movie" ? body.source || null : null,
      };
      if (m.featured) db.media.forEach((x) => { if (x.id !== m.id) x.featured = false; }); // un solo "in evidenza"
      i >= 0 ? (db.media[i] = m) : db.media.push(m);
      await saveDb(db);
      return json(m);
    }
    if (b === "media" && c && req.method === "DELETE") {
      const db = await getDb();
      db.media = db.media.filter((x) => x.id !== c);
      await saveDb(db);
      return json({ ok: true });
    }

    if (b === "category" && req.method === "POST") {
      const body = await req.json();
      if (!String(body.name || "").trim()) return json({ error: "Nome mancante" }, 400);
      const db = await getDb();
      const i = db.categories.findIndex((x) => x.id === body.id);
      const cat = {
        id: body.id || uid(),
        parentId: body.parentId || null,
        name: String(body.name).trim().slice(0, 60),
        emoji: body.emoji || "",
        cover: body.cover || "",
        showInHome: !!body.showInHome,
        visible: body.visible !== false,
        order: i >= 0 ? db.categories[i].order : Math.max(0, ...db.categories.map((x) => x.order || 0)) + 1,
      };
      i >= 0 ? (db.categories[i] = cat) : db.categories.push(cat);
      await saveDb(db);
      return json(cat);
    }
    if (b === "category" && c && req.method === "DELETE") {
      const db = await getDb();
      deleteCategory(db, c, url.searchParams.get("mode") === "cascade" ? "cascade" : "keep");
      await saveDb(db);
      return json({ ok: true });
    }
    if (b === "reorder" && req.method === "POST") {
      const { ids } = await req.json();
      const db = await getDb();
      ids.forEach((id, n) => { const x = db.categories.find((k) => k.id === id); if (x) x.order = n; });
      await saveDb(db);
      return json({ ok: true });
    }

    if (b === "image" && req.method === "POST") {
      const { dataUrl } = await req.json();
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || "");
      if (!m) return json({ error: "Formato non valido" }, 400);
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 4 * 1024 * 1024) return json({ error: "Immagine troppo grande" }, 400);
      const id = uid();
      await store().set(`img:${id}`, buf, { metadata: { type: m[1] } });
      return json({ id });
    }

    if (b === "stats") {
      const st = await getStats(), inbox = await getInbox(), now = Date.now(), DAY = 864e5, d0 = today();
      const us = Object.values(st.users);
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const k = toDay(now - i * DAY);
        days.push({ d: k, sends: st.days[k]?.s || 0, newUsers: us.filter((u) => toDay(u.f) === k).length });
      }
      let subscription = { state: "off" };
      if (process.env.REQUIRED_CHANNEL) {
        const r = await tg("getChatMember", { chat_id: process.env.REQUIRED_CHANNEL, user_id: user.id });
        subscription = r.ok ? { state: "ok", channel: process.env.REQUIRED_CHANNEL } : { state: "error", channel: process.env.REQUIRED_CHANNEL, detail: r.description };
      }
      return json({
        users: us.length,
        activeToday: us.filter((u) => toDay(u.l) === d0).length,
        active7: us.filter((u) => now - u.l < 7 * DAY).length,
        newToday: us.filter((u) => toDay(u.f) === d0).length,
        sendsToday: st.days[d0]?.s || 0,
        sends7: days.reduce((n, x) => n + x.sends, 0),
        sendsTotal: us.reduce((n, u) => n + (u.s || 0), 0),
        days,
        top: Object.entries(st.media).sort((x, y) => y[1].s - x[1].s).slice(0, 10).map(([id, x]) => ({ id, title: x.t, sends: x.s })),
        openRequests: inbox.requests.filter((r) => r.status === "open").length,
        openReports: inbox.reports.filter((r) => r.status === "open").length,
        subscription,
      });
    }

    if (b === "inbox" && !c && req.method === "GET") return json({ ...(await getInbox()), reasons: REASONS });
    if (b === "inbox" && c === "status" && req.method === "POST") {
      const { kind, id, status } = await req.json();
      const inbox = await getInbox();
      const it = (kind === "report" ? inbox.reports : inbox.requests).find((x) => x.id === id);
      if (!it || !["open", "done"].includes(status)) return json({ error: "not_found" }, 404);
      if (status === "done" && it.status !== "done")
        await tg("sendMessage", { chat_id: it.userId, text: kind === "report" ? `Abbiamo risolto la segnalazione su "${it.title}". Grazie!` : `Il titolo che hai richiesto, "${it.text}", è stato aggiunto. Cercalo nell'app!` }).catch(() => {});
      it.status = status;
      await saveInbox(inbox);
      return json({ ok: true });
    }
    if (b === "inbox" && (c === "request" || c === "report") && d && req.method === "DELETE") {
      const inbox = await getInbox();
      const key = c === "report" ? "reports" : "requests";
      inbox[key] = inbox[key].filter((x) => x.id !== d);
      await saveInbox(inbox);
      return json({ ok: true });
    }

    if (b === "tmdb") {
      const key = process.env.TMDB_API_KEY;
      if (!key) return json({ error: "TMDB non configurato" }, 400);
      const q = url.searchParams.get("q") || "";
      const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${key}&language=it-IT&query=${encodeURIComponent(q)}`).then((x) => x.json());
      const img = (p, w) => (p ? `https://image.tmdb.org/t/p/${w}${p}` : "");
      return json({
        results: (r.results || []).filter((x) => x.media_type === "movie" || x.media_type === "tv").slice(0, 8).map((x) => ({
          title: x.title || x.name,
          tmdbId: x.id,
          releaseDate: x.release_date || x.first_air_date || "",
          year: (x.release_date || x.first_air_date || "").slice(0, 4),
          overview: x.overview,
          type: x.media_type === "movie" ? "movie" : "series",
          posterUrl: img(x.poster_path, "w500"),
          backdropUrl: img(x.backdrop_path, "w780"),
        })),
      });
    }

    if (b === "tmdb-season") {
      const key = process.env.TMDB_API_KEY;
      if (!key) return json({ error: "TMDB non configurato" }, 400);
      const id = encodeURIComponent(url.searchParams.get("id") || "");
      const n = encodeURIComponent(url.searchParams.get("season") || "1");
      const get = (lang) => fetch(`https://api.themoviedb.org/3/tv/${id}/season/${n}?api_key=${key}&language=${lang}`).then((x) => x.json());
      const [it, en] = await Promise.all([get("it-IT"), get("en-US")]);
      if (!it.episodes && !en.episodes) return json({ error: "Stagione non trovata su TMDB" }, 404);
      const enBy = new Map((en.episodes || []).map((e) => [e.episode_number, e]));
      return json({
        episodes: (it.episodes || en.episodes).map((e) => {
          const f = enBy.get(e.episode_number) || {};
          return {
            number: e.episode_number,
            title: e.name || f.name || "",
            overview: e.overview || f.overview || "", // fallback in inglese se manca in italiano
            coverUrl: e.still_path || f.still_path ? `https://image.tmdb.org/t/p/w780${e.still_path || f.still_path}` : "",
            airDate: e.air_date || "",
          };
        }),
      });
    }
  }

  return json({ error: "not_found" }, 404);
};
