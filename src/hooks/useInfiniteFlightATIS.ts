import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ATISData {
  frequencyId: string;
  airportIcao: string;
  latitude: number;
  longitude: number;
  atis: string;
}

export interface ATISSession {
  id: string;
  name: string;
  type: number;
}

export interface ATISResponse {
  atis: string | null;
  session?: ATISSession;
  airport?: string;
  message?: string;
  sessions?: Array<{ name: string; type: number }>;
  error?: string;
}

export function useInfiniteFlightATIS(icao: string | null) {
  const [data, setData] = useState<ATISResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchATIS = useCallback(async () => {
    if (!icao) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: response, error: fnError } = await supabase.functions.invoke(
        'infinite-flight-atis',
        { body: { icao } }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      setData(response);
    } catch (err) {
      console.error('Error fetching ATIS:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ATIS');
    } finally {
      setLoading(false);
    }
  }, [icao]);

  useEffect(() => {
    fetchATIS();
  }, [fetchATIS]);

  return { data, loading, error, refetch: fetchATIS };
}
