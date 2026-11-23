// Crea la "foto" del Wrapped (1920x1080) con un canvas, tutta sul telefono.
// Sinistra: il profilo dell'utente. Destra: le statistiche. Grafica identica al sito (nero, riquadri scuri, tricolore, Bebas Neue).
import { fmtHours, fmt1 } from "./stats.js";
import { tr } from "../i18n.js";

const W = 1920, H = 1080;
const RED = "#E3161C", GREEN = "#009246", S1 = "#0e0e10", S2 = "#1a1a1d", BD = "rgba(255,255,255,.16)", MUTED = "#a8a8b3";
const BEBAS = '"Bebas Neue", Impact, sans-serif';
const INTER = "Inter, system-ui, sans-serif";

const loadImg = (src) =>
  new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

const cover = (c, im, x, y, w, h) => {
  const r = Math.max(w / im.width, h / im.height), sw = w / r, sh = h / r;
  c.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, w, h);
};

const rr = (c, x, y, w, h, r) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

// imposta il font rimpicciolendolo finché il testo sta nella larghezza data
const fit = (c, text, maxW, size, weight, family) => {
  let sz = size;
  do { c.font = `${weight} ${sz}px ${family}`; sz -= 2; } while (c.measureText(text).width > maxW && sz > 16);
};

const T = (c, s, x, y, { font, color = "#fff", align = "left", ls = 0 }) => {
  c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = "alphabetic";
  if ("letterSpacing" in c) c.letterSpacing = ls + "px";
  c.fillText(s, x, y);
  if ("letterSpacing" in c) c.letterSpacing = "0px";
};
// testo che si adatta alla larghezza
const TF = (c, s, x, y, maxW, size, weight, family, color = "#fff", align = "left") => {
  fit(c, s, maxW, size, weight, family);
  c.fillStyle = color; c.textAlign = align; c.textBaseline = "alphabetic";
  c.fillText(s, x, y);
};

const panel = (c, x, y, w, h, fill = S1) => {
  rr(c, x, y, w, h, 34);
  c.fillStyle = fill; c.fill();
  c.lineWidth = 2; c.strokeStyle = BD; c.stroke();
};

const toBlob = (canvas) =>
  new Promise((res, rej) => {
    try { canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.92); } catch (e) { rej(e); }
  });

