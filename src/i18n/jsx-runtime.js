// Runtime JSX che fa passare i testi da src/i18n.js (traduce solo se la lingua è inglese)
import { Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { trProps } from "../i18n.js";
export { Fragment };
export const jsx = (type, props, key) => _jsx(type, trProps(type, props), key);
export const jsxs = (type, props, key) => {
  const p = trProps(type, props);
  return Array.isArray(p?.children) ? _jsxs(type, p, key) : _jsx(type, p, key);
};
