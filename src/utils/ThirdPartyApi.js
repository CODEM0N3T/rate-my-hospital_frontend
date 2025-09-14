// src/utils/ThirdPartyApi.js
const CMS_RESOURCE_BASE = "https://data.medicare.gov/resource"; // <-- Socrata host
const DATASETS = {
  HOSPITALS: "xubh-q36u",
  HCAHPS: "dgck-syfz",
};

// Use whichever env you have set
const APP_TOKEN =
  import.meta.env.VITE_SOCRATA_APP_TOKEN ||
  import.meta.env.VITE_CMS_APP_TOKEN ||
  "";

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

// Search hospitals (client-side direct)
export async function searchHospitals(
  { q = "", state = "", limit = 24, offset = 0 } = {},
  fetchOpts = {}
) {
  const url = new URL(`${CMS_RESOURCE_BASE}/${DATASETS.HOSPITALS}.json`);
  url.searchParams.set(
    "$select",
    "provider_id,hospital_name,city,state,phone_number,hospital_type,hospital_ownership,hospital_overall_rating"
  );
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$offset", String(offset));
  if (q) url.searchParams.set("$q", q);
  if (state) url.searchParams.set("state", state);
  // Optional: ordering when token present
  if (APP_TOKEN) url.searchParams.set("$order", "hospital_name");

  const res = await fetch(url.toString(), {
    headers: headers(),
    signal: fetchOpts.signal,
  });
  return check(res); // array
}

// HCAHPS rows for one provider (client-side direct)
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
