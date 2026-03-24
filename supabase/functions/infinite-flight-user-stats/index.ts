import { corsHeaders, json } from "../_shared/http.ts";

// TTL cache for user stats (5 min per API rules)
const cache = new Map<string, { data: unknown; time: number }>();
function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < ttlMs) return entry.data as T;
  return null;
}
function setCache(key: string, data: unknown) {
  cache.set(key, { data, time: Date.now() });
}

interface UserStatsRequest {
  userIds?: string[];
  userHashes?: string[];
  discordId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('INFINITE_FLIGHT_API_KEY');
    if (!apiKey) throw new Error('INFINITE_FLIGHT_API_KEY not configured');

    const body: UserStatsRequest = await req.json();

    const ifRequestBody: Record<string, unknown> = {};
    if (body.userIds?.length) ifRequestBody.userIds = body.userIds;
    if (body.userHashes?.length) ifRequestBody.userHashes = body.userHashes;
    if (body.discordId) ifRequestBody.discordId = body.discordId;

    if (!ifRequestBody.userIds && !ifRequestBody.userHashes && !ifRequestBody.discordId) {
      throw new Error('At least one identifier required');
    }

    // Check cache (5 min for user data)
    const cacheKey = `users_${JSON.stringify(ifRequestBody)}`;
    const cached = getCached<unknown[]>(cacheKey, 5 * 60 * 1000);
    if (cached) {
      return json({ success: true, users: cached });
    }

    const response = await fetch(
      `https://api.infiniteflight.com/public/v2/users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ifRequestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`IF API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.errorCode !== 0) {
      throw new Error(`IF API error code: ${data.errorCode}`);
    }

    const users = data.result || [];
    setCache(cacheKey, users);

    return json({ success: true, users });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return json({ success: false, error: errorMessage }, { status: 500 });
  }
});
