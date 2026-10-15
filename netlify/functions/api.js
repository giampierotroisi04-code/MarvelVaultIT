import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import { parseLink } from "../../src/lib/util.js";

export const config = { path: "/api/*" };

// Legge le variabili d'ambiente (Netlify.env o process.env) e toglie spazi/a capo invisibili
for (const k of ["BOT_TOKEN", "WEBHOOK_SECRET", "ADMIN_IDS", "BOT_USERNAME", "SITE_URL", "TMDB_API_KEY", "PROTECT_CONTENT", "MAX_SENDS_PER_MIN"]) {
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
    const season = (m.seasons || []).find((s) => s.episodes.some((e) => e.id === ep.id));
    const t = (ep.title || "").trim() || `Stagione ${season?.number ?? ""} · Episodio ${ep.number}`;
    head = `${m.title} - ${t}`;
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
      else { await tg("answerCallbackQuery", { callback_query_id: cb.id }); await sendVideo(cb.from.id, m, next); }
    }
  } catch (e) { console.error("bot error", e); }
  return json({ ok: true });
}

// ---------- Router ----------
export default async (req) => {
  const url = new URL(req.url);
  SITE = (process.env.SITE_URL || url.origin).replace(/\/$/, "");
  const [a, b, c] = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);

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

  if (a === "me") return json({ user: { id: user.id, name: user.first_name }, isAdmin, botUsername: process.env.BOT_USERNAME || "" });

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

    if (b === "tmdb") {
      const key = process.env.TMDB_API_KEY;
      if (!key) return json({ error: "TMDB non configurato" }, 400);
      const q = url.searchParams.get("q") || "";
      const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${key}&language=it-IT&query=${encodeURIComponent(q)}`).then((x) => x.json());
      const img = (p, w) => (p ? `https://image.tmdb.org/t/p/${w}${p}` : "");
      return json({
        results: (r.results || []).filter((x) => x.media_type === "movie" || x.media_type === "tv").slice(0, 8).map((x) => ({
          title: x.title || x.name,
          year: (x.release_date || x.first_air_date || "").slice(0, 4),
          overview: x.overview,
          type: x.media_type === "movie" ? "movie" : "series",
          posterUrl: img(x.poster_path, "w500"),
          backdropUrl: img(x.backdrop_path, "w780"),
        })),
      });
    }
  }

  return json({ error: "not_found" }, 404);
};
