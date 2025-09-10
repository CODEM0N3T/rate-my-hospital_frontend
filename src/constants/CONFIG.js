export const CMS_PROXY_BASE = import.meta.env.VITE_CMS_PROXY_BASE || "";
export const DATASETS = { HOSPITALS: "xubh-q36u", HCAHPS: "dgck-syfz" };
export const PAGE_LIMIT = 24;

export const USE_PROXY = (import.meta.env.VITE_USE_PROXY || "true") === "true";
export const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS || "false") === "true";

console.log(
  "[CMS CONFIG] proxy base:",
  CMS_PROXY_BASE || "(none)",
  "| mocks:",
  USE_MOCKS
);
console.log(
  "[CMS CONFIG] mode:",
  USE_PROXY ? "proxy" : "direct",
  "| proxy base:",
  CMS_PROXY_BASE || "(none)",
  "| token present (direct only)?",
  Boolean(import.meta.env.VITE_CMS_APP_TOKEN)
);
