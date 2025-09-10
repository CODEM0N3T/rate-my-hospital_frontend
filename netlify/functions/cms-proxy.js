// netlify/functions/cms-proxy.mjs
export const config = { path: "/.netlify/functions/cms-proxy" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const HOSPITALS_ALIAS = "xubh-q36u"; // Hospital General Info (Socrata alias)
const HCAHPS_ALIAS = "dgck-syfz"; // HCAHPS (Socrata alias)

// Helper: map query from UI to Socrata-ish or Provider API
function buildUpstreamUrl(dataset, qs) {
  // Try Provider Data API first (more modern). NOTE: some sites require UUID not alias.
  // If this 404s in your logs, flip to Socrata "resource" path below (and add your app token there).
  const params = new URLSearchParams();
  // map your UI params -> provider API params
  if (qs.get("size")) params.set("size", qs.get("size"));
  if (qs.get("offset")) params.set("offset", qs.get("offset"));
  if (qs.get("q")) params.set("q", qs.get("q"));
  if (qs.get("state")) params.set("state", qs.get("state"));
  if (dataset === HCAHPS_ALIAS && qs.get("provider_id")) {
    params.set("provider_id", qs.get("provider_id"));
  }

  // Provider Data API (CORS-friendly from server)
  // If this path fails for you, uncomment the Socrata fallback below instead.
  return `https://data.cms.gov/provider-data/api/1/datastore/sql?${params.toString()}`;

  // ---- Socrata fallback (legacy; often blocked client-side, ok from server) ----
  // const soc = new URL(`https://data.cms.gov/resource/${dataset}.json`);
  // if (qs.get("size"))   soc.searchParams.set("$limit",  qs.get("size"));
  // if (qs.get("offset")) soc.searchParams.set("$offset", qs.get("offset"));
  // if (qs.get("q"))      soc.searchParams.set("$q",      qs.get("q"));
  // if (qs.get("state"))  soc.searchParams.set("state",   qs.get("state"));
  // if (dataset === HCAHPS_ALIAS && qs.get("provider_id")) {
  //   soc.searchParams.set("provider_id", qs.get("provider_id"));
  // }
  // return soc.toString();
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const qs = url.searchParams;
    const dataset = qs.get("dataset");

    if (!dataset) {
      return new Response(JSON.stringify({ error: "Missing dataset param" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const upstream = buildUpstreamUrl(dataset, qs);

    // If you have a CMS App Token and use Socrata fallback, add headers here:
    // const headers = { "X-App-Token": process.env.CMS_APP_TOKEN || "" };

    const res = await fetch(upstream /*, { headers } */);
    const text = await res.text();

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: "Upstream fetch failed",
          status: res.status,
          body: text.slice(0, 500),
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Function error",
        detail: String(err?.message || err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
};
