// Come jsx-runtime.js, per la modalità di sviluppo (npm run dev)
import { Fragment, jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";
import { trProps } from "../i18n.js";
export { Fragment };
export const jsxDEV = (type, props, key, isStatic, source, self) => _jsxDEV(type, trProps(type, props), key, isStatic, source, self);
