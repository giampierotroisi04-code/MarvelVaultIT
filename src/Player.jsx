import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Player integrato (beta). Il video NON passa dal nostro server e non viene copiato:
// il <video> legge il file direttamente da R2. Il punto in cui sei rimasto vale solo per chi guarda:
// sta nel telefono (localStorage) e, se disponibile, nel cloud personale di Telegram (si sincronizza tra i tuoi dispositivi).
const tg = window.Telegram?.WebApp;
const cloud = () => { try { return tg?.CloudStorage && tg.isVersionAtLeast?.("6.9") ? tg.CloudStorage : null; } catch { return null; } };
const key = (id) => "mvpos_" + String(id).replace(/[^A-Za-z0-9_-]/g, "_"); // CloudStorage accetta solo questi caratteri

// valore salvato: "secondi|timestamp" (vince il più recente tra telefono e cloud)
const parse = (v) => { const [s, t] = String(v || "").split("|"); return { s: Number(s) || 0, t: Number(t) || 0 }; };
function readPos(id) {
  return new Promise((done) => {
    let local = { s: 0, t: 0 };
    try { local = parse(localStorage.getItem(key(id))); } catch {}
    const c = cloud();
    if (!c) return done(local.s);
    const to = setTimeout(() => done(local.s), 1500);
    try {
      c.getItem(key(id), (err, v) => { clearTimeout(to); const r = err ? { s: 0, t: 0 } : parse(v); done((r.t > local.t ? r : local).s); });
    } catch { clearTimeout(to); done(local.s); }
  });
}
function writePos(id, sec, toCloud) {
  const v = `${Math.floor(sec)}|${Date.now()}`;
  try { localStorage.setItem(key(id), v); } catch {}
  if (toCloud) { try { cloud()?.setItem(key(id), v, () => {}); } catch {} }
}
function clearPos(id) {
  try { localStorage.removeItem(key(id)); } catch {}
  try { cloud()?.removeItem(key(id), () => {}); } catch {}
}
const fmt = (t) => { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };

export default function Player({ m, url, onClose }) {
  const v = useRef(null);
  const last = useRef({ local: 0, cloud: 0 });
  const [resumed, setResumed] = useState(0);
  const [err, setErr] = useState(false);

  const save = (toCloud) => {
    const el = v.current;
    if (!el || !el.duration || !isFinite(el.duration)) return;
    if (el.ended || el.currentTime > el.duration - 30) return clearPos(m.id); // finito: la prossima volta riparte da capo
    if (el.currentTime < 10) return;
    writePos(m.id, el.currentTime, toCloud);
  };

  useEffect(() => {
    const hide = () => document.visibilityState === "hidden" && save(true);
    const bye = () => save(true);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", bye);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", bye); save(true); };
  }, []);

  const onMeta = async () => {
    const el = v.current;
    const p = await readPos(m.id);
    if (el && p > 20 && p < el.duration - 30) { el.currentTime = p; setResumed(p); setTimeout(() => setResumed(0), 7000); }
  };
  const onTime = () => {
    const now = Date.now();
    if (now - last.current.local > 5000) { last.current.local = now; save(false); }
    if (now - last.current.cloud > 30000) { last.current.cloud = now; save(true); }
  };
  const restart = () => { if (v.current) v.current.currentTime = 0; setResumed(0); clearPos(m.id); };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px", color: "#fff" }}>
        <button className="ico" onClick={onClose} aria-label="Chiudi" style={{ fontSize: 22, color: "#fff", background: "none", border: 0 }}>✕</button>
        <b style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</b>
        <span style={{ fontSize: 11, opacity: 0.7 }}>BETA</span>
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {err ? (
          <p style={{ color: "#fff", padding: 24, textAlign: "center" }}>Il video non si apre. Riprova tra poco o segnalalo all'admin.</p>
        ) : (
          <video ref={v} src={url} controls autoPlay playsInline preload="metadata" onLoadedMetadata={onMeta} onTimeUpdate={onTime} onPause={() => save(true)} onEnded={() => clearPos(m.id)} onError={() => setErr(true)} style={{ width: "100%", maxHeight: "100%", background: "#000" }} />
        )}
        {resumed > 0 && (
          <div style={{ position: "absolute", left: 12, right: 12, bottom: 70, background: "rgba(20,20,20,.92)", color: "#fff", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <span style={{ flex: 1 }}>Ripreso da {fmt(resumed)}</span>
            <button className="btn small" onClick={restart}>Dall'inizio</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
