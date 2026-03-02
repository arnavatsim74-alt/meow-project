// deno-lint-ignore-file no-explicit-any
import { json, corsHeaders } from "../_shared/http.ts";
import { createAdminClient, createAuthedClient } from "../_shared/supabase.ts";
import { normalizeHeader, parseCsv, parseDurationToMinutes, pick } from "../_shared/csv.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authed = createAuthedClient(req);
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) return json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const csvText = String(body?.csvText ?? "");
    if (!csvText.trim()) return json({ error: "Missing csvText" }, { status: 400 });

    const rows = parseCsv(csvText);
    if (rows.length < 2) return json({ error: "CSV is empty" }, { status: 400 });

    const header = rows[0].map(normalizeHeader);
    const expectedColCount = header.length;

    // Flexible header matching
    const findIdx = (...names: string[]) => {
      for (const n of names) {
        const norm = n.toLowerCase().trim();
        const idx = header.indexOf(norm);
        if (idx >= 0) return idx;
      }
      // Fallback: partial match
      for (const n of names) {
        const norm = n.toLowerCase().trim();
        const idx = header.findIndex((h) => h.includes(norm));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const idxFlight = findIdx("flight number", "routenumber", "flight_number", "route_number");
    const idxLivery = findIdx("code", "livery");
    const idxDepIcao = findIdx("dep. icao", "dep icao", "depicao", "dep_icao", "departure icao");
    const idxArrIcao = findIdx("arr icao", "arricao", "arr_icao", "arrival icao");
    const idxAircraft = findIdx("aircraft");
    const idxDuration = findIdx("duration", "estflighttime");
    const idxRemarks = findIdx("remarks", "notes");
    const idxRouteType = findIdx("routetype", "route_type");
    const idxLmt = findIdx("lmt");

    if (idxFlight < 0 || idxDepIcao < 0 || idxArrIcao < 0) {
      return json({ error: `CSV headers not recognized. Found: [${header.join(", ")}]. Need Flight Number / DEP. ICAO / ARR ICAO columns.` }, { status: 400 });
    }

    // Fix rows that have more columns than headers due to unquoted commas in aircraft field
    const fixedRows = rows.slice(1).map((r) => {
      const extra = r.length - expectedColCount;
      if (extra <= 0 || idxAircraft < 0) return r;

      const fixed = [...r];
      const aircraftParts = fixed.splice(idxAircraft, 1 + extra);
      const mergedAircraft = aircraftParts.join(",");
      fixed.splice(idxAircraft, 0, mergedAircraft);
      return fixed;
    });

    const payload = fixedRows.map((r) => {
      const durationRaw = idxDuration >= 0 ? pick(r, idxDuration) : "";
      let durationMins = parseDurationToMinutes(durationRaw);
      if (durationMins === null && durationRaw) {
        const num = Number(durationRaw);
        if (Number.isFinite(num) && num > 0) durationMins = num;
      }

      const aircraftRaw = idxAircraft >= 0 ? pick(r, idxAircraft) : "";

      return {
        flight_number: pick(r, idxFlight),
        livery: idxLivery >= 0 ? pick(r, idxLivery) || null : null,
        dep_icao: pick(r, idxDepIcao).toUpperCase(),
        arr_icao: pick(r, idxArrIcao).toUpperCase(),
        aircraft: aircraftRaw || null,
        duration_raw: durationRaw || null,
        duration_mins: durationMins,
        remarks: idxRemarks >= 0 ? pick(r, idxRemarks) : null,
        lmt: null as string | null,
        route_type: idxRouteType >= 0 ? pick(r, idxRouteType).toLowerCase() || "passenger" : "passenger",
      };
    }).filter((x) => x.flight_number && x.dep_icao && x.arr_icao);

    // Batch upserts
    let imported = 0;
    const batchSize = 500;
    for (let i = 0; i < payload.length; i += batchSize) {
      const batch = payload.slice(i, i + batchSize);
      const { error } = await admin.from("route_catalog").upsert(batch, {
        onConflict: "flight_number,dep_icao,arr_icao",
      });
      if (error) throw error;
      imported += batch.length;
    }

    return json({ imported });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
});
