// Anniversari di uscita: cerca i titoli usciti "oggi" tanti anni fa e avvisa SOLO gli admin.
// Usata sia dal cron giornaliero (netlify/functions/anniversari.js) sia dal bottone "Forza ricerca" del pannello admin.
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export async function runAnniversaries({ store, tg, admins, site = "", force = false }) {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }); // AAAA-MM-GG
  if (!force && (await store.get("anniv:last")) === day) return { day, found: [], skipped: true };
  const [yy, mm, dd] = day.split("-");

  const db = (await store.get("catalog", { type: "json" })) || { media: [] };
  const hits = db.media
    .filter((m) => m.visible !== false && /^\d{4}-\d{2}-\d{2}$/.test(m.releaseDate || "") && m.releaseDate.slice(5) === `${mm}-${dd}`)
    .map((m) => ({ m, years: Number(yy) - Number(m.releaseDate.slice(0, 4)) }))
    .filter((x) => x.years >= 1)
    .sort((a, b) => b.years - a.years)
    .slice(0, 5);

  await store.set("anniv:last", day);
  if (hits.length && admins.length) {
    const kb = { inline_keyboard: [[{ text: "Apri pannello admin", web_app: { url: site.replace(/\/$/, "") + "/?admin=1" } }]] };
    for (const { m, years } of hits) {
      const text =
        `${years % 5 === 0 ? "🎉" : "📅"} <b>Anniversario</b>\n` +
        `Oggi ${years === 1 ? "1 anno" : years + " anni"} fa usciva <b>${esc(m.title)}</b>${m.type === "series" ? " (serie TV)" : ""}.\n\n` +
        `<i>Messaggio solo per admin: decidi tu se e come condividerlo.</i>`;
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
