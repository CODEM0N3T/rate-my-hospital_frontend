// netlify/functions/cms-proxy.js

// Ensure fetch exists (Node 18 has it; fallback to node-fetch for safety)
let _fetch = globalThis.fetch;
async function getFetch() {
  if (_fetch) return _fetch;
  const mod = await import("node-fetch");
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

exports.handler = async (event) => {
  // Always handle preflight with CORS headers
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    // Parse query safely from the full URL
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

    const size = qs.get("size") || qs.get("$limit") || "24";
    const offset = qs.get("offset") || qs.get("$offset") || "0";
    const q = qs.get("q") || qs.get("$q") || "";
    const state = qs.get("state") || "";

    // Build query strings
    const providerQS = new URLSearchParams();
    providerQS.set("size", String(size));
    providerQS.set("offset", String(offset));
    if (q) providerQS.set("keyword", q);

    const sodataQS = new URLSearchParams();
    sodataQS.set("$limit", String(size));
    sodataQS.set("$offset", String(offset));
    if (q) sodataQS.set("$q", q);

    const upstreams = [
      ...PROVIDER_CANDIDATES.map((f) => f(dataset, providerQS.toString())),
      MEDICARE_SODATA(dataset, sodataQS.toString()),
    ];

    const fetch = await getFetch();
    let lastErr = null;
    let rows = null;

    for (const u of upstreams) {
      try {
        const headers = { Accept: "application/json" };
        if (u.includes("data.medicare.gov") && process.env.CMS_APP_TOKEN) {
          headers["X-App-Token"] = process.env.CMS_APP_TOKEN;
        }
        const res = await fetch(u, { headers, redirect: "follow" });
        const text = await res.text();
        if (!res.ok) {
          lastErr = new Error(
            `${res.status} ${res.statusText}: ${text.slice(0, 300)}`
          );
          console.error("[cms-proxy] upstream error:", u, lastErr.message);
          continue;
        }
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          lastErr = new Error(`Invalid JSON from ${u}`);
          console.error("[cms-proxy] parse error:", u);
          continue;
        }
        rows = (Array.isArray(json) ? json : json.items || []).map(pickFields);
        break;
      } catch (e) {
        lastErr = e;
        console.error("[cms-proxy] fetch failed:", e?.message || e, "url:", u);
        continue;
      }
    }

    if (!rows) {
      return {
        statusCode: 502,
        headers: CORS, // CORS even on error
        body: JSON.stringify({
          error: "Upstream fetch failed",
          detail: String(lastErr || "unknown"),
        }),
      };
    }

    const filtered = applyFilters(rows, { q, state });

    return {
      statusCode: 200,
      headers: CORS, // ✅ CORS on success
      body: JSON.stringify(filtered),
    };
  } catch (err) {
    console.error("[cms-proxy] handler error:", err);
    // ✅ CORS even on unexpected crashes
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