// o = { s (statistiche), name, year, bot, logo, avatar }
export async function makeWrapImage(o) {
  try { await Promise.all([document.fonts.load(`100px ${BEBAS}`), document.fonts.load(`800 40px ${INTER}`), document.fonts.load(`600 30px ${INTER}`)]); } catch {}
  const [logo, avatar] = await Promise.all([loadImg(o.logo), loadImg(o.avatar)]);
  const { s } = o;

  const draw = (useAvatar) => {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext("2d");

    // sfondo come il sito: nero con aloni rosso e verde
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    let g = c.createRadialGradient(0, 0, 0, 0, 0, 1000);
    g.addColorStop(0, "rgba(227,22,28,.38)"); g.addColorStop(1, "rgba(227,22,28,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(W, H, 0, W, H, 1000);
    g.addColorStop(0, "rgba(0,146,70,.3)"); g.addColorStop(1, "rgba(0,146,70,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // tricolore in alto e in basso
    for (const y of [0, H - 12]) {
      c.fillStyle = GREEN; c.fillRect(0, y, W / 3, 12);
      c.fillStyle = "#fff"; c.fillRect(W / 3, y, W / 3, 12);
      c.fillStyle = RED; c.fillRect((W / 3) * 2, y, W / 3, 12);
    }

    // intestazione: logo a sinistra, titolo a destra
    if (logo) { c.save(); c.beginPath(); c.arc(104, 98, 44, 0, Math.PI * 2); c.clip(); cover(c, logo, 60, 54, 88, 88); c.restore(); }
    T(c, tr("Marvel Italia"), 166, 96, { font: `800 38px ${INTER}` });
    T(c, "STREAMING", 166, 130, { font: `700 20px ${INTER}`, color: RED, ls: 7 });
    c.font = `100px ${BEBAS}`;
    const yw = c.measureText(String(o.year)).width;
    T(c, String(o.year), W - 60, 128, { font: `100px ${BEBAS}`, color: RED, align: "right" });
    T(c, "MCU WRAPPED", W - 60 - yw - 22, 128, { font: `100px ${BEBAS}`, align: "right" });

    // ---------- SINISTRA: l'utente ----------
    panel(c, 60, 180, 620, 790);
    const cx = 370, cy = 345;
    [GREEN, "#fff", RED].forEach((col, i) => {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 3 + 0.07;
      c.beginPath(); c.arc(cx, cy, 128, a0, a0 + (2 * Math.PI) / 3 - 0.14);
      c.lineWidth = 8; c.lineCap = "round"; c.strokeStyle = col; c.stroke();
    });
    c.lineCap = "butt";
    if (useAvatar && avatar) {
      c.save(); c.beginPath(); c.arc(cx, cy, 108, 0, Math.PI * 2); c.clip(); cover(c, avatar, cx - 108, cy - 108, 216, 216); c.restore();
    } else {
      c.beginPath(); c.arc(cx, cy, 108, 0, Math.PI * 2); c.fillStyle = RED; c.fill();
      T(c, (o.name.replace("@", "")[0] || "?").toUpperCase(), cx, cy + 42, { font: `130px ${BEBAS}`, align: "center" });
    }
    TF(c, o.name, cx, 530, 540, 46, 800, INTER, "#fff", "center");
    c.fillStyle = BD; c.fillRect(100, 566, 540, 2);

    T(c, tr("IL TUO PREFERITO"), 100, 620, { font: `700 20px ${INTER}`, color: RED, ls: 5 });
    TF(c, s.best.length ? s.best[0].m.title.toUpperCase() : "—", 100, 685, 540, 68, 400, BEBAS, "#fff");
    T(c, tr("PIÙ RIVISTO"), 100, 745, { font: `700 20px ${INTER}`, color: RED, ls: 5 });
    TF(c, s.top.length ? s.top[0].m.title.toUpperCase() : "—", 100, 810, 540, 68, 400, BEBAS, "#fff");
    T(c, tr("STREAK ATTUALE"), 100, 868, { font: `700 20px ${INTER}`, color: RED, ls: 5 });
    TF(c, `${s.streak} ${s.streak === 1 ? tr("GIORNO") : tr("GIORNI")}`, 100, 925, 540, 56, 400, BEBAS, "#fff");

    // ---------- DESTRA: le statistiche ----------
    panel(c, 720, 180, 1140, 790);
    T(c, tr("ORE VISTE"), 770, 248, { font: `700 22px ${INTER}`, color: MUTED, ls: 6 });
    TF(c, fmtHours(s.minutes), 770, 440, 600, 230, 400, BEBAS, "#fff");
    const sub = s.endgames >= 0.1 ? `= ${fmt1(s.endgames)} ${tr("maratone di Avengers: Endgame")}` : `${s.views} ${s.views === 1 ? tr("visione") : tr("visioni")} ${tr("in totale")}`;
    TF(c, sub, 770, 495, 600, 30, 600, INTER, "#d4d4dc");

    // film e serie visti (a destra delle ore)
    [[String(s.filmsSeen), "film visti", 305], [String(s.seriesSeen), "serie viste", 445]].forEach(([v, l, y]) => {
      TF(c, v, 1420, y, 200, 96, 400, BEBAS, "#fff");
      T(c, l.toUpperCase(), 1420, y + 34, { font: `700 18px ${INTER}`, color: MUTED, ls: 3 });
    });

    // sei riquadri
    const tiles = [
      [String(s.seen), "progetti visti"],
      [`${s.bestStreak} ${s.bestStreak === 1 ? "giorno" : "giorni"}`, "streak record"],
      [`${s.pct}%`, tr("catalogo completato")],
      [s.ratedCount ? `${s.avg}/5` : "—", tr("media dei tuoi voti")],
      [String(s.views), "visioni totali"],
      [String(s.activeDays), "giorni attivi"],
    ];
    tiles.forEach(([v, l], i) => {
      const x = 770 + (i % 3) * 355, y = 545 + Math.floor(i / 3) * 160;
      rr(c, x, y, 330, 138, 22);
      c.fillStyle = S2; c.fill();
      c.lineWidth = 2; c.strokeStyle = BD; c.stroke();
      TF(c, v, x + 26, y + 82, 280, 80, 400, BEBAS, "#fff");
      T(c, l.toUpperCase(), x + 26, y + 118, { font: `700 17px ${INTER}`, color: MUTED, ls: 3 });
    });

    // frase meme
    rr(c, 770, 872, 1040, 70, 18);
    c.fillStyle = "rgba(227,22,28,.12)"; c.fill();
    c.lineWidth = 2; c.strokeStyle = "rgba(227,22,28,.55)"; c.stroke();
    c.fillStyle = RED; c.fillRect(770, 886, 6, 42);
    TF(c, s.memes.card, 800, 917, 990, 30, 600, INTER, "#fff");

    T(c, `t.me/${o.bot || ""}`, W / 2, 1040, { font: `600 22px ${INTER}`, color: MUTED, align: "center", ls: 2 });
    return canvas;
  };

  try { return await toBlob(draw(true)); } catch { return toBlob(draw(false)); }
}
