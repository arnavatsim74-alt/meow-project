 import { corsHeaders, json } from "../_shared/http.ts";
 import { createAdminClient } from "../_shared/supabase.ts";
 
 const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_PIREP_WEBHOOK_URL");
 
 interface PIREPData {
   id: string;
   flight_number: string;
   departure_airport: string;
   arrival_airport: string;
   aircraft_name: string;
   aircraft_type: string;
   tail_number: string | null;
   flight_time_hrs: number;
   flight_time_mins: number;
   passengers: number | null;
   cargo_weight_kg: number | null;
   landing_rate: number | null;
   fuel_used: number | null;
   xp_earned: number | null;
   money_earned: number | null;
   pilot_name: string;
   pilot_callsign: string;
   status: string;
 }
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     if (!DISCORD_WEBHOOK_URL) {
       console.error("DISCORD_PIREP_WEBHOOK_URL not configured");
       return json({ error: "Discord webhook not configured" }, { status: 500 });
     }
 
     const { pirep_id } = await req.json();
 
     if (!pirep_id) {
       return json({ error: "PIREP ID is required" }, { status: 400 });
     }
 
     console.log(`Sending PIREP ${pirep_id} to Discord`);
 
     const supabase = createAdminClient();
 
     // Fetch PIREP with related data
     const { data: pirep, error: pirepError } = await supabase
       .from("pireps")
       .select(`
         id,
         flight_number,
         departure_airport,
         arrival_airport,
         tail_number,
         flight_time_hrs,
         flight_time_mins,
         passengers,
         cargo_weight_kg,
         landing_rate,
         fuel_used,
         xp_earned,
         money_earned,
         status,
         aircraft:aircraft(name, type_code)
       `)
       .eq("id", pirep_id)
       .single();
 
     if (pirepError || !pirep) {
       console.error("Error fetching PIREP:", pirepError);
       return json({ error: "PIREP not found" }, { status: 404 });
     }
 
     // Fetch pilot profile
     const { data: profile } = await supabase
       .from("profiles")
       .select("name, callsign")
       .eq("user_id", (await supabase.from("pireps").select("user_id").eq("id", pirep_id).single()).data?.user_id)
       .single();
 
     // Format flight time
     const flightTimeFormatted = `${Math.floor(pirep.flight_time_hrs)}h ${pirep.flight_time_mins || 0}m`;
 
     // Get aircraft info
    const aircraftArr = pirep.aircraft as unknown as Array<{ name: string; type_code: string }> | null;
    const aircraft = Array.isArray(aircraftArr) && aircraftArr.length > 0 ? aircraftArr[0] : null;
 
     // Create Discord embed
     const embed = {
       title: `✈️ New PIREP Submitted`,
       color: 0xFFCC00, // Gold color for Aeroflot
       fields: [
         {
           name: "🛫 Flight Details",
           value: `**Flight:** ${pirep.flight_number}\n**Route:** ${pirep.departure_airport} → ${pirep.arrival_airport}\n**Aircraft:** ${aircraft?.name || 'Unknown'} (${aircraft?.type_code || 'N/A'})\n**Registration:** ${pirep.tail_number || 'N/A'}`,
           inline: false,
         },
         {
           name: "⏱️ Flight Time",
           value: flightTimeFormatted,
           inline: true,
         },
         {
           name: "👥 Passengers",
           value: pirep.passengers?.toString() || "N/A",
           inline: true,
         },
         {
           name: "📦 Cargo",
           value: pirep.cargo_weight_kg ? `${pirep.cargo_weight_kg.toLocaleString()} kg` : "N/A",
           inline: true,
         },
         {
           name: "🛬 Landing Rate",
           value: pirep.landing_rate ? `${pirep.landing_rate} fpm` : "N/A",
           inline: true,
         },
         {
           name: "⛽ Fuel Used",
           value: pirep.fuel_used ? `${pirep.fuel_used.toLocaleString()} kg` : "N/A",
           inline: true,
         },
         {
           name: "📊 Status",
           value: pirep.status.charAt(0).toUpperCase() + pirep.status.slice(1).replace('_', ' '),
           inline: true,
         },
       ],
       footer: {
         text: `Pilot: ${profile?.name || 'Unknown'} (${profile?.callsign || 'N/A'})`,
       },
       timestamp: new Date().toISOString(),
     };
 
     // Add earnings fields if approved and present
     if (pirep.xp_earned || pirep.money_earned) {
       embed.fields.push({
         name: "💰 Earnings",
         value: `**XP:** ${pirep.xp_earned?.toLocaleString() || 0}\n**Money:** ₽${pirep.money_earned?.toLocaleString() || 0}`,
         inline: false,
       });
     }
 
     // Send to Discord
     const discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         username: "AFLV BOT",
         avatar_url: "https://aflv-cargo.vercel.app/logo.png",
         embeds: [embed],
       }),
     });
 
     if (!discordResponse.ok) {
       const errorText = await discordResponse.text();
       console.error("Discord webhook error:", errorText);
       return json({ error: "Failed to send to Discord" }, { status: 500 });
     }
 
     console.log(`Successfully sent PIREP ${pirep_id} to Discord`);
     return json({ success: true });
 
   } catch (error) {
     console.error("Error in discord-pirep-webhook:", error);
     return json({ 
       error: error instanceof Error ? error.message : "Unknown error" 
     }, { status: 500 });
   }
 });
