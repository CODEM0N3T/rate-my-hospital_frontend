const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
};

const BUILD_INFO = { version: "2025-09-17-1" };
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

const text = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...CORS },
  });

//helpers
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

//CSV parsing that handles quotes
function parseCsvLine(line) {
  if (line && line.charCodeAt(0) === 0xfeff) line = line.slice(1);
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

//Resolve CSV download URL from CMS Provider Data Catalog
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

// Find a Datastore resource UUID for a Provider Data Catalog dataset
async function resolveResourceId(datasetId) {
  const metaURL = `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/${encodeURIComponent(
    datasetId
  )}?show-reference-ids=false`;
  const meta = await fetchJSON(metaURL, { Accept: "application/json" });

  const dists = Array.isArray(meta?.distribution) ? meta.distribution : [];

  for (const d of dists) {
    const id = d?.data?.resource?.id || d?.resource?.id || null;
    if (id && /^[0-9a-f-]{36}$/i.test(String(id))) {
      return { resourceId: String(id) };
    }
  }
  return { resourceId: null };
}

async function resolveDataApiLatestFromDataJson(datasetSlug) {
  const url = "https://data.cms.gov/data.json";
  const data = await fetchJSON(url, { Accept: "application/json" });

  const list = Array.isArray(data?.dataset) ? data.dataset : [];

  const ds = list.find(
    (d) =>
      typeof d?.landingPage === "string" &&
      d.landingPage.includes(`/dataset/${datasetSlug}`)
  );
  if (!ds) return { apiUrl: null, reason: "dataset not found in data.json" };

  const dist = Array.isArray(ds.distribution) ? ds.distribution : [];

  const latest = dist.find(
    (d) =>
      String(d?.format).toUpperCase() === "API" &&
      String(d?.description).toLowerCase() === "latest" &&
      typeof d?.accessURL === "string"
  );
  if (!latest) return { apiUrl: null, reason: "no latest API distribution" };

  return { apiUrl: latest.accessURL };
}
function clampInt(v, min, max, dflt) {
  const n = parseInt(v || "", 10);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return dflt;
}

function selfPhotoURL(reqUrl, providerId, w = 640, h = 360) {
  const u = new URL(reqUrl);
  u.pathname = "/hospital-photo";
  u.search = "";
  u.searchParams.set("provider_id", providerId);
  u.searchParams.set("w", String(w));
  u.searchParams.set("h", String(h));
  return u.toString();
}

async function getHospitalById(providerId, token) {
  try {
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
      ].join(", ")
    );
    u.searchParams.set("facility_id", providerId);
    u.searchParams.set("$limit", "1");
    const headers = { Accept: "application/json" };
    if (token) headers["X-App-Token"] = token;
    const arr = await fetchJSON(u, headers);
    if (Array.isArray(arr) && arr[0]) return arr[0];
  } catch {} // fall through

  const { csvUrl } = await resolveCsvUrl("xubh-q36u");
  if (!csvUrl) return null;
  const r = await fetch(csvUrl, { headers: { Accept: "text/csv" } });
  const rows = await streamCsv(r, {
    headerMap: HOSP_HEADERS,
    size: 1,
    offset: 0,
    filterLine: (line) => line.includes(providerId),
    filterRow: (o) => String(o.provider_id || "").trim() === providerId,
  });
  return rows[0] || null;
}

function buildStreetViewURL(addr, w, h, key) {
  const u = new URL("https://maps.googleapis.com/maps/api/streetview");
  u.searchParams.set("size", `${w}x${h}`);
  u.searchParams.set("location", addr);
  u.searchParams.set("fov", "90");
  u.searchParams.set("source", "outdoor");
  u.searchParams.set("key", key);
  return u.toString();
}

