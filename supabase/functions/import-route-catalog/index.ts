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

    // Support both old and new CSV formats
    // Old: "Flight Number", "Dep. ICAO", "Arr ICAO", "Aircraft", "Duration", "Remarks", etc.
    // New: "routeNumber", "depICAO", "arrICAO", "aircraft", "routeType", "estFlightTime", "rank", "notes"
    const findIdx = (...names: string[]) => {
      for (const n of names) {
        const idx = header.indexOf(n.toLowerCase());
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const idxFlight = findIdx("routenumber", "flight number", "flight_number");
    const idxCode = findIdx("code");
    const idxDepCity = findIdx("departure city", "dep_city");
    const idxArrCity = findIdx("arrival city", "arr_city");
    const idxDepIcao = findIdx("depicao", "dep. icao", "dep_icao");
    const idxArrIcao = findIdx("arricao", "arr icao", "arr_icao");
    const idxAircraft = findIdx("aircraft");
    const idxDuration = findIdx("estflighttime", "duration");
    const idxRemarks = findIdx("notes", "remarks");
    const idxLmt = findIdx("lmt");
    const idxRouteType = findIdx("routetype", "route_type");
    const idxRank = findIdx("rank", "rank_required");

    if (idxFlight < 0 || idxDepIcao < 0 || idxArrIcao < 0) {
      return json({ error: "CSV headers not recognized. Need routeNumber/depICAO/arrICAO or Flight Number/Dep. ICAO/Arr ICAO" }, { status: 400 });
    }

    const payload = rows.slice(1).map((r) => {
      // Duration: could be "HH:MM" or just minutes as a number
      const durationRaw = idxDuration >= 0 ? pick(r, idxDuration) : "";
      let durationMins = parseDurationToMinutes(durationRaw);
      // If not HH:MM format, try as plain minutes number
      if (durationMins === null && durationRaw) {
        const num = Number(durationRaw);
        if (Number.isFinite(num) && num > 0) durationMins = num;
      }

      const lmtRaw = idxLmt >= 0 ? pick(r, idxLmt) : "";
      const lmt = lmtRaw ? new Date(lmtRaw).toISOString() : null;

      // Aircraft field: could be "A320", "Aeroflot - A320", or "Aeroflot - A320, Air India - B77W"
      const aircraftRaw = idxAircraft >= 0 ? pick(r, idxAircraft) : "";

      return {
        flight_number: pick(r, idxFlight),
        code: idxCode >= 0 ? pick(r, idxCode) : null,
        dep_city: idxDepCity >= 0 ? pick(r, idxDepCity) : null,
        arr_city: idxArrCity >= 0 ? pick(r, idxArrCity) : null,
        dep_icao: pick(r, idxDepIcao).toUpperCase(),
        arr_icao: pick(r, idxArrIcao).toUpperCase(),
        aircraft: aircraftRaw || null,
        duration_raw: durationRaw || null,
        duration_mins: durationMins,
        remarks: idxRemarks >= 0 ? pick(r, idxRemarks) : null,
        lmt: lmt && lmt !== "Invalid Date" ? lmt : null,
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
