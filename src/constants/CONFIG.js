// src/constants/CONFIG.js
export const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS) === "true";
export const USE_PROXY = true;

export const CMS_PROXY_BASE = import.meta.env.DEV
  ? import.meta.env.VITE_CMS_PROXY_BASE || "/.netlify/functions/cms-proxy"
  : "/.netlify/functions/cms-proxy";

console.log("[CMS CONFIG] proxy base:", CMS_PROXY_BASE, "| mocks:", USE_MOCKS);
console.log(
  "[CMS CONFIG] mode:",
  USE_PROXY ? "proxy" : "direct",
  "| proxy base:",
  CMS_PROXY_BASE || "(none)",
  "| token present (direct only)?",
  Boolean(
    import.meta.env.VITE_SOCRATA_APP_TOKEN || import.meta.env.VITE_CMS_APP_TOKEN
  )
);

export const DATASETS = { HOSPITALS: "xubh-q36u", HCAHPS: "dgck-syfz" };
export const PAGE_LIMIT = 24;
