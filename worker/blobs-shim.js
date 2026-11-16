// Sostituisce "@netlify/blobs": stessa interfaccia (get, set, setJSON, getWithMetadata),
// ma i dati vengono salvati in un bucket Cloudflare R2.
// wrangler.toml la collega al posto del pacchetto originale (sezione [alias]).
// In più conta le operazioni R2 (Class A = scritture/list, Class B = letture) per l'alert sui limiti.

let bucket = null;
export const setBucket = (b) => { bucket = b; };
export const getBucket = () => {
  if (!bucket) throw new Error("Bucket R2 non collegato (binding VAULT mancante)");
  return bucket;
};

// Operazioni fatte da quando è stato svuotato il contatore l'ultima volta (api.js le salva su R2 a fine richiesta)
let pending = { a: 0, b: 0 };
export const takeOps = () => { const o = pending; pending = { a: 0, b: 0 }; return o; };
const A = (n = 1) => { pending.a += n; };
const B = (n = 1) => { pending.b += n; };

async function read(obj, type) {
  if (type === "json") return obj.json();
  if (type === "arrayBuffer") return obj.arrayBuffer();
  return obj.text();
}

export function getStore() {
  getBucket();
  return {
    async get(key, opts = {}) {
      B();
      const obj = await bucket.get(key);
      return obj ? read(obj, opts.type) : null;
    },
    async getWithMetadata(key, opts = {}) {
      B();
      const obj = await bucket.get(key);
      if (!obj) return null;
      return { data: await read(obj, opts.type), metadata: obj.customMetadata || {}, etag: obj.etag };
    },
    async set(key, value, opts = {}) {
      A();
      await bucket.put(key, value, { customMetadata: opts.metadata || {} });
    },
    async setJSON(key, value, opts = {}) {
      A();
      await bucket.put(key, JSON.stringify(value), {
        httpMetadata: { contentType: "application/json" },
        customMetadata: opts.metadata || {},
      });
    },
    async delete(key) {
      await bucket.delete(key); // le DELETE su R2 sono gratuite
    },
  };
}
