import { corsHeaders, json } from "../_shared/http.ts";

// Cache airport info for 60+ min per API rules (reference data)
const cache = new Map<string, { data: unknown; time: number }>();
function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < ttlMs) return entry.data as T;
  return null;
}
function setCache(key: string, data: unknown) {
  cache.set(key, { data, time: Date.now() });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { icao } = await req.json();
    const apiKey = Deno.env.get('INFINITE_FLIGHT_API_KEY');

    if (!apiKey) {
      return json({ success: false, error: 'API key not configured' }, { status: 500 });
    }
    if (!icao) {
      return json({ success: false, error: 'ICAO code is required' }, { status: 400 });
    }

    const formattedIcao = icao.toUpperCase().trim();

    // Check cache (60 min for airport reference data)
    const cacheKey = `airport_${formattedIcao}`;
    const cached = getCached<unknown>(cacheKey, 60 * 60 * 1000);
    if (cached) {
      return json({ success: true, data: cached });
    }

    const response = await fetch(
      `https://api.infiniteflight.com/public/v2/airport/${formattedIcao}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return json({ success: false, error: `API request failed: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    if (data.result) {
      setCache(cacheKey, data.result);
    }

    return json({ success: true, data: data.result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch airport info';
    return json({ success: false, error: errorMessage }, { status: 500 });
  }
});
