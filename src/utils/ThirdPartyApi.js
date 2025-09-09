// src/utils/ThirdPartyApi.js
const CMS_RESOURCE_BASE = "https://data.cms.gov/resource";
const DATASETS = {
  HOSPITALS: "xubh-q36u",
  HCAHPS: "dgck-syfz",
};

const APP_TOKEN = import.meta.env.VITE_CMS_APP_TOKEN || "";

// Helper: add token if present
function headers() {
  const h = {};
  if (APP_TOKEN) h["X-App-Token"] = APP_TOKEN;
  return h;
}

async function check(res) {
  if (res.ok) return res.json();
  const text = await res.text().catch(() => "");
  throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
}

// Search hospitals
export async function searchHospitals(
  { q = "", state = "", limit = 12, offset = 0 } = {},
  fetchOpts = {}
) {
  const url = new URL(`${CMS_RESOURCE_BASE}/${DATASETS.HOSPITALS}.json`);
  url.searchParams.set(
    "$select",
    "provider_id,hospital_name,city,state,phone_number,hospital_type,hospital_ownership,hospital_overall_rating"
  );
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$offset", String(offset));

  // Keep queries light when unauthenticated (avoid $order to prevent 403s)
  if (APP_TOKEN) url.searchParams.set("$order", "hospital_name");

  if (q) url.searchParams.set("$q", q); // text search
  if (state) url.searchParams.set("state", state); // exact two-letter state code

  const res = await fetch(url.toString(), {
    headers: headers(),
    signal: fetchOpts.signal,
  });
  return check(res); // returns an array
}

// HCAHPS for a provider
export async function getHcahps(providerId, fetchOpts = {}) {
  if (!providerId) return [];
  const url = new URL(`${CMS_RESOURCE_BASE}/${DATASETS.HCAHPS}.json`);
  url.searchParams.set("provider_id", providerId);
  url.searchParams.set("$limit", "50");
  url.searchParams.set("$order", "hcahps_measure_id");
  const res = await fetch(url.toString(), {
    headers: headers(),
    signal: fetchOpts.signal,
  });
  return check(res);
}
