// netlify/functions/cms-proxy.js
const UPSTREAM_BASE = "https://data.medicare.gov/resource";

/** CORS headers */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Cache-Control": "public, max-age=60",
};

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    // dataset required: ?dataset=xubh-q36u ...
    const raw = event.rawQuery || "";
    const qs = new URLSearchParams(raw);
    const dataset = qs.get("dataset");
    if (!dataset) {
      return { statusCode: 400, headers: CORS, body: "Missing dataset" };
    }
    qs.delete("dataset");

    // Build target URL to Socrata (keeps $… params intact)
    const target = `${UPSTREAM_BASE}/${encodeURIComponent(dataset)}.json${
      qs.toString() ? `?${qs.toString()}` : ""
    }`;

    // Headers: add token if set in Netlify env (UI: Site settings → Environment)
    const headers = { Accept: "application/json" };
    if (process.env.CMS_APP_TOKEN) {
      headers["X-App-Token"] = process.env.CMS_APP_TOKEN;
    }

    const res = await fetch(target, { headers });
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: CORS,
      body: String(err?.message || err),
    };
  }
};
