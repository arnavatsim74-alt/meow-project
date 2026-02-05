import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IFAirportData {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  state: string | null;
  country: string | { id: number; name: string; isoCode: string } | null;
  latitude: number;
  longitude: number;
  elevation: number;
  magneticVariation: number;
  class: number;
  timezone: string | null;
  has3dBuildings?: boolean;
  hasJetbridges?: boolean;
  hasSafedockUnits?: boolean;
  hasTaxiwayRouting?: boolean;
  runways: Array<{
    name: string;
    bearing: number;
    length: number;
    width: number;
    surface: number;
    ils: boolean;
    threshold: {
      latitude: number;
      longitude: number;
      elevation: number;
    };
  }>;
  frequencies: Array<{
    type: number;
    typeName: string;
    description: string;
    frequency: number;
  }>;
}

// Helper function to extract country name from country field
export function getCountryName(country: IFAirportData['country']): string | null {
  if (!country) return null;
  if (typeof country === 'string') return country;
  if (typeof country === 'object' && 'name' in country) return country.name;
  return null;
}

interface UseIFAirportReturn {
  airportData: IFAirportData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useInfiniteFlightAirport(icao: string | null): UseIFAirportReturn {
  const [airportData, setAirportData] = useState<IFAirportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!icao) {
      setAirportData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('infinite-flight-airport', {
        body: { icao },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch airport data');
      }

      setAirportData(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch airport data';
      setError(message);
      console.error('IF Airport fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [icao]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { airportData, loading, error, refetch: fetchData };
}
