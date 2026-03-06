import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plane, Clock, Award, DollarSign, Shield, MapPin } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { NotamCard } from '@/components/dashboard/NotamCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/currency';
import { getRankByHours, getNextRank, getProgressToNextRank } from '@/lib/ranks';

interface DispatchLeg {
  id: string;
  leg_number: number;
  status: string;
  route: {
    flight_number: string;
    departure_airport: string;
    arrival_airport: string;
  };
}

interface RecentPirep {
  id: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  status: string;
  submitted_at: string;
  money_earned: number;
}

interface ActiveTypeRating {
  aircraft: {
    name: string;
    type_code: string;
    family: string;
  };
}

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const [dispatchLegs, setDispatchLegs] = useState<DispatchLeg[]>([]);
  const [recentPireps, setRecentPireps] = useState<RecentPirep[]>([]);
  const [activeTypeRating, setActiveTypeRating] = useState<ActiveTypeRating | null>(null);

  const totalHours = profile?.total_hours || 0;
  const currentRank = getRankByHours(totalHours);
  const nextRank = getNextRank(currentRank);
  const { progress, hoursToGo } = getProgressToNextRank(totalHours);

  useEffect(() => {
    if (user) {
      fetchDispatchLegs();
      fetchRecentPireps();
      fetchActiveTypeRating();
    }
  }, [user]);

  const fetchActiveTypeRating = async () => {
    const { data } = await supabase
      .from('type_ratings')
      .select(`
        aircraft:aircraft(name, type_code, family)
      `)
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .single();
    
    if (data) {
      setActiveTypeRating(data as unknown as ActiveTypeRating);
    }
  };

  const fetchDispatchLegs = async () => {
    const { data } = await supabase
      .from('dispatch_legs')
      .select(`id, leg_number, status, route:routes(flight_number, departure_airport, arrival_airport)`)
      .eq('user_id', user!.id)
      .in('status', ['assigned', 'awaiting_approval'])
      .order('leg_number')
      .limit(5);
    if (data) setDispatchLegs(data as unknown as DispatchLeg[]);
  };

  const fetchRecentPireps = async () => {
    const { data } = await supabase
      .from('pireps')
      .select('id, flight_number, departure_airport, arrival_airport, status, submitted_at, money_earned')
      .eq('user_id', user!.id)
      .order('submitted_at', { ascending: false })
      .limit(5);
    if (data) setRecentPireps(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Plane className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Plane className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }
  
  if (profile && !profile.is_approved) {
    return <Navigate to="/pending-approval" replace />;
  }

  return (
    <DashboardLayout>
      {/* Welcome Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Captain's Deck</h1>
          <p className="text-muted-foreground">Welcome back, {currentRank.name} {profile?.name || 'Pilot'}</p>
        </div>
        <StatusBadge status="active" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Rank</p>
            <p className="text-lg font-bold text-card-foreground truncate">{currentRank.name}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
            <DollarSign className="h-5 w-5 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Balance</p>
            <p className="text-lg font-bold text-card-foreground truncate">{formatCurrency(Number(profile?.money) || 0)}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
            <Clock className="h-5 w-5 text-info" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Flight Hours</p>
            <p className="text-lg font-bold text-card-foreground truncate">{totalHours.toFixed(1)}h</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Plane className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Flights</p>
            <p className="text-lg font-bold text-card-foreground truncate">{profile?.total_flights || 0}</p>
          </div>
        </div>
      </div>

      {/* Base & Aircraft Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Home Base</p>
            <p className="text-lg font-bold text-card-foreground truncate">
              {profile?.base_airport || 'Not Set'}
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Shield className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Aircraft Family</p>
            <p className="text-lg font-bold text-card-foreground truncate">
              {activeTypeRating?.aircraft?.family || profile?.active_aircraft_family || 'A320'}
            </p>
          </div>
        </div>
      </div>

      <NotamCard />

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <SectionCard title="Current Assignment" icon={<Plane className="h-5 w-5 text-muted-foreground" />}>
          {dispatchLegs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active dispatch legs</p>
          ) : (
            <div className="space-y-3">
              {dispatchLegs.map((leg) => (
                <div key={leg.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="font-medium text-card-foreground">{leg.route?.flight_number}</p>
                    <p className="text-xs text-muted-foreground">{leg.route?.departure_airport} → {leg.route?.arrival_airport}</p>
                  </div>
                  <StatusBadge status={leg.status as any} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent PIREPs">
          {recentPireps.length === 0 ? (
            <p className="text-muted-foreground text-sm">No PIREPs submitted yet</p>
          ) : (
            <div className="space-y-3">
              {recentPireps.map((pirep) => (
                <div key={pirep.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="font-medium text-card-foreground">{pirep.flight_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(pirep.submitted_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                  <StatusBadge status={pirep.status as any} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Rank Progress */}
      <div className="mt-6">
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-bold text-card-foreground mb-1">
            {nextRank ? `Next Rank: ${nextRank.name}` : 'Maximum Rank Achieved!'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {nextRank 
              ? `Fly ${hoursToGo.toFixed(1)} more hours to promote.`
              : `Congratulations, ${currentRank.name}! You've reached the highest rank.`
            }
          </p>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{totalHours.toFixed(1)} hours</span>
            <span>{nextRank ? `${nextRank.minHours} hours` : 'Max'}</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
