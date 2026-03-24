import { corsHeaders, json } from "../_shared/http.ts";

const IF_API_KEY = Deno.env.get("INFINITE_FLIGHT_API_KEY");

// TTL-based in-memory cache per API compliance (sessions: 10min, ATIS: 15sec)
const cache = new Map<string, { data: unknown; time: number }>();
function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < ttlMs) return entry.data as T;
  return null;
}
function setCache(key: string, data: unknown) {
  cache.set(key, { data, time: Date.now() });
}

interface SessionInfo {
  id: string;
  name: string;
  type: number;
  worldType: number;
  maxUsers: number;
  userCount: number;
}

interface SessionsApiResponse {
  errorCode: number;
  result: SessionInfo[];
}

interface ATISApiResponse {
  errorCode: number;
  result: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!IF_API_KEY) {
      return json({ error: "API key not configured" }, { status: 500 });
    }

    const { icao } = await req.json();
    if (!icao) {
      return json({ error: "ICAO code is required" }, { status: 400 });
    }

    const normalizedIcao = icao.toUpperCase().trim();

    // Step 1: Get sessions (cached 10 min per API rules)
    let sessions = getCached<SessionInfo[]>("sessions", 10 * 60 * 1000);
    if (!sessions) {
      const sessionsResponse = await fetch(
        `https://api.infiniteflight.com/public/v2/sessions`,
        { headers: { 'Authorization': `Bearer ${IF_API_KEY}`, 'Accept': 'application/json' } }
      );
      if (!sessionsResponse.ok) {
        return json({ error: "Failed to fetch sessions", status: sessionsResponse.status }, { status: sessionsResponse.status });
      }
      const sessionsData: SessionsApiResponse = await sessionsResponse.json();
      if (sessionsData.errorCode !== 0 || !sessionsData.result) {
        return json({ atis: null, message: "No active sessions" });
      }
      sessions = sessionsData.result;
      setCache("sessions", sessions);
    }

    // Step 2: Check ATIS cache (15 sec per API rules)
    const atisCacheKey = `atis_${normalizedIcao}`;
    const cachedAtis = getCached<{ atis: string | null; session: any; airport: string }>(atisCacheKey, 15 * 1000);
    if (cachedAtis) {
      return json(cachedAtis);
    }

    // Step 3: Sort sessions - Expert (worldType 3) first, then Training (2), then Casual (1)
    const sorted = [...sessions].sort((a, b) => (b.worldType ?? 0) - (a.worldType ?? 0));

    let atisText: string | null = null;
    let foundSession: SessionInfo | null = null;

    for (const session of sorted) {
      try {
        const atisResponse = await fetch(
          `https://api.infiniteflight.com/public/v2/sessions/${session.id}/airport/${normalizedIcao}/atis`,
          { headers: { 'Authorization': `Bearer ${IF_API_KEY}`, 'Accept': 'application/json' } }
        );
        if (!atisResponse.ok) continue;

        const data: ATISApiResponse = await atisResponse.json();
        // errorCode 7 = NoAtisAvailable
        if (data.errorCode === 0 && data.result && typeof data.result === 'string' && data.result.trim().length > 0) {
          atisText = data.result.trim();
          foundSession = session;
          break;
        }
      } catch {
        continue;
      }
    }

    const result = atisText && foundSession
      ? { atis: atisText, session: { id: foundSession.id, name: foundSession.name, type: foundSession.type }, airport: normalizedIcao }
      : { atis: null, message: `No ATIS available for ${normalizedIcao} in any active session`, sessions: sorted.map(s => ({ name: s.name, type: s.type })) };

    setCache(atisCacheKey, result);
    return json(result);

  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error", atis: null }, { status: 500 });
  }
});
