// netlify/functions/cms-proxy.mjs
export const config = { path: "/.netlify/functions/cms-proxy" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const HOSPITALS = "xubh-q36u";
const HCAHPS   = "dgck-syfz";

// ---- Fallback samples (renderable by your cards) ----
const SAMPLE_HOSPITALS = [
  {
    provider_id: "100001",
    hospital_name: "Sample General Hospital",
    city: "Atlanta",
    state: "GA",
    phone_number: "4041234567",
    hospital_type: "Acute Care",
    hospital_ownership: "Nonprofit",
    hospital_overall_rating: "4",
  },
  {
    provider_id: "100002",
    hospital_name: "Metro Medical Center",
    city: "Chicago",
    state: "IL",
    phone_number: "3125551234",
    hospital_type: "Acute Care",
    hospital_ownership: "Government - Hospital District",
    hospital_overall_rating: "3",
  },
  {
    provider_id: "100003",
    hospital_name: "Bayview Health",
    city: "Tampa",
    state: "FL",
    phone_number: "8135559876",
    hospital_type: "Acute Care",
    hospital_ownership: "Proprietary",
    hospital_overall_rating: "5",
  },
];

const SAMPLE_HCAHPS = []; // keep empty for now

function buildSocrataUrl(dataset, qs) {
  const url = new URL(`https://data.cms.gov/resource/${dataset}.json`);
  // paging
  if (qs.get("size"))   url.searchParams.set("$limit", qs.get("size"));
  if (qs.get("offset")) url.searchParams.set("$offset", qs.get("offset"));
  // filters
  if (qs.get("q"))      url.searchParams.set("$q", qs.get("q"));
  if (qs.get("state"))  url.searchParams.set("state", qs.get("state"));
  if (dataset === HCAHPS && qs.get("provider_id")) {
    url.searchParams.set("provider_id", qs.get("provider_id"));
  }
  // optional: sorting
  // url.searchParams.set("$order", "hospital_name");
  return url.toString();
}

async function fetchUpstream(dataset, qs) {
  const target = buildSocrataUrl(dataset, qs);
  const headers = {};
  if (process.env.CMS_APP_TOKEN) {
    headers["X-App-Token"] = process.env.CMS_APP_TOKEN;
  }
  const res = await fetch(target, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0,300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

export default async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const url = new URL(req.url);
    const qs = url.searchParams;
    const dataset = qs.get("dataset");

    if (!dataset) {
      return new Response(JSON.stringify({ error: "Missing dataset param" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    try {
      const data = await fetchUpstream(dataset, qs);
      return new Response(JSON.stringify(data), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    } catch (err) {
      // Fallback samples per dataset
      const fallback = dataset === HOSPITALS ? SAMPLE_HOSPITALS
                     : dataset === HCAHPS   ? SAMPLE_HCAHPS
                     : [];
      return new Response(JSON.stringify({
        note: "Upstream fetch failed; returning fallback sample",
        error: String(err?.message || err),
        data: fallback,
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: "Function error", detail: String(err?.message || err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
};
