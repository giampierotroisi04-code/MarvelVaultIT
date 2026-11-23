import { BOT_USERNAME } from "./util.js";
// Anniversari di uscita: cerca i titoli usciti "oggi" tanti anni fa e avvisa SOLO gli admin.
// Usata sia dal cron giornaliero (netlify/functions/anniversari.js) sia dal bottone "Forza ricerca" del pannello admin.
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export async function runAnniversaries({ store, tg, admins, site = "", bot = "", force = false, lang = "it" }) {
  const en = lang === "en"; // catalogo e testi inglesi
  const lastKey = en ? "anniv:last-en" : "anniv:last";
  const handle = "@" + (String(bot || "").replace(/^@/, "") || BOT_USERNAME);
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }); // AAAA-MM-GG
  if (!force && (await store.get(lastKey)) === day) return { day, found: [], skipped: true };
  const [yy, mm, dd] = day.split("-");

  const db = (await store.get(en ? "catalog-en" : "catalog", { type: "json" })) || { media: [] };
  const hits = db.media
    .filter((m) => m.visible !== false && /^\d{4}-\d{2}-\d{2}$/.test(m.releaseDate || "") && m.releaseDate.slice(5) === `${mm}-${dd}`)
    .map((m) => ({ m, years: Number(yy) - Number(m.releaseDate.slice(0, 4)) }))
    .filter((x) => x.years >= 1)
    .sort((a, b) => b.years - a.years)
    .slice(0, 5);

  await store.set(lastKey, day);
  if (hits.length && admins.length) {
    const kb = { inline_keyboard: [[{ text: "Apri pannello admin", web_app: { url: site.replace(/\/$/, "") + "/?admin=1" } }]] };
    for (const { m, years } of hits) {
      // il testo è il post pronto: si può copiare o inoltrare così com'è
      const n = en ? (years === 1 ? "1 year" : `${years} years`) : years === 1 ? "1 anno" : `${years} anni`;
      const has = m.source || (m.seasons || []).some((x) => (x.episodes || []).some((e) => e.source));
      const series = m.type === "series";
      const text =
        (en
          ? series
            ? `📺 Today, ${n} ago, the series <b>${esc(m.title)}</b> premiered!`
            : `🎬 Today, ${n} ago, <b>${esc(m.title)}</b> hit theaters!`
          : series
            ? `📺 Oggi ${n} fa debuttava la serie <b>${esc(m.title)}</b>!`
            : `🎬 Oggi ${n} fa usciva <b>${esc(m.title)}</b> nelle sale cinematografiche!`) +
        (has ? (en ? `\n\n🍿 ${series ? "Catch up on it" : "Watch it"} on ${handle}` : `\n\n🍿 Puoi ${series ? "recuperarla" : "recuperarlo"} su ${handle}`) : "");
      for (const id of admins) {
        const r = m.posterUrl
          ? await tg("sendPhoto", { chat_id: id, photo: m.posterUrl, caption: text, parse_mode: "HTML", reply_markup: kb }).catch(() => ({}))
          : { ok: false };
        if (!r.ok) await tg("sendMessage", { chat_id: id, text, parse_mode: "HTML", reply_markup: kb }).catch(() => {});
      }
    }
  }
  return { day, found: hits.map((x) => ({ title: x.m.title, years: x.years })) };
}
