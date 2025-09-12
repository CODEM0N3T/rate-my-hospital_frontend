// netlify/functions/cms-proxy.mjs
// Node 18 ESM function. Adds CORS and proxies to CMS. Falls back to samples on errors.

const DATASETS = {
  HOSPITALS: "xubh-q36u",
  HCAHPS: "dgck-syfz",
};

// ——— tiny sample fallback to prove end-to-end ———
const SAMPLE = {
  xubh-q36u: [
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
  dgck-syfz: [
    {
      provider_id: "123456",
      hcahps_measure_id: "H_COMP_1_A_P",
      measure_name: "Nurses always communicated well",
      hcahps_star_rating: "4",
    },
  ],
};
// ————————————————————————————————————————————————

function corsHeaders(origin) {
  // Allow both local dev and any Netlify preview/production
  const allowOrigin =
    origin ||
    "*"; // You can tighten this later to your exact domains if you prefer.
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
  };
}

export async function handler(event) {
  const origin = event.headers?.origin || "*";

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin) };
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

    // Map our friendly params to the CMS Data API v1 params
    const size = qs.size || "24";
    const offset = qs.offset || "0";

    // IMPORTANT: Use Data API v1 for CMS (not the old SODA endpoint)
    // Docs pattern: https://data.cms.gov/data-api/v1/dataset/{uuid}/data
    const api = new URL(
      `https://data.cms.gov/data-api/v1/dataset/${dataset}/data`
    );
    api.searchParams.set("size", size);
    api.searchParams.set("offset", offset);

    // Optional filters (we’ll keep this simple)
    if (qs.state) api.searchParams.set("state", qs.state);
    if (qs.q) api.searchParams.set("q", qs.q);

    // Try upstream
    const res = await fetch(api.toString(), {
      // If you have a valid CMS app token, you can add it here:
      // headers: { "X-App-Token": process.env.CMS_APP_TOKEN }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Fall back to samples so your UI still works
      return {
        statusCode: 200,
        headers: corsHeaders(origin),
        body: JSON.stringify({
          note: `FALLBACK (upstream ${res.status}): ${text.slice(0, 160)}`,
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
    // Network/DNS/etc. Fall back to samples
    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: JSON.stringify({
        note: `FALLBACK (error): ${String(err).slice(0, 160)}`,
        data: SAMPLE[event.queryStringParameters?.dataset] || [],
      }),
    };
  }
}
