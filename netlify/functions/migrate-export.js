// SOLO PER LA MIGRAZIONE a Cloudflare. Espone (protetto da WEBHOOK_SECRET) tutto il contenuto di Netlify Blobs.
// Si può cancellare quando la migrazione è finita.
import { getStore } from "@netlify/blobs";

export const config = { path: "/migrate-export" };

const env = (k) => {
  let v;
  try { v = globalThis.Netlify?.env?.get(k); } catch {}
  return String(v ?? process.env[k] ?? "").trim();
};

const MAX_ENTRIES = 40;      // elementi per pagina
const MAX_IMAGES = 25;       // immagini per pagina (si scaricano una a una)
const MAX_TEXT = 1_500_000;  // caratteri di testo per pagina

export default async (req) => {
  const secret = env("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-migrate-key") !== secret) return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const store = getStore({ name: "vault", consistency: "strong" });

  // Scarica un singolo elemento binario (immagine) così com'è
  const one = url.searchParams.get("get");
  if (one) {
    const r = await store.getWithMetadata(one, { type: "arrayBuffer" });
    if (!r) return new Response("not found", { status: 404 });
    return new Response(r.data, { headers: { "content-type": "application/octet-stream", "x-meta-type": r.metadata?.type || "" } });
  }

  // Elenco a pagine: testo incluso, immagini solo come segnaposto
  const after = url.searchParams.get("after") || "";
  const { blobs } = await store.list();
  const keys = blobs.map((b) => b.key).filter((k) => !k.startsWith("meter:") && k > after).sort();

  const entries = [];
  let chars = 0, imgs = 0, next = null, left = 0;
  for (let i = 0; i < keys.length; i++) {
    if (entries.length >= MAX_ENTRIES || imgs >= MAX_IMAGES || chars >= MAX_TEXT) {
      next = entries[entries.length - 1].key;
      left = keys.length - i;
      break;
    }
    const key = keys[i];
    if (key.startsWith("img:")) { entries.push({ key, bin: true }); imgs++; }
    else {
      const text = await store.get(key);
      if (text == null) continue;
      entries.push({ key, text });
      chars += text.length;
    }
  }
  return new Response(JSON.stringify({ entries, next, left }), { headers: { "content-type": "application/json" } });
};
