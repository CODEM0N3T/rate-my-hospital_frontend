export const CMS_RESOURCE_BASE = "https://data.medicare.gov/resource";

export const DATASETS = { HOSPITALS: "xubh-q36u", HCAHPS: "dgck-syfz" };
export const PAGE_LIMIT = 24;

export const CMS_APP_TOKEN = import.meta.env.VITE_CMS_APP_TOKEN || "";
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

console.log(
  "[CMS] token present?",
  Boolean(CMS_APP_TOKEN),
  CMS_APP_TOKEN ? CMS_APP_TOKEN.slice(0, 4) + "…" : ""
);
