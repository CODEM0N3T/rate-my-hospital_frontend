// src/constants/CONFIG.js
export const CMS_RESOURCE_BASE = "https://data.medicare.gov/resource";

export const DATASETS = {
  HOSPITALS: "xubh-q36u",
  HCAHPS: "dgck-syfz",
};

export const PAGE_LIMIT = 24;

export const CMS_APP_TOKEN = (import.meta.env.VITE_CMS_APP_TOKEN || "").trim();
export const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS) === "true";

// ✅ Use a permissive public proxy for Stage 1 demos
export const USE_PUBLIC_PROXY = true; // flip to false later
export const PUBLIC_PROXY_PREFIX = "https://corsproxy.io/?"; // just prepend

// Env flags (ensure no spaces around '=' in .env.local)

console.log(
  "[CMS] base:",
  CMS_RESOURCE_BASE,
  "| token present?",
  Boolean(CMS_APP_TOKEN),
  CMS_APP_TOKEN ? CMS_APP_TOKEN.slice(0, 4) + "…" : ""
);
