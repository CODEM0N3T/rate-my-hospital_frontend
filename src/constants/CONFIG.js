// src/constants/CONFIG.js
export const CMS_DIRECT_BASE = "https://data.medicare.gov/resource";

// Point this at your Netlify Function (from your .env.local)
export const CMS_PROXY_BASE = (
  import.meta.env.VITE_CMS_PROXY_BASE || ""
).trim();

// Flip on proxy mode if CMS_PROXY_BASE is set
export const USE_PROXY = !!CMS_PROXY_BASE;

export const DATASETS = {
  HOSPITALS: "xubh-q36u",
  HCAHPS: "dgck-syfz",
};

export const PAGE_LIMIT = 24;

// Used ONLY in direct mode (not through your function)
export const CMS_APP_TOKEN = (import.meta.env.VITE_CMS_APP_TOKEN || "").trim();

export const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS) === "true";

// Helpful log
console.log(
  "[CMS CONFIG] mode:",
  USE_PROXY ? "proxy" : "direct",
  "| proxy base:",
  CMS_PROXY_BASE || "(none)",
  "| token present (direct only)?",
  Boolean(CMS_APP_TOKEN)
);
