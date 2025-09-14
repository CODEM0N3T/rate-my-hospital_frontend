// netlify/functions/cms-proxy.js (ESM, Node 18+)
import dns from "node:dns";
dns.setDefaultResultOrder?.("ipv4first");

const SOCRATA_4X4 = /^[a-z0-9]{4}-[a-z0-9]{4}$/i;

const SAMPLE = {
  "xubh-q36u": [
    {
      provider_id: "123456",
      hospital_name: "Sample Medical Center",
      city: "Springfield",
      state: "IL",
      phone_number: "555-123-4567",
      hospital_type: "Acute Care Hospitals",
      hospital_ownership: "Voluntary non-profit",
      hospital_overall_rating: "4",
    },
  ],
  "dgck-syfz": [
    {
      provider_id: "123456",
      hcahps_measure_id: "H_COMP_1_A_P",
      measure_name: "Nurses always communicated well",
      hcahps_star_rating: "4",
    },
  ],
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
    Vary: "Origin",
  };
}

async function fetchWithTimeout(url, { headers, ms = 20000 } = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { headers, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function handler(event) {
  const origin = event.headers?.origin || "*";
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin), body: "" };
  }

  try {
    const qs = event.queryStringParameters || {};
    const dataset = qs.dataset;
    if (!dataset) {
      return {
        statusCode: 400,
        headers: corsHeaders(origin),
        body: JSON.stringify({ error: "Missing ?dataset=" }),
      };
    }

    let upstreamUrl = "";
    let headers = {};

    if (SOCRATA_4X4.test(dataset)) {
      // Socrata (data.medicare.gov)
      const base = `https://data.medicare.gov/resource/${dataset}.json`;
      const p = new URLSearchParams();
      const size = Number(qs.size ?? 24);
      const offset = Number(qs.offset ?? 0);
      if (!Number.isNaN(size)) p.set("$limit", String(size));
      if (!Number.isNaN(offset)) p.set("$offset", String(offset));
      if (qs.q) p.set("$q", qs.q);
      if (qs.state) p.set("state", String(qs.state));
      upstreamUrl = `${base}?${p.toString()}`;

      if (process.env.SOCRATA_APP_TOKEN)
        headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
      // Some corp networks require a UA
      headers["User-Agent"] = headers["User-Agent"] || "rmh-netlify-proxy/1.0";
    } else if (/^[0-9a-f-]{36}$/i.test(dataset)) {
      // UUID (data.cms.gov)
      const base = `https://data.cms.gov/data-api/v1/dataset/${dataset}/data`;
      const p = new URLSearchParams();
      if (qs.size) p.set("size", String(qs.size));
      if (qs.offset) p.set("offset", String(qs.offset));
      if (qs.q) p.set("keyword", qs.q);
      if (qs.state) p.set("filter[state]", String(qs.state));
      upstreamUrl = `${base}?${p.toString()}`;
    } else {
      return {
        statusCode: 200,
        headers: corsHeaders(origin),
        body: JSON.stringify({
          note: "FALLBACK (unsupported dataset key)",
          data: SAMPLE[dataset] || [],
        }),
      };
    }

    const res = await fetchWithTimeout(upstreamUrl, { headers, ms: 20000 });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        statusCode: 200,
        headers: corsHeaders(origin),
        body: JSON.stringify({
          note: `FALLBACK (upstream ${res.status})`,
          apiUrl: upstreamUrl,
          upstream: text.slice(0, 200),
          data: SAMPLE[dataset] || [],
        }),
      };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: JSON.stringify(data),
    };
  } catch (err) {
    // Return useful diagnostics
    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: JSON.stringify({
        note: "FALLBACK (error)",
        error: String(err),
        code: err?.cause?.code || null, // e.g., ENOTFOUND, ECONNRESET
        data: SAMPLE[event.queryStringParameters?.dataset] || [],
      }),
    };
  }
}