function buildPlaceholderURL(name, city, state, w, h) {
  const label = [name || "Hospital", [city, state].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join("%0A");
  return `https://placehold.co/${w}x${h}?text=${encodeURIComponent(label)}`;
}

//header maps
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
  "Facility ID": "facility_id",
  "Facility Name": "facility_name",
  "HCAHPS Measure ID": "hcahps_measure_id",
  "HCAHPS Question": "measure_name",
  "HCAHPS Answer Description": "answer_desc",
  "Patient Survey Star Rating": "hcahps_star_rating",
  "HCAHPS Linear Mean Value": "linear_mean_value",
  "HCAHPS Answer Percent": "answer_percent",
  "Number of Completed Surveys": "num_completed_surveys",
  "Survey Response Rate Percent": "survey_response_rate_percent",
};

//Socrata
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
  if (token) u.searchParams.set("$order", "hospital_name");

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

// Socrata HCAHPS
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

  //
  u.searchParams.set(
    "$select",
    [
      "provider_id",
      "hcahps_measure_id",
      "hcahps_question",
      "hcahps_answer_description",
      "patient_survey_star_rating",
      "hcahps_linear_mean_value",
      "hcahps_answer_percent",
      "number_of_completed_surveys",
      "survey_response_rate_percent",
    ].join(",")
  );

  const headers = { Accept: "application/json" };
  if (token) headers["X-App-Token"] = token;
  return fetchJSON(u, headers);
}

async function pdcHcahps(providerId, { size = 50, offset = 0 } = {}) {
  const tries = [];
  try {
    const { csvUrl } = await resolveCsvUrl("dgck-syfz");
    if (!csvUrl) {
      tries.push({ step: "metastore", err: "No CSV distribution found" });
      return { note: "HCAHPS: no rows via PDC JSON", tries };
    }

    const targetRaw = String(providerId || "").trim();
    const targetNoZeros = targetRaw.replace(/^0+/, "");
    const targetPad6 = targetRaw.padStart(6, "0");
    const maybeMatch = (line) =>
      line.includes(targetRaw) ||
      line.includes(targetNoZeros) ||
      line.includes(targetPad6);

    const r = await fetch(csvUrl, { headers: { Accept: "text/csv" } });
    const rows = await streamCsv(r, {
      headerMap: HCAHPS_HEADERS,

      size,
      offset,

      filterLine: (line) => maybeMatch(line),

      filterRow: (o) => {
        const norm = (v) =>
          String(v || "")
            .trim()
            .replace(/^0+/, "")
            .toUpperCase();
        const T = norm(targetRaw);
        const ids = [o.provider_id, o.facility_id, o.ccn].map(norm);
        return ids.some((v) => v && v === T);
      },
    });
    return rows;
  } catch (e) {
    tries.push({ step: "pdc-csv", err: String(e).slice(0, 140) });
    return { note: "HCAHPS: no rows via PDC JSON", tries };
  }
}


