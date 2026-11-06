// Crea la "foto" del Wrapped (1080x1920, formato storie) con un canvas, tutta sul telefono.
import { fmtHours, fmt1 } from "./stats.js";

const W = 1080, H = 1920;
const RED = "#E3161C", GREEN = "#009246";
const BEBAS = '"Bebas Neue", Impact, sans-serif';
const INTER = 'Inter, system-ui, sans-serif';

const loadImg = (src) =>
  new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = "anonymous"; // se il server non lo permette l'immagine non carica: niente canvas "sporco"
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

// scrive il testo rimpicciolendolo finché sta nella larghezza data
const fit = (c, text, maxW, size, weight, family) => {
  let sz = size;
  do { c.font = `${weight} ${sz}px ${family}`; sz -= 2; } while (c.measureText(text).width > maxW && sz > 18);
};

const T = (c, s, x, y, { font, color = "#fff", align = "left", ls = 0 }) => {
  c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = "alphabetic";
  if ("letterSpacing" in c) c.letterSpacing = ls + "px";
  c.fillText(s, x, y);
  if ("letterSpacing" in c) c.letterSpacing = "0px";
};

const gem = (c, cx, cy, r, color, on) => {
  const pts = [[0, -1], [0.85, -0.4], [0.6, 0.9], [-0.6, 0.9], [-0.85, -0.4]];
  c.save();
  c.translate(cx, cy);
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x * r, y * r) : c.moveTo(x * r, y * r)));
  c.closePath();
  if (on) { c.shadowColor = color; c.shadowBlur = 30; c.fillStyle = color; }
  else c.fillStyle = "rgba(255,255,255,.05)";
  c.fill();
  c.shadowBlur = 0;
  c.lineJoin = "round";
  c.lineWidth = 3;
  c.strokeStyle = on ? "#fff" : "rgba(255,255,255,.28)";
  c.stroke();
  c.beginPath();
  c.moveTo(-0.85 * r, -0.4 * r); c.lineTo(0.85 * r, -0.4 * r);
  c.moveTo(0, -r); c.lineTo(-0.3 * r, -0.4 * r); c.lineTo(-0.2 * r, 0.9 * r);
  c.moveTo(0, -r); c.lineTo(0.3 * r, -0.4 * r); c.lineTo(0.2 * r, 0.9 * r);
  c.lineWidth = 2;
  c.strokeStyle = on ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.14)";
  c.stroke();
  c.restore();
};

const toBlob = (canvas) =>
  new Promise((res, rej) => {
    try { canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.92); } catch (e) { rej(e); }
  });

