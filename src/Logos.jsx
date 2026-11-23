import logoIt from "./logo.jpg";
import logoEn from "./logo-en.jpg";
import logoNeutral from "./logo-neutral.jpg";

// Nomi per lingua. "neutral" è la schermata di scelta (nessun paese).
export const BRAND = {
  it: { name: "Marvel Italia", full: "Marvel Italia Streaming" },
  en: { name: "Marvel English", full: "Marvel English Streaming" },
  neutral: { name: "Marvel", full: "Marvel Streaming" },
};

// Indirizzo dell'immagine del logo per lingua (serve anche alla foto Wrapped)
export const logoUrl = (kind) => (kind === "en" ? logoEn : kind === "neutral" ? logoNeutral : logoIt);

// it, en e neutral = le tre immagini dei loghi (neutral = schermata di scelta lingua, senza paese)
export function Logo({ kind = "it", className = "" }) {
  return <img className={"lg " + className} src={logoUrl(kind)} alt="" />;
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
