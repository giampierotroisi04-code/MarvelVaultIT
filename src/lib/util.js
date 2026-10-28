// Username Telegram del bot (senza @). Se su Netlify c'è la variabile BOT_USERNAME, quella ha la precedenza.
export const BOT_USERNAME = "Marvel_Italia_Streaming";

// Estrae channelId e messageId da un link Telegram
// Supporta: t.me/c/<id>/<msg>, t.me/c/<id>/<topic>/<msg>, t.me/<username>/<msg>
export function parseLink(input = "") {
  const m = String(input).match(/t\.me\/(c\/)?([A-Za-z0-9_]+)((?:\/\d+)+)/i);
  if (!m) return null;
  const nums = m[3].split("/").filter(Boolean);
  const messageId = parseInt(nums[nums.length - 1], 10);
  return m[1]
    ? { channelId: Number("-100" + m[2]), messageId }
    : { channelId: "@" + m[2], messageId };
}

export const buildLink = (ch, id) =>
  /^-100/.test(String(ch))
    ? `https://t.me/c/${String(ch).replace("-100", "")}/${id}`
    : `https://t.me/${String(ch).replace("@", "")}/${id}`;

// Albero categorie -> lista piatta con profondita'
export const flatTree = (cats, parent = null, depth = 0) =>
  cats
    .filter((c) => (c.parentId || null) === parent)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .flatMap((c) => [{ ...c, depth }, ...flatTree(cats, c.id, depth + 1)]);

// id della categoria + tutte le sue sottocategorie
export const descIds = (cats, id) => [
  id,
  ...cats.filter((c) => c.parentId === id).flatMap((c) => descIds(cats, c.id)),
];

// Data di uscita per l'ordinamento: giorno e mese contano solo a parità di anno,
// ma non vengono mai mostrati (all'utente si vede solo l'anno).
export const relKey = (m) => m?.releaseDate || (m?.year ? `${String(m.year).slice(0, 4)}-00-00` : "");
// asc: dal più vecchio; desc: dal più recente. Senza data -> in fondo.
export const byRelease = (dir = "asc") => (a, b) => {
  const x = relKey(a), y = relKey(b);
  if (x !== y) {
    if (!x) return 1;
    if (!y) return -1;
    return dir === "asc" ? (x < y ? -1 : 1) : (x < y ? 1 : -1);
  }
  return (a.createdAt || 0) - (b.createdAt || 0);
};
