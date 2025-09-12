export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
export const USE_PROXY = true; // we’re using the Netlify function

// In dev, point to the local Netlify dev server (8888).
// In prod, use a RELATIVE path so origin matches your app.
export const CMS_PROXY_BASE = import.meta.env.DEV
  ? import.meta.env.VITE_CMS_PROXY_BASE ||
    "http://localhost:8888/.netlify/functions/cms-proxy"
  : import.meta.env.VITE_CMS_PROXY_BASE || "/.netlify/functions/cms-proxy";

// Just for logging:
console.log("[CMS CONFIG] proxy base:", CMS_PROXY_BASE, "| mocks:", USE_MOCKS);
console.log(
  "[CMS CONFIG] mode:",
  USE_PROXY ? "proxy" : "direct",
  "| proxy base:",
  CMS_PROXY_BASE || "(none)",
  "| token present (direct only)?",
  Boolean(import.meta.env.VITE_CMS_APP_TOKEN)
);

// Datasets (UUIDs)
export const DATASETS = { HOSPITALS: "xubh-q36u", HCAHPS: "dgck-syfz" };
export const PAGE_LIMIT = 24;
