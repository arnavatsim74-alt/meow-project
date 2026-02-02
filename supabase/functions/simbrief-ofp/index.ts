import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto as stdCrypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MD5 hash function for API code generation
async function md5(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await stdCrypto.subtle.digest('MD5', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('SIMBRIEF_API_KEY');

    if (!apiKey) {
      console.error('SIMBRIEF_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'SimBrief API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        // Body might be empty
      }
    }

    const action = body.action as string;

    // Generate API code for SimBrief popup authentication
    if (action === 'generate_api_code') {
      const orig = (body.orig as string || '').toUpperCase();
      const dest = (body.dest as string || '').toUpperCase();
      const type = body.type as string || '';
      const timestamp = body.timestamp as number;
      const outputpage = body.outputpage as string || '';

      if (!orig || !dest || !type || !timestamp || !outputpage) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters: orig, dest, type, timestamp, outputpage' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const apiReq = `${orig}${dest}${type}${timestamp}${outputpage}`;
      console.log('Generating API code for:', apiReq);
      
      const apiCode = await md5(apiKey + apiReq);
      console.log('Generated API code successfully');

      return new Response(
        JSON.stringify({ api_code: apiCode }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch OFP by ofp_id (returned from SimBrief popup callback)
    if (action === 'fetch_ofp') {
      const ofpId = body.ofp_id as string;

      if (!ofpId) {
        return new Response(
          JSON.stringify({ error: 'Missing ofp_id parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Fetching OFP data for:', ofpId);
      const xmlUrl = `https://www.simbrief.com/ofp/flightplans/xml/${ofpId}.xml`;

      try {
        const response = await fetch(xmlUrl, {
          headers: { 'User-Agent': 'AFLV-Operations/1.0' }
        });

        if (!response.ok) {
          console.error('OFP not found:', response.status);
          return new Response(
            JSON.stringify({ error: 'OFP not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const xmlData = await response.text();
        console.log('OFP XML fetched successfully, length:', xmlData.length);

        return new Response(
          JSON.stringify({
            ofp_id: ofpId,
            raw_xml: xmlData,
            xml_url: xmlUrl
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('Error fetching OFP:', e);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch OFP data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch latest OFP by SimBrief pilot ID/username (legacy support)
    if (action === 'fetch_by_pid') {
      const pid = body.pid as string;

      if (!pid) {
        return new Response(
          JSON.stringify({ error: 'Missing pid parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Fetching latest OFP for pilot:', pid);
      const jsonUrl = `https://www.simbrief.com/api/xml.fetcher.php?username=${pid}&json=1`;

      try {
        const response = await fetch(jsonUrl, {
          headers: { 'User-Agent': 'AFLV-Operations/1.0' }
        });

        if (!response.ok) {
          console.error('Failed to fetch by PID:', response.status);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch OFP by pilot ID' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const jsonData = await response.json();
        console.log('Fetched OFP by PID successfully');

        return new Response(
          JSON.stringify(jsonData),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('Error fetching by PID:', e);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch OFP data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: generate_api_code, fetch_ofp, or fetch_by_pid' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('SimBrief API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
