import { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plane, ArrowLeft, RefreshCw, Map, FileText, ExternalLink, Send, Info, Download, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useSimBriefOFP, OFPData } from '@/hooks/useSimBriefOFP';
import { IFAirportCard } from '@/components/aviation/IFAirportCard';
import { ATISCard } from '@/components/aviation/ATISCard';
import { MetarWeatherCard } from '@/components/aviation/MetarWeatherCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { openSimBriefPopup, monitorSimBriefPopup, storePendingOFP, clearPendingOFP, SimBriefFormData } from '@/lib/simbrief';

const AIRCRAFT_TYPES = [
  { code: 'A20N', name: 'Airbus A320neo' },
  { code: 'A21N', name: 'Airbus A321neo' },
  { code: 'A320', name: 'Airbus A320' },
  { code: 'A321', name: 'Airbus A321' },
  { code: 'A332', name: 'Airbus A330-200' },
  { code: 'A333', name: 'Airbus A330-300' },
  { code: 'A339', name: 'Airbus A330-900neo' },
  { code: 'A359', name: 'Airbus A350-900' },
  { code: 'A35K', name: 'Airbus A350-1000' },
  { code: 'B738', name: 'Boeing 737-800' },
  { code: 'B739', name: 'Boeing 737-900' },
  { code: 'B77L', name: 'Boeing 777-200LR' },
  { code: 'B77W', name: 'Boeing 777-300ER' },
  { code: 'B78X', name: 'Boeing 787-10' },
  { code: 'B789', name: 'Boeing 787-9' },
  { code: 'B788', name: 'Boeing 787-8' },
];

