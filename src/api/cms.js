// src/api/cms.js
import {
  CMS_DIRECT_BASE, // e.g. "https://data.medicare.gov/resource"
  CMS_PROXY_BASE, // e.g. "https://<site>.netlify.app/.netlify/functions/cms-proxy"
  DATASETS,
  PAGE_LIMIT,
  CMS_APP_TOKEN, // used only in direct mode
  USE_MOCKS,
  USE_PROXY, // true when CMS_PROXY_BASE is set
} from "../constants/CONFIG.js";

import { MOCK_HOSPITALS } from "../mocks/hospitals.js";
import { MOCK_HCAHPS } from "../mocks/hcahps.js";

/* -------------------- helpers -------------------- */

const check = async (res) => {
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build a URL to either your serverless proxy (preferred) or directly to
 * Medicare's Socrata host, keeping all $-params intact.
 */
function buildTargetUrl(dataset, params = {}) {
  if (USE_PROXY) {
    const base = CMS_PROXY_BASE.replace(/\/+$/, "");
    const url = new URL(base); // https://<site>/.netlify/functions/cms-proxy
    url.searchParams.set("dataset", dataset);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
    return url.toString();
  }
  const base = CMS_DIRECT_BASE.replace(/\/+$/, "");
  const url = new URL(`${base}/${dataset}.json`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}

/** In proxy mode, don't send token from the browser. */
function requestHeaders() {
  const h = { Accept: "application/json" };
  if (!USE_PROXY && CMS_APP_TOKEN) h["X-App-Token"] = CMS_APP_TOKEN;
  return h;
}

/**
 * In direct mode with token: try with token, on 403 retry without.
 * In proxy mode: simple fetch (the function adds token if configured).
 */
async function fetchSocrata(url, { signal } = {}) {
  if (!USE_PROXY && CMS_APP_TOKEN) {
    const res = await fetch(url, { headers: requestHeaders(), signal });
    if (res.status === 403) {
      const res2 = await fetch(url, {
        headers: { Accept: "application/json" },
        signal,
      });
      return check(res2);
    }
    return check(res);
  }
  const res = await fetch(url, { headers: requestHeaders(), signal });
  return check(res);
}

/* -------------------- mocks -------------------- */

function match(text = "", query = "") {
  return String(text).toLowerCase().includes(String(query).toLowerCase());
}

async function mockFetchHospitals({ q = "", state = "", page = 1 } = {}) {
  await delay(250);
  const rows = MOCK_HOSPITALS.filter((h) => {
    const passQ = !q || match(h.hospital_name, q) || match(h.city, q);
    const passState = !state || h.state === state;
    return passQ && passState;
  });
  const start = (page - 1) * PAGE_LIMIT;
  return rows.slice(start, start + PAGE_LIMIT);
}

async function mockFetchHcahps(providerId) {
  await delay(180);
  return MOCK_HCAHPS[providerId] || [];
}

/* -------------------- public API -------------------- */

/**
 * Fetch a page of hospitals with optional query/state.
 * Returns an array of raw rows; you already map them in Home.jsx.
 */
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
    // $order: "hospital_name", // enable later if you switch to direct mode
  };
  if (q) query.$q = q;
  if (state) query.state = state;

  const url = buildTargetUrl(DATASETS.HOSPITALS, query);

  return fetchSocrata(url, fetchOpts).catch((err) => {
    if (err?.name === "AbortError") throw err; // respect aborts from UI
    console.warn("[CMS] falling back to mocks due to:", err);
    return mockFetchHospitals(params);
  });
}

/**
 * Fetch HCAHPS rows for a given provider.
 */
export function fetchHcahps(providerId, fetchOpts = {}) {
  if (!providerId) return Promise.resolve([]);
  if (USE_MOCKS) return mockFetchHcahps(providerId);

  const url = buildTargetUrl(DATASETS.HCAHPS, {
    provider_id: providerId,
    $limit: "50",
    // $order: "hcahps_measure_id",
  });

  return fetchSocrata(url, fetchOpts).catch((err) => {
    if (err?.name === "AbortError") throw err;
    console.warn("[CMS] falling back to mocks due to:", err);
    return mockFetchHcahps(providerId);
  });
}
