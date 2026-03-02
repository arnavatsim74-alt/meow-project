// deno-lint-ignore-file no-explicit-any
import { json, corsHeaders } from "../_shared/http.ts";
import { createAdminClient, createAuthedClient } from "../_shared/supabase.ts";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
    const targetUserId = body?.userId;
    if (!targetUserId) return json({ error: "Missing userId" }, { status: 400 });

    const departureBase = (body?.departureBase as string) || null;
    const routingRule = (body?.routingRule as string) || "return_to_base";

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("callsign, base_airport, active_aircraft_family")
      .eq("user_id", targetUserId)
      .single();
    if (profileErr) throw profileErr;

    const base = (departureBase || profile?.base_airport || "UUEE").toUpperCase();

    const { data: fleetPool } = await admin
      .from("virtual_fleet")
      .select("id, tail_number, aircraft_id, aircraft:aircraft(id, family, type_code)")
      .eq("status", "idle")
      .limit(200);

    const { data: aircraftPool } = await admin
      .from("aircraft")
      .select("id, family, type_code")
      .limit(200) as { data: { id: string; family: string; type_code: string }[] | null; error: any };

    if (!aircraftPool || aircraftPool.length === 0) return json({ error: "No aircraft configured" }, { status: 400 });

    const preferredFamily = profile?.active_aircraft_family ?? null;
    type AircraftType = { id: string; family: string; type_code: string };

    let chosenFleetAircraft: any = null;
    let chosenAircraft: AircraftType | null = null;
    let tailNumber: string | null = null;

    if (fleetPool && fleetPool.length > 0) {
      const preferredFleet = preferredFamily
        ? fleetPool.find((f: any) => f.aircraft?.family === preferredFamily)
        : null;
      chosenFleetAircraft = preferredFleet ?? pickRandom(fleetPool);
      if (chosenFleetAircraft?.aircraft && !Array.isArray(chosenFleetAircraft.aircraft)) {
        chosenAircraft = chosenFleetAircraft.aircraft as AircraftType;
        tailNumber = chosenFleetAircraft.tail_number;
      }
    }
    if (!chosenAircraft) {
      const preferredAircraft = preferredFamily
        ? aircraftPool.find((a) => a.family === preferredFamily) ?? null
        : null;
      chosenAircraft = preferredAircraft ?? pickRandom(aircraftPool);
    }

    const { data: catalog, error: catalogErr } = await admin
      .from("route_catalog")
      .select("flight_number, dep_icao, arr_icao, aircraft, duration_mins, livery")
      .limit(5000);
    if (catalogErr) throw catalogErr;
    if (!catalog || catalog.length === 0) {
      return json({ error: "Route catalog is empty. Import routes first." }, { status: 400 });
    }

    const legsRequested = getRandomInt(2, 5);
    const selected: typeof catalog = [];
    let current = base;
    const used = new Set<string>();

    for (let i = 0; i < (routingRule === "return_to_base" ? legsRequested - 1 : legsRequested); i++) {
      const candidates = catalog.filter(
        (r) => r.dep_icao?.toUpperCase() === current && !used.has(r.flight_number)
      );
      if (candidates.length === 0) break;

      const route = pickRandom(candidates);
      selected.push(route);
      used.add(route.flight_number);
      current = (route.arr_icao ?? "").toUpperCase();
    }

    if (routingRule === "return_to_base" && current !== base && selected.length > 0) {
      const returnCandidates = catalog.filter(
        (r) => r.dep_icao?.toUpperCase() === current &&
               r.arr_icao?.toUpperCase() === base &&
               !used.has(r.flight_number)
      );
      if (returnCandidates.length > 0) {
        selected.push(pickRandom(returnCandidates));
      } else {
        selected.push({
          flight_number: `RTN${getRandomInt(1000, 9999)}`,
          dep_icao: current,
          arr_icao: base,
          aircraft: chosenAircraft?.type_code ?? "A320",
          duration_mins: 120,
          livery: null,
        });
      }
    }

    if (selected.length === 0) {
      return json({ error: `No routes found departing from ${base}. Check route catalog.` }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const { data: createdRequest, error: reqErr } = await admin
      .from("career_requests")
      .insert({
        user_id: targetUserId,
        status: "approved",
        requested_at: nowIso,
        reviewed_at: nowIso,
        reviewed_by: userData.user.id,
        notes: "auto-assigned by admin",
        departure_base: base,
        routing_rule: routingRule,
      })
      .select("id")
      .single();
    if (reqErr) throw reqErr;

    const avgKts = 450;
    const dispatchGroupId = crypto.randomUUID();

    const routesToInsert = selected.map((r) => {
      const mins = r.duration_mins ?? 60;
      const hrs = mins / 60;
      return {
        flight_number: r.flight_number,
        departure_airport: r.dep_icao,
        arrival_airport: r.arr_icao,
        estimated_time_hrs: hrs,
        distance_nm: Math.max(50, Math.round(hrs * avgKts)),
      };
    });

    const { data: insertedRoutes, error: routesErr } = await admin
      .from("routes")
      .insert(routesToInsert)
      .select("id");
    if (routesErr) throw routesErr;
    if (!insertedRoutes || insertedRoutes.length !== routesToInsert.length) {
      return json({ error: "Failed to create routes" }, { status: 500 });
    }

    const routeIds = insertedRoutes.map((x) => x.id);

    const legsToInsert = selected.map((r, idx) => ({
      user_id: targetUserId,
      route_id: routeIds[idx],
      aircraft_id: chosenAircraft!.id,
      leg_number: idx + 1,
      callsign: profile?.callsign ?? "---",
      status: "assigned",
      dispatch_group_id: dispatchGroupId,
      assigned_by: userData.user.id,
      assigned_at: nowIso,
      tail_number: tailNumber,
      livery: r.livery ?? null,
    }));

    const { error: legsErr } = await admin.from("dispatch_legs").insert(legsToInsert);
    if (legsErr) throw legsErr;

    if (chosenFleetAircraft) {
      await admin
        .from("virtual_fleet")
        .update({
          status: "in_flight",
          assigned_to: targetUserId,
          current_location: selected[0]?.dep_icao ?? base,
        })
        .eq("id", chosenFleetAircraft.id);
    }

    return json({ requestId: createdRequest.id, legs: legsToInsert.length, tailNumber });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
});
