// src/utils/ThirdPartyApi.js
// Vanilla fetch helpers for CMS (Socrata) API
// Uses your existing .env token if present

const CMS_RESOURCE_BASE = "https://data.cms.gov/resource";
const DATASETS = {
  HOSPITALS: "xubh-q36u",
  HCAHPS: "dgck-syfz",
};

const CMS_APP_TOKEN = import.meta.env.VITE_CMS_APP_TOKEN || "";
const DEFAULT_LIMIT = 24;

const check = async (res) => {
  if (res.ok) return res.json();
  const text = await res.text().catch(() => "");
  throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
};

const socrataUrl = (dataset, params = {}) => {
  const url = new URL(`${CMS_RESOURCE_BASE}/${dataset}.json`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  if (CMS_APP_TOKEN) url.searchParams.set("$$app_token", CMS_APP_TOKEN);
  return url.toString();
};

const socrataHeaders = () => {
  const h = {};
  if (CMS_APP_TOKEN) h["X-App-Token"] = CMS_APP_TOKEN;
  return h;
};

// Public: search hospitals
export async function searchHospitals(
  { q = "", state = "", limit = DEFAULT_LIMIT, offset = 0 } = {},
  fetchOpts = {}
) {
  const params = {
    $select: [
      "provider_id",
      "hospital_name",
      "city",
      "state",
      "phone_number",
      "hospital_type",
      "hospital_ownership",
      "hospital_overall_rating",
    ].join(","),
    $limit: String(limit),
    $offset: String(offset),
    $order: "hospital_name",
  };
  if (q) params.$q = q;
  if (state) params.state = state;

  const url = socrataUrl(DATASETS.HOSPITALS, params);
  const res = await fetch(url, {
    headers: socrataHeaders(),
    signal: fetchOpts.signal,
  });
  return check(res); // returns an array (Socrata)
}

// Public: HCAHPS for a provider
export async function getHcahps(providerId, fetchOpts = {}) {
  if (!providerId) return [];
  const url = socrataUrl(DATASETS.HCAHPS, {
    provider_id: providerId,
    $limit: "50",
    $order: "hcahps_measure_id",
  });
  const res = await fetch(url, {
    headers: socrataHeaders(),
    signal: fetchOpts.signal,
  });
  return check(res); // array
}