export default function FlightBriefing() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { ofpData, loading, error, fetchOFPById, clearOFP } = useSimBriefOFP();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Form state
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [aircraftType, setAircraftType] = useState('A320');
  const [flightNumber, setFlightNumber] = useState('');
  const [passengers, setPassengers] = useState('');
  const [cargo, setCargo] = useState('');
  
  const [generating, setGenerating] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
  }, []);

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Plane className="h-8 w-8 animate-pulse text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleGenerateOFP = async () => {
    if (!origin || !destination) {
      toast({
        title: 'Missing Fields',
        description: 'Please enter origin and destination airports',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    clearOFP();
    clearPendingOFP();

    try {
      const outputPage = `${window.location.origin}/simbrief/callback`;
      
      const formData: SimBriefFormData = {
        orig: origin.toUpperCase(),
        dest: destination.toUpperCase(),
        type: aircraftType,
        airline: 'AFL',
        fltnum: flightNumber || '001',
        pax: passengers || undefined,
        cargo: cargo || undefined,
      };
      
      const { popup, timestamp } = await openSimBriefPopup(formData, outputPage);
      
      if (!popup) {
        throw new Error('Failed to open SimBrief popup. Please disable your pop-up blocker.');
      }
      
      popupRef.current = popup;
      storePendingOFP({ formData, timestamp });
      
      toast({
        title: 'SimBrief Opened',
        description: 'Complete the flight plan in the popup.',
      });
      
      cleanupRef.current = monitorSimBriefPopup(
        popup,
        formData,
        timestamp,
        async (ofpId) => {
          setGenerating(false);
          await fetchOFPById(ofpId);
        },
        () => {
          setGenerating(false);
          toast({
            title: 'Timeout',
            description: 'SimBrief took too long to respond',
            variant: 'destructive',
          });
        }
      );
      
    } catch (err) {
      setGenerating(false);
      console.error('Error generating OFP:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to generate flight plan',
        variant: 'destructive',
      });
    }
  };

  const handleNewFlightPlan = () => {
    clearOFP();
    setOrigin('');
    setDestination('');
    setFlightNumber('');
    setPassengers('');
    setCargo('');
  };

  const formatTime = (seconds: string | null) => {
    if (!seconds) return 'N/A';
    const mins = parseInt(seconds) / 60;
    const hrs = Math.floor(mins / 60);
    const remainingMins = Math.round(mins % 60);
    return `${hrs}h ${remainingMins}m`;
  };

  const formatWeight = (kg: string | null) => {
    if (!kg) return 'N/A';
    return `${parseInt(kg).toLocaleString()} kg`;
  };

  const formatLegTime = (seconds: string): string => {
    if (!seconds) return '0h 0m';
    const totalMins = parseInt(seconds) / 60;
    const hrs = Math.floor(totalMins / 60);
    const mins = Math.round(totalMins % 60);
    return `${hrs}h ${mins}m`;
  };

  const parseRunwayHeading = (rwy: string | null): number => {
    if (!rwy) return 0;
    const match = rwy.match(/(\d{1,2})/);
    if (!match) return 0;
    return parseInt(match[1]) * 10;
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/dispatch')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dispatch
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Flight Briefing
            </h1>
            <p className="text-sm text-muted-foreground">
              Create or fetch your flight plan
            </p>
          </div>
        </div>
        {ofpData && (
          <Button variant="outline" size="sm" onClick={handleNewFlightPlan} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            New Flight Plan
          </Button>
        )}
      </div>

      {generating && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-warning" />
            <div>
              <p className="font-semibold text-foreground">Generating Flight Plan...</p>
              <p className="text-sm text-muted-foreground">
                Complete the plan in the SimBrief popup.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual Input Form */}
      {!ofpData && !generating && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-warning rounded-full" />
            <h3 className="text-lg font-semibold text-foreground">Flight Plan Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="origin">Origin (ICAO) *</Label>
              <Input
                id="origin"
                placeholder="e.g., UUEE"
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                maxLength={4}
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination (ICAO) *</Label>
              <Input
                id="destination"
                placeholder="e.g., LFPG"
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                maxLength={4}
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aircraft">Aircraft Type *</Label>
              <Select value={aircraftType} onValueChange={setAircraftType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select aircraft" />
                </SelectTrigger>
                <SelectContent>
                  {AIRCRAFT_TYPES.map((ac) => (
                    <SelectItem key={ac.code} value={ac.code}>
                      {ac.code} - {ac.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="flightNumber">Flight Number</Label>
              <Input
                id="flightNumber"
                placeholder="e.g., 1234"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passengers">Passengers</Label>
              <Input
                id="passengers"
                type="number"
                placeholder="e.g., 150"
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo (kg)</Label>
              <Input
                id="cargo"
                type="number"
                placeholder="e.g., 5000"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleGenerateOFP} 
            disabled={!origin || !destination || loading}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Generate OFP
          </Button>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive mb-6">
          {error}
        </div>
      )}

      {ofpData && (
        <>
          {/* Flight Summary Header */}
          <div className="bg-gradient-to-r from-card to-muted/50 border border-border rounded-xl p-6 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase">Flight</p>
                <p className="font-bold text-lg text-foreground">{ofpData.atc.callsign || ofpData.general.flight_number}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase">Route</p>
                <p className="font-bold text-lg text-foreground">
                  {ofpData.origin.icao_code} → {ofpData.destination.icao_code}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase">Aircraft</p>
                <p className="font-bold text-lg text-foreground">{ofpData.aircraft.icaocode}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase">Time</p>
                <p className="font-bold text-lg text-foreground">{formatTime(ofpData.times.est_time_enroute)}</p>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 lg:grid-cols-8 mb-6 bg-muted/50 h-auto">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="map" className="text-xs">Map</TabsTrigger>
              <TabsTrigger value="route" className="text-xs">Route</TabsTrigger>
              <TabsTrigger value="fuel" className="text-xs">Fuel & Weights</TabsTrigger>
              <TabsTrigger value="weather" className="text-xs">Weather</TabsTrigger>
              <TabsTrigger value="navlog" className="text-xs">Nav Log</TabsTrigger>
              <TabsTrigger value="airports" className="text-xs">Airports</TabsTrigger>
              <TabsTrigger value="atis" className="text-xs">Live ATIS</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-warning rounded-full" />
                    <h3 className="text-lg font-semibold text-foreground">Flight Information</h3>
                  </div>
                  <div className="space-y-3">
                    <DataRow label="Departure" value={`${ofpData.origin.icao_code} - ${ofpData.origin.name}`} />
                    <DataRow label="Arrival" value={`${ofpData.destination.icao_code} - ${ofpData.destination.name}`} />
                    <DataRow label="Alternate" value={ofpData.alternate.icao_code || 'N/A'} />
                    <DataRow label="Distance" value={`${ofpData.general.air_distance} NM`} />
                    <DataRow label="Flight Time" value={formatTime(ofpData.times.est_time_enroute)} />
                    <DataRow label="Departure Runway" value={ofpData.origin.plan_rwy || 'N/A'} />
                    <DataRow label="Arrival Runway" value={ofpData.destination.plan_rwy || 'N/A'} />
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-warning rounded-full" />
                    <h3 className="text-lg font-semibold text-foreground">Performance Data</h3>
                  </div>
                  <div className="space-y-3">
                    <DataRow label="Cruise Altitude" value={`FL${ofpData.general.initial_altitude}`} />
                    <DataRow label="Aircraft Type" value={ofpData.aircraft.name} />
                    <DataRow label="Cost Index" value={ofpData.general.costindex || 'N/A'} />
                    <DataRow label="Cruise Speed" value={`M${ofpData.general.cruise_mach} / ${ofpData.general.cruise_tas} kts`} />
                    <DataRow label="Climb Profile" value={ofpData.general.climb_profile || 'N/A'} />
                    <DataRow label="Descent Profile" value={ofpData.general.descent_profile || 'N/A'} />
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-warning rounded-full" />
                  <h3 className="text-lg font-semibold text-foreground">ATC Flight Plan</h3>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs break-all whitespace-pre-wrap">
                  {ofpData.atc.flightplan_text || 'No ATC flight plan data'}
                </div>
              </div>
            </TabsContent>

            {/* Map Tab */}
            <TabsContent value="map" className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-warning rounded-full" />
                  <h3 className="text-lg font-semibold text-foreground">Flight Route Maps</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ofpData.images.maps.map((map, idx) => (
                    <div key={idx} className="bg-muted/50 rounded-lg overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <p className="text-sm font-medium text-foreground">{map.name}</p>
                      </div>
                      <img src={map.fullUrl} alt={map.name} className="w-full h-auto" loading="lazy" />
                      <div className="p-2">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => window.open(map.fullUrl, '_blank')}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Full Size
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {ofpData.links.skyvector && (
                  <div className="mt-4">
                    <Button variant="outline" onClick={() => window.open(ofpData.links.skyvector, '_blank')}>
                      <Map className="h-4 w-4 mr-2" />
                      View on SkyVector
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Route Tab */}
            <TabsContent value="route" className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-warning rounded-full" />
                  <h3 className="text-lg font-semibold text-foreground">Flight Plan Route</h3>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm break-all border-l-4 border-warning">
                  {ofpData.general.route || 'No route data'}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-warning rounded-full" />
                  <h3 className="text-lg font-semibold text-foreground">Route Details</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DataBox label="Departure SID" value={ofpData.general.sid_ident || 'N/A'} />
                  <DataBox label="Arrival STAR" value={ofpData.general.star_ident || 'N/A'} />
                  <DataBox label="Air Distance" value={`${ofpData.general.air_distance} NM`} />
                  <DataBox label="Great Circle Distance" value={`${ofpData.general.gc_distance} NM`} />
                </div>
              </div>
            </TabsContent>

            {/* Fuel & Weights Tab */}
            <TabsContent value="fuel" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-warning rounded-full" />
                    <h3 className="text-lg font-semibold text-foreground">Fuel Planning</h3>
                  </div>
                  <div className="space-y-3">
                    <DataRow label="Trip Fuel" value={formatWeight(ofpData.fuel.enroute_burn)} />
                    <DataRow label="Contingency" value={formatWeight(ofpData.fuel.contingency)} />
                    <DataRow label="Alternate" value={formatWeight(ofpData.fuel.alternate_burn)} />
                    <DataRow label="Reserve" value={formatWeight(ofpData.fuel.reserve)} />
                    <DataRow label="Extra" value={formatWeight(ofpData.fuel.extra)} />
                    <DataRow label="Taxi" value={formatWeight(ofpData.fuel.taxi)} />
                    <div className="pt-3 border-t border-border">
                      <DataRow label="Block Fuel" value={formatWeight(ofpData.fuel.plan_ramp)} highlight />
                    </div>
                    <DataRow label="Avg Fuel Flow" value={`${ofpData.fuel.avg_fuel_flow} kg/hr`} />
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-warning rounded-full" />
                    <h3 className="text-lg font-semibold text-foreground">Weight Planning</h3>
                  </div>
                  <div className="space-y-3">
                    <DataRow label="OEW" value={formatWeight(ofpData.weights.oew)} />
                    <DataRow label="Passengers" value={ofpData.weights.pax_count || 'N/A'} />
                    <DataRow label="Cargo" value={formatWeight(ofpData.weights.cargo)} />
                    <DataRow label="Payload" value={formatWeight(ofpData.weights.payload)} />
                    <div className="pt-3 border-t border-border">
                      <DataRow label="Est ZFW" value={formatWeight(ofpData.weights.est_zfw)} />
                      <DataRow label="Max ZFW" value={formatWeight(ofpData.weights.max_zfw)} muted />
                    </div>
                    <div className="pt-3 border-t border-border">
                      <DataRow label="Est TOW" value={formatWeight(ofpData.weights.est_tow)} highlight />
                      <DataRow label="Max TOW" value={formatWeight(ofpData.weights.max_tow)} muted />
                    </div>
                    <div className="pt-3 border-t border-border">
                      <DataRow label="Est LDW" value={formatWeight(ofpData.weights.est_ldw)} />
                      <DataRow label="Max LDW" value={formatWeight(ofpData.weights.max_ldw)} muted />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Weather Tab */}
            <TabsContent value="weather" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MetarWeatherCard 
                  metar={ofpData.origin.metar || ''} 
                  icao={ofpData.origin.icao_code}
                  label="Departure"
                  runwayHeading={parseRunwayHeading(ofpData.origin.plan_rwy)}
                />
                <MetarWeatherCard 
                  metar={ofpData.destination.metar || ''} 
                  icao={ofpData.destination.icao_code}
                  label="Arrival"
                  runwayHeading={parseRunwayHeading(ofpData.destination.plan_rwy)}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-warning rounded-full" />
                    <h3 className="text-lg font-semibold text-foreground">Departure TAF - {ofpData.origin.icao_code}</h3>
                  </div>
                  <p className="font-mono text-xs text-foreground bg-muted/50 p-2 rounded whitespace-pre-wrap">
                    {ofpData.origin.taf || 'No TAF data'}
                  </p>
                  <div className="mt-3">
                    <FlightCategoryBadge category={ofpData.origin.metar_category} />
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-warning rounded-full" />
                    <h3 className="text-lg font-semibold text-foreground">Arrival TAF - {ofpData.destination.icao_code}</h3>
                  </div>
                  <p className="font-mono text-xs text-foreground bg-muted/50 p-2 rounded whitespace-pre-wrap">
                    {ofpData.destination.taf || 'No TAF data'}
                  </p>
                  <div className="mt-3">
                    <FlightCategoryBadge category={ofpData.destination.metar_category} />
                  </div>
                </div>
              </div>

              {ofpData.alternate.icao_code && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-warning rounded-full" />
                    <h3 className="text-lg font-semibold text-foreground">Alternate Weather - {ofpData.alternate.icao_code}</h3>
                  </div>
                  <p className="font-mono text-sm text-foreground bg-muted/50 p-2 rounded break-all">
                    {ofpData.alternate.metar || 'No METAR data'}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Nav Log Tab */}
            <TabsContent value="navlog" className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-4 overflow-x-auto">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-warning rounded-full" />
                  <h3 className="text-lg font-semibold text-foreground">Navigation Log</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 px-2 text-muted-foreground font-medium">Waypoint</th>
                      <th className="py-2 px-2 text-muted-foreground font-medium">Airway</th>
                      <th className="py-2 px-2 text-muted-foreground font-medium">Alt</th>
                      <th className="py-2 px-2 text-muted-foreground font-medium">Wind</th>
                      <th className="py-2 px-2 text-muted-foreground font-medium">Dist</th>
                      <th className="py-2 px-2 text-muted-foreground font-medium">Time</th>
                      <th className="py-2 px-2 text-muted-foreground font-medium">Fuel Rem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ofpData.navlog.map((fix, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-2 font-mono font-medium text-foreground">{fix.ident}</td>
                        <td className="py-2 px-2 text-muted-foreground">{fix.via_airway || 'DCT'}</td>
                        <td className="py-2 px-2 text-foreground">FL{Math.round(parseInt(fix.altitude_feet) / 100)}</td>
                        <td className="py-2 px-2 text-foreground">{fix.wind_dir}°/{fix.wind_spd}kt</td>
                        <td className="py-2 px-2 text-foreground">{fix.distance}nm</td>
                        <td className="py-2 px-2 text-foreground">{formatLegTime(fix.time_total)}</td>
                        <td className="py-2 px-2 text-foreground">{formatWeight(fix.fuel_plan_onboard)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Airports Tab */}
            <TabsContent value="airports" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <IFAirportCard icao={ofpData.origin.icao_code} label="Departure" />
                <IFAirportCard icao={ofpData.destination.icao_code} label="Arrival" />
              </div>
              {ofpData.alternate.icao_code && (
                <IFAirportCard icao={ofpData.alternate.icao_code} label="Alternate" />
              )}
            </TabsContent>

            {/* ATIS Tab */}
            <TabsContent value="atis" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ATISCard icao={ofpData.origin.icao_code} label="Departure" />
                <ATISCard icao={ofpData.destination.icao_code} label="Arrival" />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </DashboardLayout>
  );
}

// Helper Components
function DataRow({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-medium ${highlight ? 'text-warning' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

function FlightCategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    VFR: 'bg-success text-success-foreground',
    MVFR: 'bg-blue-500 text-white',
    IFR: 'bg-destructive text-destructive-foreground',
    LIFR: 'bg-purple-600 text-white',
  };
  const color = colors[category?.toUpperCase()] || 'bg-muted text-muted-foreground';
  return (
    <Badge className={color}>
      Flight Category: {category?.toUpperCase() || 'UNKNOWN'}
    </Badge>
  );
}
