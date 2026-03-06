import { useState, useEffect } from "react";
import { Plane, Wrench, RefreshCw, Plus, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FleetAircraft {
  id: string;
  tail_number: string;
  status: 'idle' | 'in_flight' | 'maintenance';
  current_location: string;
  total_flights: number;
  total_hours: number;
  livery: string | null;
  aircraft: {
    type_code: string;
    name: string;
    family: string;
  };
  assigned_to: string | null;
  profile?: {
    callsign: string;
    name: string;
  } | null;
}

interface AircraftType {
  id: string;
  name: string;
  type_code: string;
  family: string;
}

export function AdminFleetManagement() {
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [aircraftTypes, setAircraftTypes] = useState<AircraftType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newAircraft, setNewAircraft] = useState({
    tail_number: '',
    aircraft_id: '',
    current_location: 'UUEE',
    livery: 'Aeroflot',
  });

  useEffect(() => {
    fetchFleet();
    fetchAircraftTypes();
  }, []);

  const fetchAircraftTypes = async () => {
    const { data } = await supabase.from('aircraft').select('id, name, type_code, family').order('family');
    if (data) setAircraftTypes(data);
  };

  const fetchFleet = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('virtual_fleet')
      .select(`id, tail_number, status, current_location, total_flights, total_hours, assigned_to, livery, aircraft:aircraft(type_code, name, family)`)
      .order('tail_number');

    if (!error && data) {
      const fleetWithProfiles = await Promise.all(
        data.map(async (aircraft) => {
          if (aircraft.assigned_to) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('callsign, name')
              .eq('user_id', aircraft.assigned_to)
              .single();
            return { ...aircraft, profile: profileData } as FleetAircraft;
          }
          return { ...aircraft, profile: null } as FleetAircraft;
        })
      );
      setFleet(fleetWithProfiles);
    }
    setIsLoading(false);
  };

  const addFleetAircraft = async () => {
    if (!newAircraft.tail_number || !newAircraft.aircraft_id) {
      toast.error('Tail number and aircraft type are required');
      return;
    }
    const { error } = await supabase.from('virtual_fleet').insert({
      tail_number: newAircraft.tail_number.toUpperCase(),
      aircraft_id: newAircraft.aircraft_id,
      current_location: newAircraft.current_location.toUpperCase(),
      livery: newAircraft.livery || 'Aeroflot',
      status: 'idle',
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Aircraft added to fleet');
      setAddOpen(false);
      setNewAircraft({ tail_number: '', aircraft_id: '', current_location: 'UUEE', livery: 'Aeroflot' });
      fetchFleet();
    }
  };

  const deleteFleetAircraft = async (id: string) => {
    const { error } = await supabase.from('virtual_fleet').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Aircraft removed'); fetchFleet(); }
  };

  const updateStatus = async (aircraftId: string, newStatus: 'idle' | 'in_flight' | 'maintenance') => {
    setUpdatingId(aircraftId);
    const { error } = await supabase.from('virtual_fleet').update({ status: newStatus }).eq('id', aircraftId);
    if (error) toast.error('Failed to update');
    else { toast.success(`Status → ${newStatus}`); fetchFleet(); }
    setUpdatingId(null);
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-green-500';
      case 'in_flight': return 'bg-blue-500';
      case 'maintenance': return 'bg-yellow-500';
      default: return 'bg-muted';
    }
  };

  if (isLoading) {
    return (
      <SectionCard title="Fleet Management" icon={<Plane className="h-5 w-5 text-muted-foreground" />}>
        <div className="flex items-center justify-center py-8">
          <Plane className="h-6 w-6 animate-pulse text-primary" />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Fleet Management" icon={<Plane className="h-5 w-5 text-muted-foreground" />} className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {fleet.length} aircraft in fleet. Auto-maintenance every 3 flights.
        </p>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Add Aircraft</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Fleet Aircraft</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Tail Number</Label>
                  <Input placeholder="VP-BKI" value={newAircraft.tail_number}
                    onChange={e => setNewAircraft(p => ({ ...p, tail_number: e.target.value }))} /></div>
                <div><Label>Aircraft Type</Label>
                  <Select value={newAircraft.aircraft_id} onValueChange={v => setNewAircraft(p => ({ ...p, aircraft_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {aircraftTypes.map(ac => (
                        <SelectItem key={ac.id} value={ac.id}>{ac.name} ({ac.type_code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select></div>
                <div><Label>Base Location (ICAO)</Label>
                  <Input placeholder="UUEE" value={newAircraft.current_location}
                    onChange={e => setNewAircraft(p => ({ ...p, current_location: e.target.value }))} /></div>
                <div><Label>Livery</Label>
                  <Input placeholder="Aeroflot" value={newAircraft.livery}
                    onChange={e => setNewAircraft(p => ({ ...p, livery: e.target.value }))} /></div>
                <Button onClick={addFleetAircraft} className="w-full">Add to Fleet</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={fetchFleet} className="gap-2">
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-primary">Tail</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Livery</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Flights</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fleet.map(ac => (
              <TableRow key={ac.id}>
                <TableCell className="font-medium text-primary">{ac.tail_number}</TableCell>
                <TableCell>{ac.aircraft?.type_code || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{ac.livery || '-'}</TableCell>
                <TableCell>{ac.current_location}</TableCell>
                <TableCell>{ac.total_flights}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getStatusDot(ac.status)}`} />
                    <span className="capitalize">{ac.status === 'in_flight' ? 'In Flight' : ac.status}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {ac.profile ? `${ac.profile.callsign} (${ac.profile.name})` : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Select value={ac.status} onValueChange={v => updateStatus(ac.id, v as any)} disabled={updatingId === ac.id}>
                      <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="idle">Idle</SelectItem>
                        <SelectItem value="in_flight">In Flight</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => deleteFleetAircraft(ac.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="pt-4 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wrench className="h-4 w-4" />
          <span>Aircraft enter 2-hour maintenance after every 3 flights.</span>
        </div>
      </div>
    </SectionCard>
  );
}
