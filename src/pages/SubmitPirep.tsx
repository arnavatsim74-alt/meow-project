import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Plane, Send } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DispatchLeg {
  id: string;
  leg_number: number;
  aircraft_id: string;
  callsign: string;
  tail_number: string | null;
  route: {
    id: string;
    flight_number: string;
    departure_airport: string;
    arrival_airport: string;
    distance_nm: number;
    estimated_time_hrs: number;
  };
  aircraft: {
    id: string;
    name: string;
    type_code: string;
    seats: number;
  };
}

interface Aircraft {
  id: string;
  name: string;
  type_code: string;
  seats: number;
}

export default function SubmitPirep() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const legId = searchParams.get('leg');

  const [dispatchLeg, setDispatchLeg] = useState<DispatchLeg | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [flightNumber, setFlightNumber] = useState('');
  const [departureAirport, setDepartureAirport] = useState('');
  const [arrivalAirport, setArrivalAirport] = useState('');
  const [selectedAircraftId, setSelectedAircraftId] = useState('');
  const [tailNumber, setTailNumber] = useState('');
  const [flightTimeHrs, setFlightTimeHrs] = useState('');
  const [flightTimeMins, setFlightTimeMins] = useState('0');
  const [passengers, setPassengers] = useState('');
  const [cargoWeight, setCargoWeight] = useState('');
  const [landingRate, setLandingRate] = useState('');
  const [fuelUsed, setFuelUsed] = useState('');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, legId]);

  const fetchData = async () => {
    setIsLoading(true);

    // Fetch aircraft list
    const { data: aircraftData } = await supabase
      .from('aircraft')
      .select('id, name, type_code, seats')
      .order('name');

    if (aircraftData) {
      setAircraft(aircraftData);
    }

    // If leg ID provided, fetch leg details
    if (legId) {
      const { data: legData } = await supabase
        .from('dispatch_legs')
        .select(`
          id,
          leg_number,
          aircraft_id,
          callsign,
          tail_number,
          route:routes(id, flight_number, departure_airport, arrival_airport, distance_nm, estimated_time_hrs),
          aircraft:aircraft(id, name, type_code, seats)
        `)
        .eq('id', legId)
        .eq('user_id', user!.id)
        .single();

      if (legData) {
        const leg = legData as unknown as DispatchLeg;
        setDispatchLeg(leg);
        
        // Pre-fill form from leg data
        setFlightNumber(leg.route?.flight_number || '');
        setDepartureAirport(leg.route?.departure_airport || '');
        setArrivalAirport(leg.route?.arrival_airport || '');
        setSelectedAircraftId(leg.aircraft_id || '');
        setTailNumber(leg.tail_number || '');
        
        const hrs = Math.floor(leg.route?.estimated_time_hrs || 0);
        const mins = Math.round(((leg.route?.estimated_time_hrs || 0) - hrs) * 60);
        setFlightTimeHrs(hrs.toString());
        setFlightTimeMins(mins.toString());
      }
    }

    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validation
    if (!flightNumber || !departureAirport || !arrivalAirport || !selectedAircraftId) {
      toast.error('Please fill in all required fields');
      setIsSubmitting(false);
      return;
    }

    const totalHours = parseFloat(flightTimeHrs || '0') + (parseInt(flightTimeMins || '0') / 60);

    const pirepData = {
      user_id: user!.id,
      dispatch_leg_id: legId || null,
      aircraft_id: selectedAircraftId,
      route_id: dispatchLeg?.route?.id || null,
      flight_number: flightNumber.toUpperCase(),
      departure_airport: departureAirport.toUpperCase(),
      arrival_airport: arrivalAirport.toUpperCase(),
      tail_number: tailNumber || null,
      flight_time_hrs: totalHours,
      flight_time_mins: parseInt(flightTimeMins || '0'),
      passengers: passengers ? parseInt(passengers) : null,
      cargo_weight_kg: cargoWeight ? parseInt(cargoWeight) : null,
      landing_rate: landingRate ? parseInt(landingRate) : null,
      fuel_used: fuelUsed ? parseInt(fuelUsed) : null,
      status: 'pending',
    };

    const { error } = await supabase
      .from('pireps')
      .insert(pirepData);

    if (error) {
      toast.error('Failed to submit PIREP: ' + error.message);
    } else {
      // Update dispatch leg status if this was from a dispatch
      if (legId) {
        await supabase
          .from('dispatch_legs')
          .update({ status: 'awaiting_approval' })
          .eq('id', legId);
      }
      
      // Get the inserted PIREP ID and send to Discord
      const { data: insertedPirep } = await supabase
        .from('pireps')
        .select('id')
        .eq('user_id', user!.id)
        .eq('flight_number', flightNumber.toUpperCase())
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single();

      if (insertedPirep?.id) {
        // Fire and forget - don't block the UI
        supabase.functions.invoke('discord-pirep-webhook', {
          body: { pirep_id: insertedPirep.id }
        }).catch(err => console.error('Discord webhook error:', err));
      }

      toast.success('PIREP submitted successfully! Awaiting admin review.');
      navigate('/dispatch');
    }

    setIsSubmitting(false);
  };

  if (loading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Plane className="h-8 w-8 animate-pulse text-va-gold" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const selectedAircraft = aircraft.find(a => a.id === selectedAircraftId);

  return (
    <DashboardLayout>
      <SectionCard 
        title={dispatchLeg ? `File PIREP - LEG ${dispatchLeg.leg_number}` : 'Submit PIREP'}
        icon={<Plane className="h-5 w-5 text-muted-foreground" />}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Flight Info */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="flightNumber">Flight Number *</Label>
              <Input
                id="flightNumber"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                placeholder="IX419"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departure">Departure Airport *</Label>
              <Input
                id="departure"
                value={departureAirport}
                onChange={(e) => setDepartureAirport(e.target.value)}
                placeholder="VOCI"
                required
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arrival">Arrival Airport *</Label>
              <Input
                id="arrival"
                value={arrivalAirport}
                onChange={(e) => setArrivalAirport(e.target.value)}
                placeholder="OMAA"
                required
                maxLength={4}
              />
            </div>
          </div>

          {/* Aircraft Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aircraft">Aircraft *</Label>
              <Select value={selectedAircraftId} onValueChange={setSelectedAircraftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select aircraft" />
                </SelectTrigger>
                <SelectContent>
                  {aircraft.map((ac) => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.name} ({ac.type_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tailNumber">Tail Number</Label>
              <Input
                id="tailNumber"
                value={tailNumber}
                onChange={(e) => setTailNumber(e.target.value)}
                placeholder="VT-CIF"
              />
            </div>
          </div>

          {/* Flight Time */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="flightTimeHrs">Flight Time (Hours) *</Label>
              <Input
                id="flightTimeHrs"
                type="number"
                step="0.01"
                min="0"
                value={flightTimeHrs}
                onChange={(e) => setFlightTimeHrs(e.target.value)}
                placeholder="3"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flightTimeMins">Flight Time (Minutes)</Label>
              <Input
                id="flightTimeMins"
                type="number"
                min="0"
                max="59"
                value={flightTimeMins}
                onChange={(e) => setFlightTimeMins(e.target.value)}
                placeholder="45"
              />
            </div>
          </div>

          {/* Payload */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="passengers">
                Passengers {selectedAircraft && `(max ${selectedAircraft.seats})`}
              </Label>
              <Input
                id="passengers"
                type="number"
                min="0"
                max={selectedAircraft?.seats || 999}
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                placeholder="180"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo Weight (kg)</Label>
              <Input
                id="cargo"
                type="number"
                min="0"
                value={cargoWeight}
                onChange={(e) => setCargoWeight(e.target.value)}
                placeholder="2500"
              />
            </div>
          </div>

          {/* Performance */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="landingRate">Landing Rate (fpm)</Label>
              <Input
                id="landingRate"
                type="number"
                value={landingRate}
                onChange={(e) => setLandingRate(e.target.value)}
                placeholder="-150"
              />
              <p className="text-xs text-muted-foreground">Negative values for descent</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuelUsed">Fuel Used (kg)</Label>
              <Input
                id="fuelUsed"
                type="number"
                min="0"
                value={fuelUsed}
                onChange={(e) => setFuelUsed(e.target.value)}
                placeholder="5500"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => navigate('/dispatch')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit PIREP'}
            </Button>
          </div>
        </form>
      </SectionCard>
    </DashboardLayout>
  );
}
