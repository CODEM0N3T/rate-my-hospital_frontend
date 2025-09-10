// netlify/functions/cms-proxy.js

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

// ~3.5s per upstream call
const PER_UPSTREAM_TIMEOUT = Number(
  process.env.CMS_UPSTREAM_TIMEOUT_MS || 3500
);

// New Provider Data API (dataset GUIDs, but we'll try the Socrata 4x4 too)
// NOTE: Some datasets require a GUID, not the 4x4. If the 4x4 fails, this may 404/timeout.
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

// Socrata (legacy medicare domain)
const MEDICARE_SODATA = (dataset, qs) =>
  `https://data.medicare.gov/resource/${encodeURIComponent(
    dataset
  )}.json?${qs}`;

// Small built-in sample so your UI never breaks during outages
const SAMPLE_ROWS = [
  {
    provider_id: "10001",
    hospital_name: "Sample General Hospital",
    city: "Springfield",
    state: "IL",
    phone_number: "(217) 555-0100",
    hospital_type: "Acute Care Hospitals",
    hospital_ownership: "Government - Hospital District or Authority",
    hospital_overall_rating: "4",
  },
  {
    provider_id: "10002",
    hospital_name: "River Valley Medical Center",
    city: "Columbus",
    state: "OH",
    phone_number: "(614) 555-0102",
    hospital_type: "Acute Care Hospitals",
    hospital_ownership: "Proprietary",
    hospital_overall_rating: "3",
  },
  {
    provider_id: "10003",
    hospital_name: "Coastal Health Clinic",
    city: "Savannah",
    state: "GA",
    phone_number: "(912) 555-0103",
    hospital_type: "Critical Access Hospitals",
    hospital_ownership: "Voluntary non-profit - Private",
    hospital_overall_rating: "5",
  },
];

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

    // Optional: force a specific upstream via ?mode=socrata
    const mode = (qs.get("mode") || "").toLowerCase();

    // Normalize inputs
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

    const upstreams =
      mode === "socrata"
        ? [MEDICARE_SODATA(dataset, sodataQS.toString())]
        : [
            ...PROVIDER_CANDIDATES.map((f) =>
              f(dataset, providerQS.toString())
            ),
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

    // Final fallback: ship a small sample so your UI always renders
    if (!rows) {
      console.warn(
        "[cms-proxy] returning SAMPLE_ROWS due to:",
        lastErr?.message || lastErr
      );
      const filtered = applyFilters(SAMPLE_ROWS, { q, state });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(filtered) };
    }

    const filtered = applyFilters(rows, { q, state });
    return { statusCode: 200, headers: CORS, body: JSON.stringify(filtered) };
  } catch (err) {
    console.error("[cms-proxy] handler error:", err);
    return {
      statusCode: 200, // still return 200 with sample so frontend stays happy
      headers: CORS,
      body: JSON.stringify(SAMPLE_ROWS),
    };
  }
};
