// SOLO PER LA MIGRAZIONE da Netlify. Si apre dal browser:
//   https://NUOVOSITO.workers.dev/api/migrate-import?key=WEBHOOK_SECRET&from=https://VECCHIOSITO.netlify.app
// Copia tutto da Netlify Blobs a R2 a pagine, ricaricandosi da sola finché ha finito.
// Si può ripetere quante volte vuoi (sovrascrive con i dati del vecchio sito). Si può cancellare dopo.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const page = (status, body, refresh) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      (refresh ? `<meta http-equiv="refresh" content="1;url=${esc(refresh)}">` : "") +
      `<title>Migrazione</title><body style="font:16px system-ui;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.5">${body}</body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );

export async function migrate(request, env) {
  const url = new URL(request.url);
  const secret = String(env.WEBHOOK_SECRET || "").trim();
  const key = url.searchParams.get("key") || "";
  if (!secret || key !== secret) return page(403, "<h2>403</h2><p>Chiave non valida.</p>");

  const from = (url.searchParams.get("from") || "").replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(from))
    return page(400, "<h2>Manca il vecchio sito</h2><p>Aggiungi <code>&amp;from=https://VECCHIOSITO.netlify.app</code> all'indirizzo.</p>");
  const oldKey = url.searchParams.get("oldkey") || key; // se sul vecchio sito il WEBHOOK_SECRET è diverso
  const after = url.searchParams.get("after") || "";
  const done = Number(url.searchParams.get("n") || 0);
  const headers = { "x-migrate-key": oldKey };

  try {
    const r = await fetch(`${from}/migrate-export?after=${encodeURIComponent(after)}`, { headers });
    if (!r.ok) return page(502, `<h2>Il vecchio sito ha risposto ${r.status}</h2><p>Controlla l'indirizzo e che il file <code>migrate-export.js</code> sia stato pubblicato su Netlify (e che la chiave sia quella del vecchio sito: usa <code>&amp;oldkey=...</code>).</p><p><a href="${esc(url.href)}">Riprova</a></p>`);
    const data = await r.json();

    let copied = 0;
    for (const e of data.entries) {
      if (e.bin) {
        const b = await fetch(`${from}/migrate-export?get=${encodeURIComponent(e.key)}`, { headers });
        if (!b.ok) throw new Error(`immagine ${e.key}: ${b.status}`);
        const type = b.headers.get("x-meta-type");
        await env.VAULT.put(e.key, await b.arrayBuffer(), { customMetadata: type ? { type } : {} });
      } else {
        await env.VAULT.put(e.key, e.text);
      }
      copied++;
    }

    const total = done + copied;
    if (data.next) {
      const nu = new URL(url.href);
      nu.searchParams.set("after", data.next);
      nu.searchParams.set("n", String(total));
      return page(200, `<h2>Copia in corso…</h2><p>Copiati finora: <b>${total}</b><br>Mancano circa: ${data.left}</p><p>Non chiudere la pagina, va avanti da sola.</p><p><a href="${esc(nu.href)}">Se si ferma, clicca qui</a></p>`, nu.href);
    }
    return page(200, `<h2>✅ Fatto!</h2><p>Copiati <b>${total}</b> elementi da Netlify a Cloudflare (catalogo, utenti, statistiche, immagini…).</p>`);
  } catch (err) {
    return page(500, `<h2>Si è fermata</h2><p>${esc(err.message || err)}</p><p><a href="${esc(url.href)}">Riprova da qui</a> (riparte dall'ultimo punto, senza perdere niente).</p>`);
  }
}
