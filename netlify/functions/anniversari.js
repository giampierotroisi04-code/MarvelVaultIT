import { getStore } from "@netlify/blobs";
import { runAnniversaries } from "../../src/lib/anniv.js";

// Ogni mattina controlla gli anniversari di uscita e avvisa SOLO gli admin (vedi src/lib/anniv.js).
export const config = { schedule: "0 6 * * *" }; // 06:00 UTC = 07:00/08:00 in Italia

for (const k of ["BOT_TOKEN", "ADMIN_IDS", "SITE_URL"]) {
  let v;
  try { v = globalThis.Netlify?.env?.get(k); } catch {}
  v = v ?? process.env[k];
  if (v) process.env[k] = String(v).trim();
}

const tg = (method, body) =>
  fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export default async () => {
  const admins = (process.env.ADMIN_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!process.env.BOT_TOKEN || !admins.length) return;
  await runAnniversaries({ store: getStore({ name: "vault", consistency: "strong" }), tg, admins, site: process.env.SITE_URL || "" });
};
