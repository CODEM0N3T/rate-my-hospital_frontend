import {
  CMS_RESOURCE_BASE,
  DATASETS,
  PAGE_LIMIT,
  CMS_APP_TOKEN,
  USE_MOCKS,
} from "../constants/CONFIG.js";

import { MOCK_HOSPITALS } from "../mocks/hospitals.js";
import { MOCK_HCAHPS } from "../mocks/hcahps.js";

const check = async (res) => {
  if (res.ok) return res.json();
  const body = await res.text();
  throw new Error(`${res.status} ${res.statusText}: ${body}`);
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function socrataUrl(dataset, params = {}) {
  const url = new URL(`${CMS_RESOURCE_BASE}/${dataset}.json`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  if (CMS_APP_TOKEN) url.searchParams.set("$$app_token", CMS_APP_TOKEN);
  return url.toString();
}

/* -------------------- MOCK IMPLEMENTATIONS -------------------- */
function match(text = "", query = "") {
  return text.toLowerCase().includes(query.toLowerCase());
}

async function mockFetchHospitals({ q = "", state = "", page = 1 } = {}) {
  await delay(250); // simulate network
  let rows = MOCK_HOSPITALS.filter((h) => {
    const passQ = !q || match(h.hospital_name, q) || match(h.city, q);
    const passState = !state || h.state === state;
    return passQ && passState;
  });
  const start = (page - 1) * PAGE_LIMIT;
  const end = start + PAGE_LIMIT;
  return rows.slice(start, end);
}

async function mockFetchHcahps(providerId) {
  await delay(180);
  return MOCK_HCAHPS[providerId] || [];
}
/* -------------------------------------------------------------- */

/** PUBLIC: fetch hospitals (mock or real) */
export function fetchHospitals(params = {}, fetchOpts = {}) {
  if (USE_MOCKS) return mockFetchHospitals(params);

  const { q = "", state = "", page = 1 } = params;
  const limit = PAGE_LIMIT;
  const offset = (page - 1) * limit;

  const query = {
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
    // $order: "hospital_name", // add later if your token is working
  };
  if (q) query.$q = q;
  if (state) query.state = state;

  const url = socrataUrl(DATASETS.HOSPITALS, query);

  return fetch(url, { signal: fetchOpts.signal })
    .then(check)
    .catch((err) => {
      console.warn("[CMS] falling back to mocks due to:", err);
      return mockFetchHospitals(params); // graceful fallback
    });
}

/** PUBLIC: fetch HCAHPS (mock or real) */
export function fetchHcahps(providerId, fetchOpts = {}) {
  if (!providerId) return Promise.resolve([]);
  if (USE_MOCKS) return mockFetchHcahps(providerId);

  const url = socrataUrl(DATASETS.HCAHPS, {
    provider_id: providerId,
    $limit: "50",
  });

  return fetch(url, { signal: fetchOpts.signal })
    .then(check)
    .catch((err) => {
      console.warn("[CMS] falling back to mocks due to:", err);
      return mockFetchHcahps(providerId);
    });
}
