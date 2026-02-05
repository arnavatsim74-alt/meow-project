import { MapPin, Plane, Radio, Navigation, Building2, AlertTriangle } from 'lucide-react';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useInfiniteFlightAirport, getCountryName } from '@/hooks/useInfiniteFlightAirport';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface IFAirportCardProps {
  icao: string;
  label: 'Departure' | 'Arrival' | 'Alternate';
}

const classNames: Record<number, string> = {
  0: 'Unknown',
  1: 'Alpha',
  2: 'Bravo',
  3: 'Charlie',
  4: 'Delta',
  5: 'Echo',
};

const surfaceTypes: Record<number, string> = {
  0: 'Concrete',
  1: 'Asphalt',
  2: 'Grass',
  3: 'Dirt',
  4: 'Gravel',
  5: 'Water',
  6: 'Snow',
  7: 'Ice',
};

const frequencyTypes: Record<number, string> = {
  0: 'GND',
  1: 'TWR',
  2: 'APP',
  3: 'DEP',
  4: 'CTR',
  5: 'ATIS',
  6: 'MULTI',
  7: 'UNI',
  8: 'CLR',
};

export function IFAirportCard({ icao, label }: IFAirportCardProps) {
  const { airportData, loading, error } = useInfiniteFlightAirport(icao);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-warning rounded-full" />
          <h3 className="text-lg font-semibold text-foreground">{label} Airport</h3>
        </div>
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (error || !airportData) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-warning rounded-full" />
          <h3 className="text-lg font-semibold text-foreground">{label} Airport - {icao}</h3>
        </div>
        <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
          <AlertTriangle className="h-5 w-5 mb-2" />
          <span className="text-sm">Airport data unavailable</span>
          <span className="text-xs mt-1">{error || `Could not fetch data for ${icao}`}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 bg-warning rounded-full" />
        <h3 className="text-lg font-semibold text-foreground">{label} Airport</h3>
      </div>

      <div className="space-y-4">
        {/* Airport Name */}
        <div>
          <h4 className="text-xl font-bold text-foreground uppercase">{airportData.name}</h4>
          <p className="text-sm text-muted-foreground">
            {airportData.city && `${airportData.city}, `}
            {airportData.state && `${airportData.state}, `}
            {getCountryName(airportData.country)}
          </p>
        </div>

        {/* Basic Info Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Building2 className="h-3 w-3" /> ICAO / IATA
            </p>
            <p className="font-semibold text-foreground">
              {airportData.icao} {airportData.iata && `/ ${airportData.iata}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3" /> Elevation
            </p>
            <p className="font-semibold text-foreground">{Math.round(airportData.elevation)} ft</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Navigation className="h-3 w-3" /> Mag Var
            </p>
            <p className="font-semibold text-foreground">
              {airportData.magneticVariation > 0 ? 'E' : 'W'}{Math.abs(airportData.magneticVariation).toFixed(1)}°
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3" /> Coordinates
            </p>
            <p className="font-semibold text-foreground text-xs">
              {airportData.latitude.toFixed(4)}°, {airportData.longitude.toFixed(4)}°
            </p>
          </div>
        </div>

        {/* Airport Class & Timezone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Building2 className="h-3 w-3" /> Class
            </p>
            <p className="font-semibold text-foreground">
              {classNames[airportData.class] || `Class ${airportData.class}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Clock className="h-3 w-3" /> Timezone
            </p>
            <p className="font-semibold text-foreground text-xs">
              {airportData.timezone || 'Unknown'}
            </p>
          </div>
        </div>

        {/* Airport Features */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Airport Features</p>
          <div className="flex flex-wrap gap-2">
            <FeatureBadge label="3D Buildings" enabled={airportData.has3dBuildings} />
            <FeatureBadge label="Jetbridges" enabled={airportData.hasJetbridges} />
            <FeatureBadge label="Safedock" enabled={airportData.hasSafedockUnits} />
            <FeatureBadge label="Taxi Routing" enabled={airportData.hasTaxiwayRouting} />
          </div>
        </div>

        {/* Runways */}
        {airportData.runways && airportData.runways.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
              <Plane className="h-4 w-4" /> Runways ({airportData.runways.length})
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {airportData.runways.slice(0, 6).map((runway, idx) => (
                <div key={idx} className="bg-muted/50 rounded-lg p-2 text-xs">
                  <p className="font-semibold text-primary">{runway.name}</p>
                  <p className="text-muted-foreground">
                    {Math.round(runway.length)}ft x {Math.round(runway.width)}ft
                  </p>
                  <p className="text-muted-foreground">
                    {surfaceTypes[runway.surface] || 'Unknown'} 
                    {runway.ils && ' • ILS'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Frequencies */}
        {airportData.frequencies && airportData.frequencies.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              <Radio className="h-3 w-3" /> Frequencies
            </p>
            <div className="flex flex-wrap gap-2">
              {airportData.frequencies.slice(0, 8).map((freq, idx) => (
                <span key={idx} className="bg-muted/50 px-2 py-1 rounded text-xs">
                  <span className="text-warning font-semibold">{frequencyTypes[freq.type] || 'COM'}</span>
                  <span className="text-foreground ml-1">{(freq.frequency / 1000).toFixed(3)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureBadge({ label, enabled }: { label: string; enabled?: boolean }) {
  if (enabled === undefined) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        {label}: N/A
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant={enabled ? "default" : "secondary"}
      className={`text-xs ${enabled ? 'bg-success/20 text-success border-success/30' : 'text-muted-foreground'}`}
    >
      {enabled ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}
