const tg = window.Telegram?.WebApp;

export async function api(path, opts = {}) {
  const method = opts.method || (opts.body ? "POST" : "GET");
  const r = await fetch("/api/" + path, {
    method,
    headers: { "content-type": "application/json", "x-init-data": tg?.initData || "" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || "Errore"), { data });
  return data;
}

export const imgUrl = (id) => (id ? `/api/img/${id}` : "");
// poster/backdrop di un film o serie: immagine caricata da te oppure URL (TMDB)
export const art = (o, k) => imgUrl(o?.[k + "Img"]) || o?.[k + "Url"] || "";
