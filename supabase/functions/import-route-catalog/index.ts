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
    const expectedColCount = header.length; // e.g. 8

    // Support both old and new CSV formats
    const findIdx = (...names: string[]) => {
      for (const n of names) {
        const idx = header.indexOf(n.toLowerCase());
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const idxFlight = findIdx("routenumber", "flight number", "flight_number");
    const idxDepIcao = findIdx("depicao", "dep. icao", "dep_icao");
    const idxArrIcao = findIdx("arricao", "arr icao", "arr_icao");
    const idxAircraft = findIdx("aircraft");
    const idxDuration = findIdx("estflighttime", "duration");
    const idxRemarks = findIdx("notes", "remarks");
    const idxRouteType = findIdx("routetype", "route_type");
    const idxRank = findIdx("rank", "rank_required");

    if (idxFlight < 0 || idxDepIcao < 0 || idxArrIcao < 0) {
      return json({ error: "CSV headers not recognized. Need routeNumber/depICAO/arrICAO or Flight Number/Dep. ICAO/Arr ICAO" }, { status: 400 });
    }

    // Fix rows that have more columns than headers due to unquoted commas in aircraft field
    // e.g. "FJ139,NFNA,NFNK,B73M, B738,passenger,60,first_officer,notes"
    // becomes 9 cols instead of 8 — the extra cols belong to aircraft
    const fixedRows = rows.slice(1).map((r) => {
      const extra = r.length - expectedColCount;
      if (extra <= 0 || idxAircraft < 0) return r;

      // Merge extra columns back into the aircraft field
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
        code: null as string | null,
        dep_city: null as string | null,
        arr_city: null as string | null,
        dep_icao: pick(r, idxDepIcao).toUpperCase(),
        arr_icao: pick(r, idxArrIcao).toUpperCase(),
        aircraft: aircraftRaw || null,
        duration_raw: durationRaw || null,
        duration_mins: durationMins,
        remarks: idxRemarks >= 0 ? pick(r, idxRemarks) : null,
        lmt: null as string | null,
        route_type: idxRouteType >= 0 ? pick(r, idxRouteType).toLowerCase() || "passenger" : "passenger",
        rank_required: idxRank >= 0 ? pick(r, idxRank).toLowerCase() || "first_officer" : "first_officer",
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
