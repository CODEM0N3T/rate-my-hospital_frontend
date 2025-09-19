// rmh-proxy/src/index.js

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
};

const j = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

const t = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...CORS },
  });

//CSV helpers
const HOSPITAL_HEADER_MAP = {
  "Facility ID": "provider_id",
  "Facility Name": "hospital_name",
  "City/Town": "city",
  City: "city",
  State: "state",
  "ZIP Code": "zip_code",
  Address: "address",
  "Phone Number": "phone_number",
  "Hospital Type": "hospital_type",
  "Hospital Ownership": "hospital_ownership",
  "Overall hospital rating": "hospital_overall_rating",
  "Overall Hospital Rating": "hospital_overall_rating",
};
const HCAHPS_HEADER_MAP = {
  "Provider ID": "provider_id",
  "HCAHPS Measure ID": "hcahps_measure_id",
  "HCAHPS Question": "measure_name",
  "HCAHPS Answer Description": "answer_desc",
  "Patient Survey Star Rating": "hcahps_star_rating",
  "HCAHPS Linear Mean Value": "linear_mean_value",
  "HCAHPS Answer Percent": "answer_percent",
  "Number of Completed Surveys": "num_completed_surveys",
  "Survey Response Rate Percent": "survey_response_rate_percent",
  Footnote: "footnote",
};

function parseCsvLine(line) {
  const out = [];
  let s = "",
    q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          s += '"';
          i++;
        } else {
          q = false;
        }
      } else s += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        out.push(s);
        s = "";
      } else s += c;
    }
  }
  out.push(s);
  return out;
}
function normalizeRow(headers, row, map) {
  const o = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] || "";
    const key = map[h] || map[h.trim()] || h;
    o[key] = row[i] ?? "";
  }
  return o;
}

async function streamCsvSelect(
  resp,
  { headerMap, filterLine = null, filterRow = null, size = 24, offset = 0 }
) {
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let headers = null;
  let results = [];
  let seen = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });

    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
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
      results.push(obj);
      if (results.length >= size) {
        try {
          reader.cancel();
        } catch {}
        return results;
      }
    }
  }

  if (buf.trim() && headers) {
    if (!filterLine || filterLine(buf)) {
      const row = parseCsvLine(buf);
      const obj = normalizeRow(headers, row, headerMap);
      if (!filterRow || filterRow(obj)) {
        if (seen++ >= offset && results.length < size) results.push(obj);
      }
    }
  }
  return results;
}

//PDC helpers
async function resolvePdcCsvUrl(datasetId) {
  const metaURL = `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/${encodeURIComponent(
    datasetId
  )}?show-reference-ids=false`;
  const r = await fetch(metaURL, { headers: { Accept: "application/json" } });
  if (!r.ok)
    return { csvUrl: null, metaURL, status: r.status, note: "metastore error" };
  const meta = await r.json().catch(() => ({}));
  const dists = Array.isArray(meta?.distribution) ? meta.distribution : [];
  for (const d of dists) {
    const candidates = [
      d?.data?.downloadURL,
      d?.data?.accessURL,
      d?.downloadURL,
      d?.accessURL,
    ];
    for (const u of candidates) {
      if (typeof u === "string" && u.toLowerCase().endsWith(".csv")) {
        return { csvUrl: u, metaURL, status: r.status, note: "ok" };
      }
    }
  }
  return { csvUrl: null, metaURL, status: r.status, note: "no csv url" };
}

