// netlify/functions/cms-proxy.mjs

// const DATASETS = {
//   HOSPITALS: "xubh-q36u",
//   HCAHPS: "dgck-syfz",
// };

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
  const allowOrigin = origin || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
    Vary: "Origin",
  };
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

    const size = qs.size || "24";
    const offset = qs.offset || "0";

    const api = new URL(
      `https://data.cms.gov/data-api/v1/dataset/${dataset}/data`
    );
    api.searchParams.set("size", size);
    api.searchParams.set("offset", offset);
    if (qs.state) api.searchParams.set("state", qs.state);
    if (qs.q) api.searchParams.set("q", qs.q);

    // Node 18 has global fetch
    const res = await fetch(api.toString());

    if (!res.ok) {
      const text = await res.text().catch(() => "");
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
