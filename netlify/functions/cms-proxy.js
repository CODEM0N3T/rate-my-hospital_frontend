// netlify/functions/cms-proxy.js

// Use native fetch if available (Node 18+). Fallback to node-fetch.
let _fetch = globalThis.fetch;
async function ensureFetch() {
  if (_fetch) return _fetch;
  const mod = await import("node-fetch");
  _fetch = mod.default;
  return _fetch;
}

const CMS_PROVIDER_CANDIDATES = [
  // New Provider Data API endpoints
  (dataset, qs) =>
    `https://data.cms.gov/provider-data/api/v1/dataset/${encodeURIComponent(
      dataset
    )}/data?${qs}`,
  (dataset, qs) =>
    `https://data.cms.gov/data-api/v1/dataset/${encodeURIComponent(
      dataset
    )}/data?${qs}`,
];

// Socrata fallback (Medicare)
const MEDICARE_SODATA = (dataset, qs) =>
  `https://data.medicare.gov/resource/${encodeURIComponent(
    dataset
  )}.json?${qs}`;

// CORS
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Cache-Control": "public, max-age=60",
};

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

function contains(h = "", n = "") {
  return String(h || "")
    .toLowerCase()
    .includes(String(n || "").toLowerCase());
}

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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    const qsIn = new URLSearchParams(event.rawQuery || "");
    const dataset = qsIn.get("dataset");
    if (!dataset) {
      return { statusCode: 400, headers: CORS, body: "Missing dataset" };
    }

    // Normalize params
    const size = qsIn.get("size") || qsIn.get("$limit") || "24";
    const offset = qsIn.get("offset") || qsIn.get("$offset") || "0";
    const q = qsIn.get("q") || qsIn.get("$q") || "";
    const state = qsIn.get("state") || "";

    // Provider Data API params
    const providerQS = new URLSearchParams();
    providerQS.set("size", String(size));
    providerQS.set("offset", String(offset));
    if (q) providerQS.set("keyword", q); // some endpoints support "keyword"

    // Socrata params
    const sodataQS = new URLSearchParams();
    sodataQS.set("$limit", String(size));
    sodataQS.set("$offset", String(offset));
    if (q) sodataQS.set("$q", q);

    const upstreams = [
      ...CMS_PROVIDER_CANDIDATES.map((f) => f(dataset, providerQS.toString())),
      MEDICARE_SODATA(dataset, sodataQS.toString()),
    ];

    const fetch = await ensureFetch();
    let lastErr = null;
    let rows = null;

    for (const url of upstreams) {
      try {
        const headers = { Accept: "application/json" };
        if (url.includes("data.medicare.gov") && process.env.CMS_APP_TOKEN) {
          headers["X-App-Token"] = process.env.CMS_APP_TOKEN;
        }

        const res = await fetch(url, { headers, redirect: "follow" });
        const text = await res.text();

        if (!res.ok) {
          lastErr = new Error(
            `${res.status} ${res.statusText}: ${text.slice(0, 300)}`
          );
          console.error("[cms-proxy] Upstream error", url, String(lastErr));
          continue;
        }

        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          lastErr = new Error(`Invalid JSON from ${url}`);
          console.error(
            "[cms-proxy] JSON parse error",
            url,
            text.slice(0, 200)
          );
          continue;
        }

        rows = (Array.isArray(json) ? json : json.items || []).map(pickFields);
        break;
      } catch (e) {
        lastErr = e;
        console.error("[cms-proxy] fetch failed", e?.message || e, "URL:", url);
        continue;
      }
    }

    if (!rows) {
      return {
        statusCode: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Upstream fetch failed",
          detail: String(lastErr || "unknown"),
        }),
      };
    }

    const filtered = applyFilters(rows, { q, state });

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify(filtered),
    };
  } catch (err) {
    console.error("[cms-proxy] handler error", err);
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
