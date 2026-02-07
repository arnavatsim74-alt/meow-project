import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plane, Trash2, ExternalLink, BookOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SavedFlightPlan {
  id: string;
  ofp_id: string;
  callsign: string | null;
  flight_number: string | null;
  origin_icao: string;
  destination_icao: string;
  alternate_icao: string | null;
  aircraft_type: string | null;
  aircraft_reg: string | null;
  route: string | null;
  cruise_altitude: string | null;
  block_fuel: string | null;
  est_time_enroute: string | null;
  distance_nm: string | null;
  pax_count: string | null;
  created_at: string;
}

export default function MyFlightPlans() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SavedFlightPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchPlans();
  }, [user]);

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_flight_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved plans:', error);
    } else {
      setPlans((data as SavedFlightPlan[]) || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('saved_flight_plans').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      setPlans(prev => prev.filter(p => p.id !== id));
      toast({ title: 'Flight plan deleted' });
    }
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            My Flight Plans
          </h1>
          <p className="text-sm text-muted-foreground">
            Saved operational flight plans
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/simbrief')} className="gap-2">
          <Plane className="h-4 w-4" />
          New OFP
        </Button>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!loading && plans.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold text-foreground">No Saved Flight Plans</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Generate a flight plan and click "Save" in the OFP Viewer to save it here.
          </p>
          <Button variant="outline" onClick={() => navigate('/simbrief')}>
            Go to OFP Generator
          </Button>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div className="space-y-4">
          {plans.map(plan => (
            <div
              key={plan.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Route & Flight Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-bold text-foreground">
                      {plan.origin_icao} → {plan.destination_icao}
                    </span>
                    {plan.alternate_icao && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        ALT: {plan.alternate_icao}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {plan.callsign && (
                      <span><span className="font-medium text-foreground/80">Callsign:</span> {plan.callsign}</span>
                    )}
                    {plan.aircraft_type && (
                      <span><span className="font-medium text-foreground/80">Aircraft:</span> {plan.aircraft_type}</span>
                    )}
                    {plan.aircraft_reg && (
                      <span><span className="font-medium text-foreground/80">Reg:</span> {plan.aircraft_reg}</span>
                    )}
                    {plan.distance_nm && (
                      <span><span className="font-medium text-foreground/80">Dist:</span> {plan.distance_nm} NM</span>
                    )}
                    {plan.est_time_enroute && (
                      <span><span className="font-medium text-foreground/80">ETE:</span> {formatTime(plan.est_time_enroute)}</span>
                    )}
                    {plan.cruise_altitude && (
                      <span><span className="font-medium text-foreground/80">FL:</span> {plan.cruise_altitude}</span>
                    )}
                    {plan.block_fuel && (
                      <span><span className="font-medium text-foreground/80">Fuel:</span> {formatWeight(plan.block_fuel)}</span>
                    )}
                  </div>
                  {plan.route && (
                    <p className="text-xs text-muted-foreground/70 font-mono mt-2 truncate max-w-xl">
                      {plan.route}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    Saved {formatDate(plan.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/ofp?ofp_id=${plan.ofp_id}`)}
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Flight Plan?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove the saved {plan.origin_icao} → {plan.destination_icao} flight plan. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(plan.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
