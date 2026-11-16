// Sostituisce "@netlify/blobs": stessa interfaccia (get, set, setJSON, getWithMetadata),
// ma i dati vengono salvati in un bucket Cloudflare R2.
// wrangler.toml la collega al posto del pacchetto originale (sezione [alias]).

let bucket = null;
export const setBucket = (b) => { bucket = b; };

// Il tracker "crediti Netlify" non serve su Cloudflare: lo spegniamo per non sprecare scritture.
const isMeter = (key) => String(key).startsWith("meter:");

async function read(obj, type) {
  if (type === "json") return obj.json();
  if (type === "arrayBuffer") return obj.arrayBuffer();
  return obj.text();
}

export function getStore() {
  if (!bucket) throw new Error("Bucket R2 non collegato (binding VAULT mancante)");
  return {
    async get(key, opts = {}) {
      if (isMeter(key)) return null;
      const obj = await bucket.get(key);
      return obj ? read(obj, opts.type) : null;
    },
    async getWithMetadata(key, opts = {}) {
      if (isMeter(key)) return null;
      const obj = await bucket.get(key);
      if (!obj) return null;
      return { data: await read(obj, opts.type), metadata: obj.customMetadata || {}, etag: obj.etag };
    },
    async set(key, value, opts = {}) {
      if (isMeter(key)) return;
      await bucket.put(key, value, { customMetadata: opts.metadata || {} });
    },
    async setJSON(key, value, opts = {}) {
      if (isMeter(key)) return;
      await bucket.put(key, JSON.stringify(value), {
        httpMetadata: { contentType: "application/json" },
        customMetadata: opts.metadata || {},
      });
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
