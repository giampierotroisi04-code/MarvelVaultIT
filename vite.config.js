import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// jsxImportSource: il runtime JSX in src/i18n traduce i testi quando l'app è in inglese (vedi src/i18n.js)
export default defineConfig({ plugins: [react({ jsxImportSource: "/src/i18n" })] });
