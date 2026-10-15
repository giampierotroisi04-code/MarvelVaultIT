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