//Socrata
const SOC_HOST = "https://data.medicare.gov";
function numberLike(id) {
  const n = String(parseInt(String(id || ""), 10));
  return Number.isNaN(+n) ? null : n;
}
function normalizeHcahpsRow(row) {
  return {
    provider_id: row.provider_id ?? row.facility_id ?? row.ccn ?? "",
    hcahps_measure_id: row.hcahps_measure_id ?? "",
    measure_name:
      row.measure_name ?? row.hcahps_question ?? row.hcahps_measure_id ?? "",
    hcahps_star_rating:
      row.hcahps_star_rating ?? row.patient_survey_star_rating ?? "",
    linear_mean_value:
      row.linear_mean_value ?? row.hcahps_linear_mean_value ?? "",
    answer_percent:
      row.hcahps_answer_percent ?? row.top_box ?? row.answer_percent ?? "",
    num_completed_surveys:
      row.number_of_completed_surveys ?? row.num_completed_surveys ?? "",
    survey_response_rate_percent: row.survey_response_rate_percent ?? "",
  };
}
async function socrataHcahps(providerId, size, offset, token) {
  const n = numberLike(providerId);
  const url = new URL(`${SOC_HOST}/resource/dgck-syfz.json`);
  const clauses = [
    `provider_id='${providerId}'`,
    `facility_id='${providerId}'`,
    `ccn='${providerId}'`,
  ];
  if (n) clauses.push(`provider_id=${n}`);
  url.searchParams.set("$where", clauses.join(" OR "));
  url.searchParams.set("$order", "hcahps_measure_id");
  url.searchParams.set("$limit", String(size || 50));
  url.searchParams.set("$offset", String(offset || 0));

  const headers = { Accept: "application/json" };
  if (token) headers["X-App-Token"] = token;

  const r = await fetch(url.toString(), { headers });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Socrata ${r.status}: ${txt.slice(0, 200)}`);
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    data = [];
  }
  if (!Array.isArray(data)) data = [];
  return data.map(normalizeHcahpsRow);
}

//Router
export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url);
      if (req.method === "OPTIONS")
        return new Response(null, { status: 204, headers: CORS });

      if (url.pathname === "/") return t("rmh-proxy: ok");
      if (url.pathname === "/ping") return j({ ok: true, t: Date.now() });
      if (url.pathname !== "/cms-proxy") return t("Not Found", 404);

      const ds = (url.searchParams.get("dataset") || "").trim();
      const size = parseInt(url.searchParams.get("size") || "24", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);

      if (!ds) return j({ error: "Missing ?dataset=" }, 400);

      // HCAHPS
      if (ds.toLowerCase() === "dgck-syfz") {
        const provider_id = (url.searchParams.get("provider_id") || "").trim();
        if (!provider_id)
          return j({ error: "HCAHPS requires ?provider_id=" }, 400);

        try {
          const rows = await socrataHcahps(
            provider_id,
            size || 50,
            offset || 0,
            env.SOCRATA_APP_TOKEN
          );
          return j(rows);
        } catch (e) {
          const { csvUrl, metaURL, status, note } = await resolvePdcCsvUrl(ds);
          if (!csvUrl) {
            return j(
              {
                note: "FALLBACK (HCAHPS): could not resolve CSV",
                metaURL,
                status,
                note,
                error: String(e).slice(0, 200),
              },
              502
            );
          }
          const r = await fetch(csvUrl, { headers: { Accept: "text/csv" } });
          if (!r.ok || !r.body) {
            const snippet = (await r.text().catch(() => "")).slice(0, 240);
            return j(
              {
                note: "FALLBACK (HCAHPS): csv fetch error",
                status: r.status,
                snippet,
                csvUrl,
              },
              502
            );
          }
          const rows = await streamCsvSelect(r, {
            headerMap: HCAHPS_HEADER_MAP,
            filterLine: (line) => line.includes(provider_id),
            filterRow: (o) => String(o.provider_id) === String(provider_id),
            size: size || 50,
            offset: offset || 0,
          });
          return j(rows.map(normalizeHcahpsRow));
        }
      }

      // Hospitals (xubh-q36u)
      if (ds.toLowerCase() === "xubh-q36u") {
        const q = (url.searchParams.get("q") || "").trim();
        const state = (url.searchParams.get("state") || "").trim();

        const { csvUrl, metaURL, status, note } = await resolvePdcCsvUrl(ds);
        if (!csvUrl) {
          return j(
            { note: "Hospitals: could not resolve CSV", metaURL, status, note },
            502
          );
        }
        const r = await fetch(csvUrl, { headers: { Accept: "text/csv" } });
        if (!r.ok || !r.body) {
          const snippet = (await r.text().catch(() => "")).slice(0, 240);
          return j(
            {
              note: "Hospitals csv fetch error",
              status: r.status,
              snippet,
              csvUrl,
            },
            502
          );
        }
        const rows = await streamCsvSelect(r, {
          headerMap: HOSPITAL_HEADER_MAP,
          filterLine: (line) => {
            if (!q && !state) return true;
            const L = line.toLowerCase();
            return (
              (!q || L.includes(q.toLowerCase())) &&
              (!state || line.toUpperCase().includes(state.toUpperCase()))
            );
          },
          filterRow: (o) => {
            if (q) {
              const s = q.toLowerCase();
              if (
                !String(o.hospital_name || "")
                  .toLowerCase()
                  .includes(s) &&
                !String(o.city || "")
                  .toLowerCase()
                  .includes(s)
              )
                return false;
            }
            if (state) {
              if (String(o.state || "").toUpperCase() !== state.toUpperCase())
                return false;
            }
            return true;
          },
          size,
          offset,
        });
        return j(rows);
      }

      return j({ error: `Unsupported dataset: ${ds}` }, 400);
    } catch (err) {
      return j({ error: "Unhandled", detail: String(err).slice(0, 200) }, 500);
    }
  },
};