// o = { s (statistiche), name, year, bot, logo, bgUrl }
export async function makeWrapImage(o) {
  try { await Promise.all([document.fonts.load(`170px ${BEBAS}`), document.fonts.load(`800 40px ${INTER}`)]); } catch {}
  const [logo, bg] = await Promise.all([loadImg(o.logo), loadImg(o.bgUrl)]);
  const { s } = o;

  const draw = (useBg) => {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext("2d");

    // sfondo: nero, oppure la locandina del titolo preferito molto scurita
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    if (useBg && bg) { cover(c, bg, 0, 0, W, H); c.fillStyle = "rgba(0,0,0,.76)"; c.fillRect(0, 0, W, H); }
    let g = c.createRadialGradient(W / 2, 0, 0, W / 2, 0, 1000);
    g.addColorStop(0, "rgba(227,22,28,.5)"); g.addColorStop(1, "rgba(227,22,28,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(W / 2, H, 0, W / 2, H, 900);
    g.addColorStop(0, "rgba(0,146,70,.4)"); g.addColorStop(1, "rgba(0,146,70,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // tricolore in alto e in basso
    for (const y of [0, H - 16]) {
      c.fillStyle = GREEN; c.fillRect(0, y, W / 3, 16);
      c.fillStyle = "#fff"; c.fillRect(W / 3, y, W / 3, 16);
      c.fillStyle = RED; c.fillRect((W / 3) * 2, y, W / 3, 16);
    }

    // intestazione
    if (logo) {
      c.save(); c.beginPath(); c.arc(114, 120, 54, 0, Math.PI * 2); c.clip(); cover(c, logo, 60, 66, 108, 108); c.restore();
    }
    T(c, "Marvel Italia", 190, 118, { font: `800 44px ${INTER}` });
    T(c, "STREAMING", 190, 158, { font: `700 22px ${INTER}`, color: RED, ls: 8 });

    // titolo
    fit(c, "MCU WRAPPED", 960, 170, 400, BEBAS);
    c.fillStyle = "#fff"; c.textAlign = "left"; c.fillText("MCU WRAPPED", 60, 420);
    fit(c, String(o.year), 960, 320, 400, BEBAS);
    c.fillStyle = RED; c.fillText(String(o.year), 60, 690);
    fit(c, `di ${o.name}`, 960, 38, 700, INTER);
    c.fillStyle = "#cfcfd8"; c.textAlign = "left"; c.fillText(`di ${o.name}`, 60, 765);

    // ore viste
    T(c, "ORE VISTE", 60, 880, { font: `700 28px ${INTER}`, color: "#a8a8b3", ls: 6 });
    fit(c, fmtHours(s.minutes), 960, 230, 400, BEBAS);
    c.fillStyle = "#fff"; c.textAlign = "left"; c.fillText(fmtHours(s.minutes), 60, 1075);
    const sub = s.endgames >= 0.1 ? `= ${fmt1(s.endgames)} maratone di Avengers: Endgame` : `${s.views} ${s.views === 1 ? "visione" : "visioni"} in totale`;
    fit(c, sub, 960, 34, 600, INTER);
    c.fillStyle = "#d4d4dc"; c.fillText(sub, 60, 1138);

    // grado + eroe
    rr(c, 60, 1190, 960, 170, 26);
    c.fillStyle = "rgba(0,0,0,.45)"; c.fill();
    c.lineWidth = 3; c.strokeStyle = RED; c.stroke();
    T(c, "GRADO", 92, 1245, { font: `700 22px ${INTER}`, color: RED, ls: 5 });
    fit(c, s.rank.name.toUpperCase(), 430, 74, 400, BEBAS);
    c.fillStyle = "#fff"; c.textAlign = "left"; c.fillText(s.rank.name.toUpperCase(), 92, 1325);
    T(c, "EROE", 988, 1245, { font: `700 22px ${INTER}`, color: RED, align: "right", ls: 5 });
    fit(c, s.hero.name.toUpperCase(), 430, 74, 400, BEBAS);
    c.fillStyle = "#fff"; c.textAlign = "right"; c.fillText(s.hero.name.toUpperCase(), 988, 1325);

    // quattro riquadri
    const tiles = [
      [String(s.seen), "progetti visti"],
      [`${s.bestStreak} ${s.bestStreak === 1 ? "giorno" : "giorni"}`, "streak record"],
      [`${s.pct}%`, "catalogo completato"],
      [s.ratedCount ? `${s.avg}/5` : "—", "media dei tuoi voti"],
    ];
    tiles.forEach(([v, l], i) => {
      const x = 60 + (i % 2) * 492, y = 1390 + Math.floor(i / 2) * 164;
      rr(c, x, y, 468, 140, 22);
      c.fillStyle = "rgba(255,255,255,.07)"; c.fill();
      c.lineWidth = 2; c.strokeStyle = "rgba(255,255,255,.18)"; c.stroke();
      fit(c, v, 420, 84, 400, BEBAS);
      c.fillStyle = "#fff"; c.textAlign = "left"; c.fillText(v, x + 26, y + 84);
      T(c, l.toUpperCase(), x + 26, y + 120, { font: `700 20px ${INTER}`, color: "#a8a8b3", ls: 3 });
    });

    // gemme dell'infinito
    s.stones.forEach((st, i) => gem(c, 140 + i * 160, 1785, 42, st.color, st.on));
    T(c, `${s.stonesOn}/6 GEMME DELL'INFINITO · t.me/${o.bot || ""}`, W / 2, 1868, { font: `700 24px ${INTER}`, color: "#cfcfd8", align: "center", ls: 3 });
    return canvas;
  };

  try { return await toBlob(draw(true)); } catch { return toBlob(draw(false)); }
}
