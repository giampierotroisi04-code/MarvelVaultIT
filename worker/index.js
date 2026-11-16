// Punto d'ingresso Cloudflare Worker.
// - /api/*  -> stesso identico codice che girava su Netlify (netlify/functions/api.js)
// - cron    -> stesso codice degli anniversari (netlify/functions/anniversari.js)
// - il resto (sito React) viene servito da Cloudflare come file statici
import { setBucket } from "./blobs-shim.js";
import api from "../netlify/functions/api.js";
import anniversari from "../netlify/functions/anniversari.js";
import { r2StorageScan } from "../netlify/functions/api.js";
import { migrate } from "./migrate.js";

// Il codice originale legge le variabili da process.env: le copiamo da Cloudflare.
function prepare(env) {
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") process.env[k] = v.trim();
  }
  setBucket(env.VAULT);
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (pathname === "/api/migrate-import") return migrate(request, env); // solo per la migrazione da Netlify
    try {
      prepare(env);
      return await api(request, {});
    } catch (e) {
      console.error("api error", e);
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },

  // Ogni mattina alle 06:00 UTC (vedi [triggers] in wrangler.toml)
  async scheduled(event, env, ctx) {
    prepare(env);
    ctx.waitUntil(anniversari());
    ctx.waitUntil(r2StorageScan().catch((e) => console.error("scan R2", e))); // spazio usato + alert limiti R2
  },
};
