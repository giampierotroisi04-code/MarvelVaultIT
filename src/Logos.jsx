import logoIt from "./logo.jpg";

// Nomi per lingua. "neutral" è la schermata di scelta (nessun paese).
export const BRAND = {
  it: { name: "Marvel Italia", full: "Marvel Italia Streaming" },
  en: { name: "Marvel English", full: "Marvel English Streaming" },
  neutral: { name: "Marvel", full: "Marvel Streaming" },
};

// it = logo attuale (immagine). neutral = senza paese. en = anello con la bandiera inglese.
export function Logo({ kind = "it", className = "" }) {
  if (kind === "it") return <img className={"lg " + className} src={logoIt} alt="" />;
  const en = kind === "en";
  const cols = ["#4F74FF", "#FFFFFF", "#E3161C"];
  return (
    <svg className={"lg " + className} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <clipPath id="lgc"><circle cx="256" cy="256" r="256" /></clipPath>
        <clipPath id="lgs"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
        <clipPath id="lgt"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      </defs>
      <circle cx="256" cy="256" r="256" fill="#000" />
      {en ? (
        <g clipPath="url(#lgc)">
          <svg x="0" y="0" width="512" height="512" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice">
            <g clipPath="url(#lgs)">
              <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
              <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
              <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#lgt)" stroke="#C8102E" strokeWidth="4" />
              <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
              <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
            </g>
          </svg>
        </g>
      ) : (
        <circle cx="256" cy="256" r="250" fill="none" stroke="#8A8A93" strokeWidth="6" />
      )}
      <circle cx="256" cy="256" r="236" fill="#000" />
      <rect x="88" y="118" width="336" height="122" fill="#fff" />
      <rect x="96" y="126" width="320" height="106" fill="#E3161C" />
      <text x="256" y="218" textAnchor="middle" fill="#fff" fontFamily="'Bebas Neue',Impact,'Arial Narrow',sans-serif" fontSize="112" textLength="296" lengthAdjust="spacingAndGlyphs">MARVEL</text>
      {en && (
        <text x="256" y="302" textAnchor="middle" fontFamily="Inter,Arial,sans-serif" fontWeight="800" fontSize="40" letterSpacing="12">
          {"ENGLISH".split("").map((ch, i) => <tspan key={i} fill={cols[i % 3]}>{ch}</tspan>)}
        </text>
      )}
      <g transform={en ? "translate(0,6)" : "translate(0,-14)"}>
        <path d="M196 352 L336 296 L304 396 L262 366 L246 392 L238 358 Z" fill="#E3161C" />
        <path d="M238 358 L330 304" stroke="#000" strokeWidth="4" opacity=".45" />
      </g>
      <text x="256" y="452" textAnchor="middle" fill="#fff" fontFamily="Inter,Arial,sans-serif" fontWeight="500" fontSize="22" letterSpacing="9">STREAMING</text>
    </svg>
  );
}

// Schermata di scelta lingua (logo neutrale, nessun paese)
export function LangPick({ onPick }) {
  return (
    <div className="langpick">
      <Logo kind="neutral" />
      <h1>Choose your language</h1>
      <p>Scegli la lingua</p>
      <button className="btn primary" onClick={() => onPick("it")}>🇮🇹 Italiano</button>
      <button className="btn primary" onClick={() => onPick("en")}>🇬🇧 English</button>
    </div>
  );
}
