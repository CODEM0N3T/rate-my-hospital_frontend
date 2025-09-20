// netlify/functions/cms-proxy.js
// Socrata-first, then CMS PDC datastore (filters[field]=value),
// then CMS Data API v1 (filter[field]=value). CORS on every path.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
};

const json = (obj, status = 200) => ({
  statusCode: status,
  headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  body: JSON.stringify(obj),
});

const text = (body, status = 200) => ({
  statusCode: status,
  headers: { "content-type": "text/plain; charset=utf-8", ...CORS },
  body,
});

// ---------- helpers ----------
async function fetchJSON(url, headers = {}) {
  const r = await fetch(url.toString(), { headers });
  const txt = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 400)}`);
  try {
    return JSON.parse(txt);
  } catch {
    return txt;
  }
}

// CSV parsing that handles quotes and a possible BOM on the first line
function parseCsvLine(line) {
  if (line && line.charCodeAt(0) === 0xfeff) line = line.slice(1); // strip BOM
  const out = [];
  let cell = "",
    q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        out.push(cell);
        cell = "";
      } else cell += c;
    }
  }
  out.push(cell);
  return out;
}

function normalizeRow(headers, row, map = {}) {
  const o = {};
  for (let i = 0; i < headers.length; i++) {
    const raw = headers[i] || "";
    const key = map[raw] || map[raw.trim()] || map[raw.toLowerCase()] || raw;
    o[key] = row[i] ?? "";
  }
  return o;
}

async function streamCsv(
  resp,
  {
    headerMap = {},
    size = 24,
    offset = 0,
    filterLine = null,
    filterRow = null,
  } = {}
) {
  if (!resp.ok || !resp.body) {
    const snippet = (await resp.text().catch(() => "")).slice(0, 240);
    throw new Error(`CSV fetch error ${resp.status}: ${snippet}`);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "",
    headers = null,
    out = [],
    seen = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });

    while (true) {
      const nl = buf.indexOf("\n");
      if (nl < 0) break;
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line) continue;

      if (!headers) {
        headers = parseCsvLine(line);
        continue;
      }
      if (filterLine && !filterLine(line)) continue;

      const row = parseCsvLine(line);
      const obj = normalizeRow(headers, row, headerMap);
      if (filterRow && !filterRow(obj)) continue;

      if (seen++ < offset) continue;
      out.push(obj);
      if (out.length >= size) {
        try {
          reader.cancel();
        } catch {}
        return out;
      }
    }
  }

  if (buf.trim() && headers) {
    if (!filterLine || filterLine(buf)) {
      const row = parseCsvLine(buf);
      const obj = normalizeRow(headers, row, headerMap);
      if (!filterRow || filterRow(obj)) {
        if (seen++ >= offset && out.length < size) out.push(obj);
      }
    }
  }
  return out;
}

// Resolve CSV download URL from CMS Provider Data Catalog (DKAN) metastore
async function resolveCsvUrl(datasetId) {
  const metaURL = `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/${encodeURIComponent(
    datasetId
  )}?show-reference-ids=false`;
  const meta = await fetchJSON(metaURL, { Accept: "application/json" });
  const dists = Array.isArray(meta?.distribution) ? meta.distribution : [];
  for (const d of dists) {
    const candidates = [
      d?.data?.downloadURL,
      d?.downloadURL,
      d?.data?.accessURL,
      d?.accessURL,
    ];
    for (const u of candidates)
      if (typeof u === "string" && u.toLowerCase().endsWith(".csv"))
        return { csvUrl: u };
  }
  return { csvUrl: null };
}

// Resolve Data API v1 "latest" endpoint from PDC metastore distributions
async function resolveApiUrl(datasetId) {
  const metaURL = `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/${encodeURIComponent(
    datasetId
  )}?show-reference-ids=false`;
  const meta = await fetchJSON(metaURL, { Accept: "application/json" });
  const dists = Array.isArray(meta?.distribution) ? meta.distribution : [];
  for (const d of dists) {
    const candidates = [d?.data?.accessURL, d?.accessURL].filter(Boolean);
    const isApi =
      (d?.format && String(d.format).toUpperCase() === "API") ||
      candidates.some((u) => /\/data-api\/v1\/dataset\//i.test(u));
    if (isApi && candidates.length) return { apiUrl: candidates[0] };
  }
  return { apiUrl: null };
}

// ---------- header maps ----------
const HOSP_HEADERS = {
  "Facility ID": "provider_id",
  "Facility Name": "hospital_name",
  Address: "address",
  City: "city",
  "City/Town": "city",
  State: "state",
  "ZIP Code": "zip_code",
  "Phone Number": "phone_number",
  "Telephone Number": "phone_number",
  "Hospital Type": "hospital_type",
  "Hospital Ownership": "hospital_ownership",
  "Emergency Services": "emergency_services",
  "Meets criteria for birthing friendly designation": "birthing_friendly",
  "Overall hospital rating": "hospital_overall_rating",
  "Overall Hospital Rating": "hospital_overall_rating",
};

const HCAHPS_HEADERS = {
  "Provider ID": "provider_id",
  "HCAHPS Measure ID": "hcahps_measure_id",
  "HCAHPS Question": "measure_name",
  "HCAHPS Answer Description": "answer_desc",
  "Patient Survey Star Rating": "hcahps_star_rating",
  "HCAHPS Linear Mean Value": "linear_mean_value",
  "HCAHPS Answer Percent": "answer_percent",
  "Number of Completed Surveys": "num_completed_surveys",
  "Survey Response Rate Percent": "survey_response_rate_percent",
};

// ---------- Socrata (primary) ----------
const SOC_HOST = "https://data.medicare.gov";

async function socrataHospitals(
  { q = "", state = "", size = 24, offset = 0 },
  token
) {
  const u = new URL(`${SOC_HOST}/resource/xubh-q36u.json`);
  u.searchParams.set(
    "$select",
    [
      "facility_id as provider_id",
      "facility_name as hospital_name",
      "address",
      "city",
      "state",
      "zip_code",
      "phone_number",
      "hospital_type",
      "hospital_ownership",
      "emergency_services",
      "meets_criteria_for_birthing_friendly_designation as birthing_friendly",
      "hospital_overall_rating",
    ].join(", ")
  );
  u.searchParams.set("$limit", String(size));
  u.searchParams.set("$offset", String(offset));
  if (q) u.searchParams.set("$q", q);
  if (state) u.searchParams.set("state", state);
  if (token) u.searchParams.set("$order", "hospital_name"); // nicer order when token present

  const headers = { Accept: "application/json" };
  if (token) headers["X-App-Token"] = token;
  return fetchJSON(u, headers);
}

async function socrataAnyHcahps(token, limit = 5) {
  const u = new URL(`${SOC_HOST}/resource/dgck-syfz.json`);
  u.searchParams.set("$select", "provider_id");
  u.searchParams.set("$where", "provider_id IS NOT NULL");
  u.searchParams.set("$group", "provider_id");
  u.searchParams.set("$limit", String(limit));
  const headers = { Accept: "application/json" };
  if (token) headers["X-App-Token"] = token;
  return fetchJSON(u, headers);
}

// Socrata HCAHPS: tolerant matching
async function socrataHcahps(
  providerId,
  { size = 50, offset = 0 } = {},
  token
) {
  const u = new URL(`${SOC_HOST}/resource/dgck-syfz.json`);
  const id = providerId.trim();
  const n = parseInt(id, 10);

  const clauses = [
    `upper(provider_id)=upper('${id}')`,
    `upper(facility_id)=upper('${id}')`,
    `upper(ccn)=upper('${id}')`,
    `starts_with(provider_id,'${id}')`,
    `starts_with(facility_id,'${id}')`,
    `starts_with(ccn,'${id}')`,
  ];
  if (!Number.isNaN(n)) clauses.push(`provider_id=${n}`);

  u.searchParams.set("$where", clauses.join(" OR "));
  u.searchParams.set("$order", "hcahps_measure_id");
  u.searchParams.set("$limit", String(size));
  u.searchParams.set("$offset", String(offset));
  u.searchParams.set(
    "$select",
    [
      "provider_id",
      "hcahps_measure_id",
      "measure_name",
      "hcahps_star_rating",
      "answer_desc",
      "answer_percent",
      "linear_mean_value",
      "num_completed_surveys",
      "survey_response_rate_percent",
    ].join(",")
  );

  const headers = { Accept: "application/json" };
  if (token) headers["X-App-Token"] = token;
  return fetchJSON(u, headers);
}

// ---------- PDC fallbacks ----------

// HCAHPS via PDC: datastore (filters[field]=value) then Data API v1 (filter[field]=value)
async function pdcHcahps(providerId, { size = 50, offset = 0 } = {}) {
  const tries = [];

  // 1) DKAN datastore
  const dsBase =
    "https://data.cms.gov/provider-data/api/1/datastore/query/dgck-syfz/0";
  for (const field of ["facility_id", "provider_id", "ccn"]) {
    const u = new URL(dsBase);
    u.searchParams.set("size", String(size));
    u.searchParams.set("offset", String(offset));
    u.searchParams.set(`filters[${field}]`, providerId);
    try {
      const data = await fetchJSON(u, { Accept: "application/json" });
      const arr = data?.result?.records ?? data?.records ?? data?.data ?? [];
      if (Array.isArray(arr) && arr.length) return arr;
      tries.push({ step: "datastore", field, ok: true, len: arr.length || 0 });
    } catch (e) {
      tries.push({ step: "datastore", field, err: String(e).slice(0, 140) });
    }
  }

  // 2) Data API v1 (latest)
  try {
    const { apiUrl } = await resolveApiUrl("dgck-syfz");
    if (apiUrl) {
      for (const field of ["facility_id", "provider_id", "ccn"]) {
        const u = new URL(apiUrl);
        u.searchParams.set("size", String(size));
        u.searchParams.set("offset", String(offset));
        u.searchParams.set(`filter[${field}]`, providerId);
        try {
          const data = await fetchJSON(u, { Accept: "application/json" });
          if (Array.isArray(data) && data.length) return data;
          const arr = Array.isArray(data?.data) ? data.data : [];
          if (arr.length) return arr;
          tries.push({
            step: "data-api",
            field,
            ok: true,
            len: (Array.isArray(data) ? data : arr).length || 0,
          });
        } catch (e) {
          tries.push({ step: "data-api", field, err: String(e).slice(0, 140) });
        }
      }
    } else {
      tries.push({ step: "data-api", err: "No API URL in distribution" });
    }
  } catch (e) {
    tries.push({ step: "data-api", err: String(e).slice(0, 140) });
  }

  return { note: "HCAHPS: no rows via PDC JSON", tries };
}

// ---------- Handler (Netlify v1) ----------
exports.handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }

    // Simple ping/debug
    if ((event.queryStringParameters || {}).ping) {
      return json({ ok: true, t: Date.now() });
    }

    const qs = event.queryStringParameters || {};
    const dataset = String(qs.dataset || "")
      .trim()
      .toLowerCase();
    const size = parseInt(qs.size || "24", 10);
    const offset = parseInt(qs.offset || "0", 10);
    if (!dataset) return json({ error: "Missing ?dataset=" }, 400);

    const APP_TOKEN =
      process.env.SOCRATA_APP_TOKEN ||
      process.env.VITE_SOCRATA_APP_TOKEN ||
      process.env.CMS_APP_TOKEN ||
      process.env.VITE_CMS_APP_TOKEN ||
      "";

    // -------- HCAHPS (dgck-syfz) --------
    if (dataset === "dgck-syfz") {
      const providerId = String(
        qs.provider_id || qs.facility_id || qs.ccn || ""
      ).trim();
      if (!providerId) {
        return json(
          {
            error:
              "HCAHPS requires one of ?provider_id= | ?facility_id= | ?ccn=",
          },
          400
        );
      }

      try {
        const rows = await socrataHcahps(
          providerId,
          { size, offset },
          APP_TOKEN
        );
        if (Array.isArray(rows)) return json(rows);
      } catch (e) {
        try {
          const out = await pdcHcahps(providerId, { size, offset });
          if (Array.isArray(out)) return json(out);
          return json({
            data: [],
            note: out?.note || "No rows from PDC fallback",
            tries: out?.tries || [],
            socrata_error: String(e).slice(0, 300),
          });
        } catch (e2) {
          return json(
            {
              data: [],
              note: "HCAHPS unavailable",
              socrata_error: String(e).slice(0, 300),
              err: String(e2).slice(0, 180),
            },
            502
          );
        }
      }
    }

    // -------- Hospitals (xubh-q36u) --------
    if (dataset === "xubh-q36u") {
      const q = String(qs.q || "").trim();
      const state = String(qs.state || "").trim();

      // 1) Socrata first
      try {
        const rows = await socrataHospitals(
          { q, state, size, offset },
          APP_TOKEN
        );
        if (Array.isArray(rows) && rows.length) return json(rows);
      } catch {
        /* fall through to CSV */
      }

      // 2) PDC CSV fallback
      const { csvUrl } = await resolveCsvUrl("xubh-q36u");
      if (!csvUrl)
        return json({ note: "Hospitals: could not resolve CSV URL" }, 502);

      const r = await fetch(csvUrl, { headers: { Accept: "text/csv" } });
      const rows = await streamCsv(r, {
        headerMap: HOSP_HEADERS,
        filterLine: (line) => {
          if (!q && !state) return true;
          const L = line.toLowerCase();
          const okQ = !q || L.includes(q.toLowerCase());
          const okS =
            !state || line.toUpperCase().includes(state.toUpperCase());
          return okQ && okS;
        },
        filterRow: (o) => {
          if (q) {
            const s = q.toLowerCase();
            const ok =
              String(o.hospital_name || "")
                .toLowerCase()
                .includes(s) ||
              String(o.city || "")
                .toLowerCase()
                .includes(s);
            if (!ok) return false;
          }
          if (
            state &&
            String(o.state || "").toUpperCase() !== state.toUpperCase()
          )
            return false;
          return true;
        },
        size,
        offset,
      });
      return json(rows);
    }

    return json({ error: `Unsupported dataset: ${dataset}` }, 400);
  } catch (err) {
    return json({ error: "Unhandled", detail: String(err).slice(0, 400) }, 500);
  }
};
