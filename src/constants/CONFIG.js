// src/constants/CONFIG.js
export const CMS_DIRECT_BASE = "https://data.medicare.gov/resource";

// Point this at your Netlify Function (from your .env.local)
export const CMS_PROXY_BASE = import.meta.env.VITE_CMS_PROXY_BASE || "";
export const DATASETS = { HOSPITALS: "xubh-q36u", HCAHPS: "dgck-syfz" };

// Flip on proxy mode if CMS_PROXY_BASE is set
export const USE_PROXY = !!CMS_PROXY_BASE;

export const PAGE_LIMIT = 24;

// Used ONLY in direct mode (not through your function)
export const CMS_APP_TOKEN = (import.meta.env.VITE_CMS_APP_TOKEN || "").trim();

// src/constants/CONFIG.js

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

console.log("[CMS CONFIG] proxy base:", CMS_PROXY_BASE, "| mocks:", USE_MOCKS);

// Helpful log
console.log(
  "[CMS CONFIG] mode:",
  USE_PROXY ? "proxy" : "direct",
  "| proxy base:",
  CMS_PROXY_BASE || "(none)",
  "| token present (direct only)?",
  Boolean(CMS_APP_TOKEN)
);