export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url);
      if (req.method === "OPTIONS")
        return new Response(null, { status: 204, headers: CORS });

      if (url.pathname === "/") return text("rmh-proxy: ok");
      if (url.pathname === "/ping") return json({ ok: true, t: Date.now() });
      if (url.pathname === "/diag") {
        return json({
          ok: true,
          ...BUILD_INFO,
          has_socrata_token: !!env.SOCRATA_APP_TOKEN,
          has_gmaps_key: !!env.GMAPS_API_KEY,
        });
      }

      if (url.pathname === "/hospital-photo") {
        const providerId = (url.searchParams.get("provider_id") || "").trim();
        const w = clampInt(url.searchParams.get("w"), 64, 1280, 640);
        const h = clampInt(url.searchParams.get("h"), 64, 1280, 360);
        const forcePlaceholder = /^(1|true|yes)$/i.test(
          url.searchParams.get("placeholder") || ""
        );
        if (!providerId) return text("Missing ?provider_id=", 400);

        const rec = await getHospitalById(providerId, env.SOCRATA_APP_TOKEN);
        if (!rec) {
          return Response.redirect(
            `https://placehold.co/${w}x${h}?text=Hospital%20not%20found`,
            302
          );
        }

        const addr = `${rec.address}, ${rec.city}, ${rec.state} ${rec.zip_code}`;


        if (!env.GMAPS_API_KEY || forcePlaceholder) {
          const ph = buildPlaceholderURL(
            rec.hospital_name,
            rec.city,
            rec.state,
            w,
            h
          );
          return Response.redirect(ph, 302);
        }

        //Street View URL
        const gUrl = buildStreetViewURL(addr, w, h, env.GMAPS_API_KEY);

      
        const gRes = await fetch(gUrl, {
          cf: { cacheTtl: 86400, cacheEverything: true }, 
        });

        const ctype = gRes.headers.get("content-type") || "";
        
        if (gRes.ok && ctype.startsWith("image/")) {
          return new Response(gRes.body, {
            status: 200,
            headers: {
              "content-type": ctype,
              "cache-control": "public, max-age=86400",
              ...CORS,
            },
          });
        }

        
        const ph = buildPlaceholderURL(
          rec.hospital_name,
          rec.city,
          rec.state,
          w,
          h
        );
        return Response.redirect(ph, 302);
      }

      if (url.pathname === "/hcahps-sample") {
        try {
          const { csvUrl } = await resolveCsvUrl("dgck-syfz");
          if (!csvUrl)
            return json({
              provider_ids: [],
              sample: [],
              note: "No CSV distribution found",
            });
          const r = await fetch(csvUrl, { headers: { Accept: "text/csv" } });

          const rows = await streamCsv(r, {
            headerMap: HCAHPS_HEADERS,
            size: 5,
            offset: 0,
          });
          const provider_ids = [
            ...new Set(
              rows.map((o) =>
                String(o.provider_id || o.facility_id || o.ccn || "").trim()
              )
            ),
          ].filter(Boolean);
          return json({ provider_ids, sample: rows, source: "pdc-csv" });
        } catch (e) {
          return json(
            { error: "hcahps-sample failed", detail: String(e) },
            502
          );
        }
      }

      if (url.pathname !== "/cms-proxy") return text("Not Found", 404);

      const dataset = (url.searchParams.get("dataset") || "")
        .trim()
        .toLowerCase();
      const size = parseInt(url.searchParams.get("size") || "24", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);
      if (!dataset) return json({ error: "Missing ?dataset=" }, 400);


      if (dataset === "dgck-syfz") {
        const providerId = (
          url.searchParams.get("provider_id") ||
          url.searchParams.get("facility_id") ||
          url.searchParams.get("ccn") ||
          ""
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
            env.SOCRATA_APP_TOKEN
          );
          if (Array.isArray(rows)) return json(rows);
        } catch (e) {
          try {
            const out = await pdcHcahps(providerId, { size, offset });
            if (Array.isArray(out)) return json(out);
            return json({
              data: [],
              note: out?.note || "PDC fallback returned no rows",
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

    
      if (dataset === "xubh-q36u") {
        const q = (url.searchParams.get("q") || "").trim();
        const state = (url.searchParams.get("state") || "").trim();

        
        try {
          const rows = await socrataHospitals(
            { q, state, size, offset },
            env.SOCRATA_APP_TOKEN
          );

          if (Array.isArray(rows) && rows.length) {
            const withPhotos = rows.map((o) => ({
              ...o,
              photo_url: o.provider_id
                ? selfPhotoURL(req.url, String(o.provider_id))
                : null,
            }));
            return json(withPhotos);
          }
        } catch {
        
        }

        
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

        const withPhotos = rows.map((o) => ({
          ...o,
          photo_url: o.provider_id
            ? selfPhotoURL(req.url, String(o.provider_id))
            : null,
        }));
        return json(withPhotos);
      }

      return json({ error: `Unsupported dataset: ${dataset}` }, 400);
    } catch (err) {
      return json(
        { error: "Unhandled", detail: String(err).slice(0, 400) },
        500
      );
    }
  },
};
