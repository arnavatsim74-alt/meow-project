import { corsHeaders, json } from "../_shared/http.ts";

const IF_API_KEY = Deno.env.get("INFINITE_FLIGHT_API_KEY");

interface InfiniteFlightSession {
  id: string;
  name: string;
  type: number;
  maxUsers: number;
  currentUsers: number;
}

interface SessionsApiResponse {
  errorCode: number;
  result: InfiniteFlightSession[];
}

// The ATIS API actually returns the ATIS text directly in result, not nested
interface ATISApiResponse {
  errorCode: number;
  result: string | null; // ATIS text is returned directly as a string!
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!IF_API_KEY) {
      console.error("INFINITE_FLIGHT_API_KEY not configured");
      return json({ error: "API key not configured" }, { status: 500 });
    }

    const { icao } = await req.json();
    
    if (!icao) {
      return json({ error: "ICAO code is required" }, { status: 400 });
    }

    const normalizedIcao = icao.toUpperCase().trim();
    console.log(`Fetching ATIS for ${normalizedIcao}`);

    // Step 1: Get active sessions
    const sessionsUrl = `https://api.infiniteflight.com/public/v2/sessions?apikey=${IF_API_KEY}`;
    console.log("Fetching active sessions...");
    
    const sessionsResponse = await fetch(sessionsUrl, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });
    
    if (!sessionsResponse.ok) {
      console.error(`Sessions API error: ${sessionsResponse.status}`);
      return json({ 
        error: "Failed to fetch sessions from Infinite Flight API", 
        status: sessionsResponse.status 
      }, { status: sessionsResponse.status });
    }

    const sessionsData: SessionsApiResponse = await sessionsResponse.json();
    console.log(`Found ${sessionsData.result?.length || 0} active sessions`);

    // Check for API errors
    if (sessionsData.errorCode !== 0) {
      console.error(`Sessions API returned error code: ${sessionsData.errorCode}`);
      return json({ 
        error: `Infinite Flight API error: ${sessionsData.errorCode}`,
        atis: null 
      }, { status: 500 });
    }

    if (!sessionsData.result || sessionsData.result.length === 0) {
      return json({ 
        atis: null, 
        message: "No active Infinite Flight sessions available" 
      });
    }

    // Step 2: Try each active session to find ATIS for the airport
    const sessions = sessionsData.result;
    let atisText: string | null = null;
    let foundSession: InfiniteFlightSession | null = null;

    for (const session of sessions) {
      try {
        const atisUrl = `https://api.infiniteflight.com/public/v2/sessions/${session.id}/airport/${normalizedIcao}/atis?apikey=${IF_API_KEY}`;
        console.log(`Checking session "${session.name}" (ID: ${session.id})`);
        
        const atisResponse = await fetch(atisUrl, {
          headers: {
            'Accept': 'application/json',
          },
          cache: 'no-store'
        });
        
        if (!atisResponse.ok) {
          console.log(`Session ${session.name} returned status ${atisResponse.status}`);
          continue;
        }

        const data: ATISApiResponse = await atisResponse.json();
        console.log(`ATIS response for ${session.name}:`, JSON.stringify(data));
        
        // Check for successful response with valid ATIS text
        // The result is the ATIS string directly, not a nested object
        if (data.errorCode === 0 && data.result && typeof data.result === 'string' && data.result.trim().length > 0) {
          atisText = data.result.trim();
          foundSession = session;
          console.log(`✓ Found ATIS in session "${session.name}"`);
          break;
        }
      } catch (e) {
        console.log(`Error fetching ATIS from session ${session.name}:`, e.message);
        continue;
      }
    }

    // Step 3: Return results
    if (atisText && foundSession) {
      return json({
        atis: atisText, // Return the ATIS text directly
        session: {
          id: foundSession.id,
          name: foundSession.name,
          type: foundSession.type
        },
        airport: normalizedIcao
      });
    } else {
      return json({
        atis: null,
        message: `No ATIS available for ${normalizedIcao} in any active session`,
        sessions: sessions.map(s => ({ 
          name: s.name, 
          type: s.type 
        }))
      });
    }

  } catch (error) {
    console.error("Error in infinite-flight-atis function:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Unknown error occurred",
      atis: null
    }, { status: 500 });
  }
});
