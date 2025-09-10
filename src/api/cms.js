// src/api/cms.js
import {
  CMS_PROXY_BASE,
  DATASETS,
  PAGE_LIMIT,
  USE_MOCKS,
} from "../constants/CONFIG.js";
import { MOCK_HOSPITALS } from "../mocks/hospitals.js";
import { MOCK_HCAHPS } from "../mocks/hcahps.js";

// -------- helpers --------
const check = async (res) => {
  const text = await res.text().catch(() => "");
  if (!res.ok)
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function proxyUrl(dataset, params = {}) {
  const base = (CMS_PROXY_BASE || "").replace(/\/+$/, "");
  if (!base) throw new Error("CMS_PROXY_BASE missing");
  const url = new URL(base); // e.g. https://YOUR-SITE.netlify.app/.netlify/functions/cms-proxy
  url.searchParams.set("dataset", dataset);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}

// -------- mocks --------
function match(txt = "", q = "") {
  return String(txt).toLowerCase().includes(String(q).toLowerCase());
}
async function mockFetchHospitals({ q = "", state = "", page = 1 } = {}) {
  await delay(200);
  const rows = MOCK_HOSPITALS.filter((h) => {
    const passQ = !q || match(h.hospital_name, q) || match(h.city, q);
    const passS = !state || String(h.state) === String(state);
    return passQ && passS;
  });
  const start = (page - 1) * PAGE_LIMIT;
  return rows.slice(start, start + PAGE_LIMIT);
}
async function mockFetchHcahps(providerId) {
  await delay(150);
  return MOCK_HCAHPS[providerId] || [];
}

// -------- PUBLIC API (named exports!) --------
export function fetchHospitals(params = {}, fetchOpts = {}) {
  if (USE_MOCKS) return mockFetchHospitals(params);

  const { q = "", state = "", page = 1 } = params;
  const query = {
    size: String(PAGE_LIMIT),
    offset: String((page - 1) * PAGE_LIMIT),
  };
  if (q) query.q = q;
  if (state) query.state = state;

  const url = proxyUrl(DATASETS.HOSPITALS, query);
  return fetch(url, fetchOpts)
    .then(check)
    .catch((err) => {
      console.warn("[CMS] proxy failed, using mocks:", err.message || err);
      return mockFetchHospitals(params);
    });
}

export function fetchHcahps(providerId, fetchOpts = {}) {
  if (!providerId) return Promise.resolve([]);
  if (USE_MOCKS) return mockFetchHcahps(providerId);

  const url = proxyUrl(DATASETS.HCAHPS, {
    provider_id: providerId,
    size: "50",
  });
  return fetch(url, fetchOpts)
    .then(check)
    .catch((err) => {
      console.warn(
        "[CMS] proxy failed (HCAHPS), using mocks:",
        err.message || err
      );
      return mockFetchHcahps(providerId);
    });
}
