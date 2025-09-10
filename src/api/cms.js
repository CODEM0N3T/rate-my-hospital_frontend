// netlify/functions/cms-proxy.js

let _fetch = globalThis.fetch;
async function getFetch() {
  if (_fetch) return _fetch;
  const mod = await import("node-fetch"); // ensure node-fetch ^3 is in dependencies
  _fetch = mod.default;
  return _fetch;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Cache-Control": "public, max-age=60",
  "Content-Type": "application/json",
};

// ~3.5s per upstream; you can tweak via env CMS_UPSTREAM_TIMEOUT_MS
const PER_UPSTREAM_TIMEOUT = Number(
  process.env.CMS_UPSTREAM_TIMEOUT_MS || 3500
);

// Provider Data API (new CMS)
const PROVIDER_CANDIDATES = [
  (dataset, qs) =>
    `https://data.cms.gov/provider-data/api/v1/dataset/${encodeURIComponent(
      dataset
    )}/data?${qs}`,
  (dataset, qs) =>
    `https://data.cms.gov/data-api/v1/dataset/${encodeURIComponent(
      dataset
    )}/data?${qs}`,
];

// Socrata fallback (optional)
const MEDICARE_SODATA = (dataset, qs) =>
  `https://data.medicare.gov/resource/${encodeURIComponent(
    dataset
  )}.json?${qs}`;

function pickFields(row = {}) {
  return {
    provider_id: row.provider_id || row.ccn || row.providerid || null,
    hospital_name:
      row.hospital_name ||
      row.hospitalname ||
      row.facility_name ||
      row.name ||
      null,
    city: row.city || null,
    state: row.state || null,
    phone_number: row.phone_number || row.phone || null,
    hospital_type: row.hospital_type || row.type || null,
    hospital_ownership: row.hospital_ownership || row.ownership || null,
    hospital_overall_rating:
      row.hospital_overall_rating ||
      row.overall_rating ||
      row.hcahps_star_rating ||
      null,
  };
}
const contains = (h = "", n = "") =>
  String(h || "")
    .toLowerCase()
    .includes(String(n || "").toLowerCase());

function applyFilters(rows, { q, state }) {
  let out = rows || [];
  if (q)
    out = out.filter(
      (r) => contains(r.hospital_name, q) || contains(r.city, q)
    );
  if (state)
    out = out.filter(
      (r) => String(r.state || "").toUpperCase() === String(state).toUpperCase()
    );
  return out;
}

async function fetchWithTimeout(url, opts = {}, ms = PER_UPSTREAM_TIMEOUT) {
  const fetch = await getFetch();
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(new Error("timeout")), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    console.log("[cms-proxy] node:", process.version, "url:", event.rawUrl);

    const url = new URL(
      event.rawUrl ||
        `https://example.com${event.path}${
          event.rawQuery ? "?" + event.rawQuery : ""
        }`
    );
    const qs = url.searchParams;

    const dataset = qs.get("dataset");
    if (!dataset) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "Missing dataset" }),
      };
    }

    // Normalize inputs
    const size = qs.get("size") || qs.get("$limit") || "24";
    const offset = qs.get("offset") || qs.get("$offset") || "0";
    const q = qs.get("q") || qs.get("$q") || "";
    const state = qs.get("state") || "";

    // Provider Data API params
    const providerQS = new URLSearchParams();
    providerQS.set("size", String(size));
    providerQS.set("offset", String(offset));
    if (q) providerQS.set("keyword", q);

    // Socrata params (optional)
    const sodataQS = new URLSearchParams();
    sodataQS.set("$limit", String(size));
    sodataQS.set("$offset", String(offset));
    if (q) sodataQS.set("$q", q);

    // Try Provider API first, then Socrata
    const upstreams = [
      ...PROVIDER_CANDIDATES.map((f) => f(dataset, providerQS.toString())),
      MEDICARE_SODATA(dataset, sodataQS.toString()),
    ];

    let rows = null;
    let lastErr = null;

    for (const upstreamURL of upstreams) {
      try {
        const headers = { Accept: "application/json" };
        if (
          upstreamURL.includes("data.medicare.gov") &&
          process.env.CMS_APP_TOKEN
        ) {
          headers["X-App-Token"] = process.env.CMS_APP_TOKEN;
        }

        console.log("[cms-proxy] fetching:", upstreamURL);
        const res = await fetchWithTimeout(upstreamURL, {
          headers,
          redirect: "follow",
        });
        const text = await res.text();

        if (!res.ok) {
          lastErr = new Error(
            `${res.status} ${res.statusText}: ${text.slice(0, 300)}`
          );
          console.error(
            "[cms-proxy] upstream error:",
            upstreamURL,
            lastErr.message
          );
          continue;
        }

        let json;
        try {
          json = JSON.parse(text);
        } catch {
          lastErr = new Error(`Invalid JSON from ${upstreamURL}`);
          console.error("[cms-proxy] parse error:", upstreamURL);
          continue;
        }

        rows = (Array.isArray(json) ? json : json.items || []).map(pickFields);
        break; // success
      } catch (e) {
        lastErr = e;
        console.error(
          "[cms-proxy] fetch failed:",
          e?.message || e,
          "url:",
          upstreamURL
        );
        continue;
      }
    }

    if (!rows) {
      return {
        statusCode: 502,
        headers: CORS,
        body: JSON.stringify({
          error: "Upstream fetch failed",
          detail: String(lastErr || "unknown"),
        }),
      };
    }

    const filtered = applyFilters(rows, { q, state });
    return { statusCode: 200, headers: CORS, body: JSON.stringify(filtered) };
  } catch (err) {
    console.error("[cms-proxy] handler error:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        error: "Function error",
        detail: String(err?.message || err),
      }),
    };
  }
};
