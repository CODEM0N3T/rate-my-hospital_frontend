import {
  CMS_PROXY_BASE,
  DATASETS,
  PAGE_LIMIT,
  USE_MOCKS,
  USE_PROXY,
} from "../constants/CONFIG.js";
import { MOCK_HOSPITALS } from "../mocks/hospitals.js";
import { MOCK_HCAHPS } from "../mocks/hcahps.js";

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
const match = (t = "", q = "") =>
  String(t).toLowerCase().includes(String(q).toLowerCase());

async function mockFetchHospitals({ q = "", state = "", page = 1 } = {}) {
  await delay(200);
  const rows = MOCK_HOSPITALS.filter(
    (h) =>
      (!q || match(h.hospital_name, q) || match(h.city, q)) &&
      (!state || String(h.state) === String(state))
  );
  const start = (page - 1) * PAGE_LIMIT;
  return rows.slice(start, start + PAGE_LIMIT);
}
async function mockFetchHcahps(providerId) {
  await delay(150);
  return MOCK_HCAHPS[providerId] || [];
}

function proxyUrl(dataset, params = {}) {
  if (!CMS_PROXY_BASE) return "";
  const base = CMS_PROXY_BASE.replace(/\/+$/, "");
  const url = new URL(base);
  url.searchParams.set("dataset", dataset);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}

export function fetchHospitals(params = {}, fetchOpts = {}) {
  if (USE_MOCKS || !USE_PROXY || !CMS_PROXY_BASE) {
    if (!CMS_PROXY_BASE && USE_PROXY)
      console.warn("[CMS] CMS_PROXY_BASE missing; using mocks");
    return mockFetchHospitals(params);
  }
  const { q = "", state = "", page = 1 } = params;
  const url = proxyUrl(DATASETS.HOSPITALS, {
    size: String(PAGE_LIMIT),
    offset: String((page - 1) * PAGE_LIMIT),
    ...(q ? { q } : {}),
    ...(state ? { state } : {}),
  });
  return fetch(url, fetchOpts)
    .then(check)
    .catch((err) => {
      console.warn("[CMS] proxy failed, using mocks:", err?.message || err);
      return mockFetchHospitals(params);
    });
}

export function fetchHcahps(providerId, fetchOpts = {}) {
  if (!providerId) return Promise.resolve([]);
  if (USE_MOCKS || !USE_PROXY || !CMS_PROXY_BASE) {
    if (!CMS_PROXY_BASE && USE_PROXY)
      console.warn("[CMS] CMS_PROXY_BASE missing; using mocks (HCAHPS)");
    return mockFetchHcahps(providerId);
  }
  const url = proxyUrl(DATASETS.HCAHPS, {
    provider_id: providerId,
    size: "50",
  });
  return fetch(url, fetchOpts)
    .then(check)
    .catch((err) => {
      console.warn(
        "[CMS] proxy failed (HCAHPS), using mocks:",
        err?.message || err
      );
      return mockFetchHcahps(providerId);
    });
}
