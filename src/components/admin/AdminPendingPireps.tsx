import { useEffect, useState } from 'react';
import { FileText, Check, X, Plane } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Pirep {
  id: string;
  user_id: string;
  dispatch_leg_id: string | null;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  flight_time_hrs: number;
  flight_time_mins: number;
  passengers: number | null;
  cargo_weight_kg: number | null;
  landing_rate: number | null;
  fuel_used: number | null;
  submitted_at: string;
  tail_number: string | null;
  aircraft: {
    name: string;
    type_code: string;
    multiplier: number;
  };
  profile: {
    name: string;
    callsign: string;
    base_airport: string | null;
  };
  baseMultiplier?: number;
}

export function AdminPendingPireps() {
  const { user } = useAuth();
  const [pireps, setPireps] = useState<Pirep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedPirep, setSelectedPirep] = useState<Pirep | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchPireps();
  }, []);

  const fetchPireps = async () => {
    setIsLoading(true);
    
    const { data } = await supabase
      .from('pireps')
      .select(`
        id,
        user_id,
        dispatch_leg_id,
        flight_number,
        departure_airport,
        arrival_airport,
        flight_time_hrs,
        flight_time_mins,
        passengers,
        cargo_weight_kg,
        landing_rate,
        fuel_used,
        submitted_at,
        tail_number,
        aircraft:aircraft(name, type_code, multiplier)
      `)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true });

    if (data) {
      // Fetch profiles for each PIREP
      const pirepsWithProfiles = await Promise.all(
        data.map(async (pirep) => {
          const { data: profileData, error: profileErr } = await supabase
            .from('profiles')
            .select('name, callsign, base_airport')
            .eq('user_id', pirep.user_id)
            .maybeSingle();

          if (profileErr) {
            console.error('Error fetching profile for PIREP:', profileErr);
          }
          
          return {
            ...pirep,
            profile: profileData || { name: 'Unknown', callsign: '---', base_airport: null },
            baseMultiplier: 1,
          } as Pirep & { baseMultiplier: number };
        })
      );
      
      setPireps(pirepsWithProfiles);
    }
    
    setIsLoading(false);
  };

  const approvePirep = async (pirep: Pirep & { baseMultiplier?: number }) => {
    // Calculate rewards with base multiplier
    const aircraftMultiplier = pirep.aircraft?.multiplier || 1;
    const baseMultiplier = pirep.baseMultiplier || 1;
    const totalMultiplier = aircraftMultiplier * baseMultiplier;
    
    const baseXP = Math.round(pirep.flight_time_hrs * 100);
    const baseMoney = Math.round(pirep.flight_time_hrs * 5000 * totalMultiplier);
    
    // Bonus for good landing rate
    let landingBonus = 0;
    if (pirep.landing_rate && Math.abs(pirep.landing_rate) < 200) {
      landingBonus = 50;
    }

    const totalXP = baseXP + landingBonus;
    const totalMoney = baseMoney;

    // Update PIREP
    const { error: pirepError } = await supabase
      .from('pireps')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user!.id,
        xp_earned: totalXP,
        money_earned: totalMoney,
      })
      .eq('id', pirep.id);

    if (pirepError) {
      toast.error('Failed to approve PIREP');
      return;
    }

    // Update dispatch leg if exists
    if (pirep.dispatch_leg_id) {
      await supabase
        .from('dispatch_legs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', pirep.dispatch_leg_id);
    }

    // Update pilot profile
    const { data: currentProfile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('xp, money, total_hours, total_flights')
      .eq('user_id', pirep.user_id)
      .maybeSingle();

    if (profileFetchError) {
      console.error('Error fetching pilot profile for stats update:', profileFetchError);
      toast.error('Approved PIREP, but failed to update pilot stats');
      fetchPireps();
      return;
    }

    if (!currentProfile) {
      toast.error('Approved PIREP, but pilot profile is missing (please resync user)');
      fetchPireps();
      return;
    }

    const nextTotalHours = (Number(currentProfile.total_hours) || 0) + pirep.flight_time_hrs + (pirep.flight_time_mins || 0) / 60;

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        xp: (currentProfile.xp || 0) + totalXP,
        money: (Number(currentProfile.money) || 0) + totalMoney,
        total_hours: nextTotalHours,
        total_flights: (currentProfile.total_flights || 0) + 1,
      })
      .eq('user_id', pirep.user_id);

    if (profileUpdateError) {
      console.error('Error updating pilot stats:', profileUpdateError);
      toast.error('Approved PIREP, but failed to update pilot stats');
      fetchPireps();
      return;
    }

    toast.success(`PIREP approved! Awarded ${totalXP} XP and ₹${totalMoney}`);
    fetchPireps();
  };

  const rejectPirep = async () => {
    if (!selectedPirep) return;

    const { error } = await supabase
      .from('pireps')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user!.id,
        rejection_reason: rejectReason || 'PIREP rejected by admin',
      })
      .eq('id', selectedPirep.id);

    if (error) {
      toast.error('Failed to reject PIREP');
    } else {
      // Update dispatch leg back to dispatched so pilot can re-file
      if (selectedPirep.dispatch_leg_id) {
        await supabase
          .from('dispatch_legs')
          .update({ status: 'dispatched' })
          .eq('id', selectedPirep.dispatch_leg_id);
      }
      
      toast.success('PIREP rejected');
      setDialogOpen(false);
      setSelectedPirep(null);
      setRejectReason('');
      fetchPireps();
    }
  };

  if (isLoading) {
    return (
      <SectionCard title="Pending PIREPs" icon={<FileText className="h-5 w-5" />}>
        <div className="flex items-center justify-center py-8">
          <Plane className="h-6 w-6 animate-pulse text-va-gold" />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title={`Pending PIREPs (${pireps.length})`} 
      icon={<FileText className="h-5 w-5 text-muted-foreground" />}
    >
      {pireps.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">No pending PIREPs to review</p>
      ) : (
        <div className="space-y-4">
          {pireps.map((pirep) => (
            <div 
              key={pirep.id}
              className="p-4 bg-muted rounded-lg border border-border"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-medium">{pirep.profile.name}</p>
                    <span className="text-va-gold">({pirep.profile.callsign})</span>
                    {pirep.profile.base_airport && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                        Base: {pirep.profile.base_airport} ({pirep.baseMultiplier}x)
                      </span>
                    )}
                  </div>
                  
                  <p className="text-lg font-bold mb-2">
                    {pirep.flight_number} • {pirep.departure_airport} → {pirep.arrival_airport}
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Aircraft</p>
                      <p className="font-medium">{pirep.aircraft?.type_code}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Flight Time</p>
                      <p className="font-medium">{pirep.flight_time_hrs}h {pirep.flight_time_mins}m</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Landing Rate</p>
                      <p className="font-medium">{pirep.landing_rate || '-'} fpm</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Passengers</p>
                      <p className="font-medium">{pirep.passengers || '-'}</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted: {new Date(pirep.submitted_at).toLocaleString()}
                  </p>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Dialog open={dialogOpen && selectedPirep?.id === pirep.id} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                      setSelectedPirep(null);
                      setRejectReason('');
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => setSelectedPirep(pirep)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reject PIREP</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                          Rejecting PIREP for {pirep.flight_number} ({pirep.profile.callsign})
                        </p>
                        <Input
                          placeholder="Reason for rejection (optional)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={rejectPirep}>
                          Reject PIREP
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    size="sm" 
                    className="gap-2 bg-success hover:bg-success/90"
                    onClick={() => approvePirep(pirep)}
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
