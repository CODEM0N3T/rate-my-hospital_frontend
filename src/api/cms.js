// src/api/cms.js
import {
  CMS_PROXY_BASE,
  DATASETS,
  PAGE_LIMIT,
  USE_MOCKS,
  USE_PROXY,
} from "../constants/CONFIG.js";
import { MOCK_HOSPITALS } from "../mocks/hospitals.js";
import { MOCK_HCAHPS } from "../mocks/hcahps.js";
import { searchHospitals, getHcahps } from "../utils/ThirdPartyApi.js";

const check = async (res) => {
  const text = await res.text().catch(() => "");
  if (!res.ok)
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text; // tolerate plain text
  }
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const match = (t = "", q = "") =>
  String(t).toLowerCase().includes(String(q).toLowerCase());
const toArray = (input) =>
  Array.isArray(input) ? input : (input && input.data) || [];
const isAbort = (e) =>
  e?.name === "AbortError" || /aborted/i.test(String(e?.message || e));

async function mockFetchHospitals({ q = "", state = "", page = 1 } = {}) {
  await delay(120);
  const rows = MOCK_HOSPITALS.filter(
    (h) =>
      (!q || match(h.hospital_name, q) || match(h.city, q)) &&
      (!state || String(h.state) === String(state))
  );
  const start = (page - 1) * PAGE_LIMIT;
  return rows.slice(start, start + PAGE_LIMIT);
}

async function mockFetchHcahps(providerId) {
  await delay(100);
  return MOCK_HCAHPS[providerId] || [];
}

function proxyUrl(dataset, params = {}) {
  if (!CMS_PROXY_BASE) return "";
  const base = CMS_PROXY_BASE.replace(/\/+$/, "");
  const filtered = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    )
  );
  const qs = new URLSearchParams({ dataset, ...filtered }).toString();
  return `${base}?${qs}`;
}

// ---------- Public API ----------

export function fetchHospitals(params = {}, fetchOpts = {}) {
  const { q = "", state = "", page = 1 } = params;

  // Go straight to mocks if proxy disabled
  if (USE_MOCKS || !USE_PROXY || !CMS_PROXY_BASE) {
    if (!CMS_PROXY_BASE && USE_PROXY)
      console.warn("[CMS] CMS_PROXY_BASE missing; using mocks");
    return mockFetchHospitals({ q, state, page });
  }

  const url = proxyUrl(DATASETS.HOSPITALS, {
    size: String(PAGE_LIMIT),
    offset: String((page - 1) * PAGE_LIMIT),
    ...(q ? { q } : {}),
    ...(state ? { state } : {}),
  });

  return fetch(url, fetchOpts)
    .then(check)
    .then(toArray)
    .catch(async (err) => {
      if (isAbort(err)) {
        // navigation/unmount — don't spam logs, just return empty page
        return [];
      }
      console.warn("[CMS] proxy failed, trying direct:", err?.message || err);
      try {
        const data = await searchHospitals({
          q,
          state,
          limit: PAGE_LIMIT,
          offset: (page - 1) * PAGE_LIMIT,
        });
        return data;
      } catch (e2) {
        if (!isAbort(e2)) {
          console.warn("[CMS] direct failed, using mocks:", e2?.message || e2);
        }
        return mockFetchHospitals({ q, state, page });
      }
    });
}

export function fetchHcahps(providerId, fetchOpts = {}) {
  if (!providerId) return Promise.resolve([]);

  if (USE_MOCKS || !USE_PROXY || !CMS_PROXY_BASE) {
    if (!CMS_PROXY_BASE && USE_PROXY) {
      console.warn("[CMS] CMS_PROXY_BASE missing; using mocks (HCAHPS)");
    }
    return mockFetchHcahps(providerId);
  }

  const url = proxyUrl(DATASETS.HCAHPS, {
    provider_id: providerId,
    size: "50",
  });

  return fetch(url, fetchOpts)
    .then(check)
    .then(toArray)
    .catch(async (err) => {
      if (isAbort(err)) return [];
      console.warn(
        "[CMS] proxy failed (HCAHPS), trying direct:",
        err?.message || err
      );
      try {
        const data = await getHcahps(providerId);
        return data;
      } catch (e2) {
        if (!isAbort(e2)) {
          console.warn(
            "[CMS] direct failed (HCAHPS), using mocks:",
            e2?.message || e2
          );
        }
        return mockFetchHcahps(providerId);
      }
    });
}
