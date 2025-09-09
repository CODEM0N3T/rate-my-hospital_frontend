// src/api/cms.js
import {
  CMS_RESOURCE_BASE,
  DATASETS,
  PAGE_LIMIT,
  CMS_APP_TOKEN,
  USE_MOCKS,
  USE_PUBLIC_PROXY,
  PUBLIC_PROXY_PREFIX,
} from "../constants/CONFIG.js";

import { MOCK_HOSPITALS } from "../mocks/hospitals.js";
import { MOCK_HCAHPS } from "../mocks/hcahps.js";

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

function buildTargetUrl(dataset, params = {}) {
  const base = CMS_RESOURCE_BASE.replace(/\/+$/, "");
  const url = new URL(`${base}/${dataset}.json`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}

// Prefix-style proxy: just prepend the full URL (no encoding)
function wrapWithProxy(targetUrl) {
  return USE_PUBLIC_PROXY ? `${PUBLIC_PROXY_PREFIX}${targetUrl}` : targetUrl;
}

// Do not send token header through public proxy
function socrataHeaders() {
  if (USE_PUBLIC_PROXY) return {};
  return CMS_APP_TOKEN ? { "X-App-Token": CMS_APP_TOKEN } : {};
}

// Try with header if not proxying; on 403 retry without header
async function fetchSocrata(url, { signal } = {}) {
  if (!USE_PUBLIC_PROXY && CMS_APP_TOKEN) {
    const res = await fetch(url, { headers: socrataHeaders(), signal });
    if (res.status === 403) {
      const res2 = await fetch(url, { signal });
      return check(res2);
    }
    return check(res);
  }
  const res = await fetch(url, { signal });
  return check(res);
}

/* -------------------- MOCKS -------------------- */
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
/* ------------------------------------------------ */

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
    // $order: "hospital_name", // enable later if you drop the proxy
  };
  if (q) query.$q = q;
  if (state) query.state = state;

  const target = buildTargetUrl(DATASETS.HOSPITALS, query);
  const url = wrapWithProxy(target);

  return fetchSocrata(url, fetchOpts).catch((err) => {
    if (err?.name === "AbortError") throw err;
    console.warn("[CMS] falling back to mocks due to:", err);
    return mockFetchHospitals(params);
  });
}

export function fetchHcahps(providerId, fetchOpts = {}) {
  if (!providerId) return Promise.resolve([]);
  if (USE_MOCKS) return mockFetchHcahps(providerId);

  const target = buildTargetUrl(DATASETS.HCAHPS, {
    provider_id: providerId,
    $limit: "50",
  });
  const url = wrapWithProxy(target);

  return fetchSocrata(url, fetchOpts).catch((err) => {
    if (err?.name === "AbortError") throw err;
    console.warn("[CMS] falling back to mocks due to:", err);
    return mockFetchHcahps(providerId);
  });
}
