import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plane, Lock, FileText, Send, AlertCircle, RefreshCw, ExternalLink, MapPin } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DispatchLeg {
  id: string;
  leg_number: number;
  status: string;
  callsign: string;
  tail_number: string | null;
  dispatch_group_id: string | null;
  aircraft_id: string;
  route: {
    id: string;
    flight_number: string;
    departure_airport: string;
    arrival_airport: string;
    distance_nm: number;
    estimated_time_hrs: number;
  };
  aircraft: {
    name: string;
    type_code: string;
    family: string;
  };
  pirep?: {
    id: string;
    status: string;
  } | null;
}

interface CareerRequest {
  id: string;
  status: string;
  requested_at: string;
}

interface DepartureBase {
  id: string;
  icao_code: string;
  name: string;
}

export default function Dispatch() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [dispatchLegs, setDispatchLegs] = useState<DispatchLeg[]>([]);
  const [careerRequest, setCareerRequest] = useState<CareerRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  // New: departure base & routing rule
  const [departureBases, setDepartureBases] = useState<DepartureBase[]>([]);
  const [selectedBase, setSelectedBase] = useState('');
  const [routingRule, setRoutingRule] = useState('return_to_base');

  useEffect(() => {
    if (user) {
      fetchDispatchData();
      fetchDepartureBases();
    }
  }, [user]);

  const fetchDepartureBases = async () => {
    const { data } = await supabase
      .from('departure_bases')
      .select('*')
      .order('icao_code');
    if (data) {
      setDepartureBases(data);
      if (data.length > 0 && !selectedBase) {
        setSelectedBase(data[0].icao_code);
      }
    }
  };

  const cleanupStaleAssignments = async () => {
    const { data: allLegs, error: allLegsError } = await supabase
      .from('dispatch_legs')
      .select('id, status')
      .eq('user_id', user!.id)
      .order('assigned_at', { ascending: false })
      .limit(200);

    if (allLegsError) {
      console.error('Error checking stale assignments:', allLegsError);
      return false;
    }

    if (!allLegs || allLegs.length === 0) return false;

    const allCompleted = allLegs.every((l) => l.status === 'completed');
    if (!allCompleted) return false;

    const { error: deleteLegsError } = await supabase
      .from('dispatch_legs')
      .delete()
      .eq('user_id', user!.id);

    if (deleteLegsError) {
      console.error('Error deleting stale dispatch legs:', deleteLegsError);
      return false;
    }

    const { error: deleteRequestsError } = await supabase
      .from('career_requests')
      .delete()
      .eq('user_id', user!.id);

    if (deleteRequestsError) {
      console.error('Error deleting stale career requests:', deleteRequestsError);
    }

    setCareerRequest(null);
    setDispatchLegs([]);
    toast.success('Previous sector cleared. You can request a new assignment.');
    return true;
  };

  const fetchDispatchData = async () => {
    setIsLoading(true);

    const { data: requestData, error: requestError } = await supabase
      .from('career_requests')
      .select('*')
      .eq('user_id', user!.id)
      .order('requested_at', { ascending: false })
      .limit(1);

    if (requestError) {
      toast.error('Failed to load career request');
      setIsLoading(false);
      return;
    }

    const latestRequest = requestData && requestData.length > 0 ? requestData[0] : null;
    setCareerRequest(latestRequest);

    const { data: legsData, error: legsError } = await supabase
      .from('dispatch_legs')
      .select(`
        id,
        leg_number,
        status,
        callsign,
        tail_number,
        dispatch_group_id,
        aircraft_id,
        route:routes(id, flight_number, departure_airport, arrival_airport, distance_nm, estimated_time_hrs),
        aircraft:aircraft(name, type_code, family)
      `)
      .eq('user_id', user!.id)
      .order('leg_number');

    if (legsError) {
      toast.error('Failed to load dispatch legs');
      setIsLoading(false);
      return;
    }

    if (latestRequest?.status === 'approved' && (!legsData || legsData.length === 0)) {
      const didCleanup = await cleanupStaleAssignments();
      if (didCleanup) {
        setIsLoading(false);
        return;
      }
    }

    if (legsData && legsData.length > 0) {
      const legsWithPireps = await Promise.all(
        legsData.map(async (leg) => {
          const { data: pirepData } = await supabase
            .from('pireps')
            .select('id, status')
            .eq('dispatch_leg_id', leg.id)
            .order('submitted_at', { ascending: false })
            .limit(1);

          return {
            ...leg,
            pirep: pirepData?.[0] || null,
          } as DispatchLeg;
        })
      );

      setDispatchLegs(legsWithPireps);
    } else {
      setDispatchLegs([]);
    }

    setIsLoading(false);
  };

  const requestCareerAuto = async () => {
    if (!selectedBase) {
      toast.error('Please select a departure base');
      return;
    }
    setIsRequesting(true);
    try {
      const { error } = await supabase.functions.invoke('auto-assign-career', {
        body: { departureBase: selectedBase, routingRule },
      });

      if (error) throw error;

      toast.success('vCAREER auto-assigned!');
      fetchDispatchData();
    } catch (e: any) {
      toast.error(e?.message ?? 'Auto assignment failed (import routes first)');
    } finally {
      setIsRequesting(false);
    }
  };

  const requestAnotherCareer = async () => {
    setIsRequesting(true);

    try {
      const completedLegs = dispatchLegs.filter(
        (l) => l.status === 'completed' || l.pirep?.status === 'approved'
      );

      const legsToComplete = dispatchLegs
        .filter((l) => l.pirep?.status === 'approved' && l.status !== 'completed')
        .map((l) => l.id);

      if (legsToComplete.length > 0) {
        const { error: completeError } = await supabase
          .from('dispatch_legs')
          .update({ status: 'completed' })
          .in('id', legsToComplete);

        if (completeError) {
          console.error('Failed to finalize previous legs:', completeError);
          toast.error('Failed to finalize previous legs');
          setIsRequesting(false);
          return;
        }
      }

      const tailNumber = dispatchLegs[0]?.tail_number;
      const lastLeg = dispatchLegs[dispatchLegs.length - 1];
      const totalFlightHours = dispatchLegs.reduce(
        (sum, leg) => sum + (leg.route?.estimated_time_hrs || 0),
        0
      );

      if (tailNumber && lastLeg?.route?.arrival_airport) {
        const { error: fleetError } = await supabase.rpc('complete_aircraft_flight', {
          p_tail_number: tailNumber,
          p_arrival_airport: lastLeg.route.arrival_airport,
          p_flight_hours: totalFlightHours,
        });

        if (fleetError) {
          console.error('Failed to update fleet status:', fleetError);
        }
      }

      const allLegIds = dispatchLegs.map((l) => l.id);
      if (allLegIds.length > 0) {
        const { error: nullifyError } = await supabase
          .from('pireps')
          .update({ dispatch_leg_id: null })
          .in('dispatch_leg_id', allLegIds);

        if (nullifyError) {
          console.error('Failed to unlink PIREPs:', nullifyError);
        }
      }

      const { error: deleteLegsError } = await supabase
        .from('dispatch_legs')
        .delete()
        .eq('user_id', user!.id);

      if (deleteLegsError) {
        console.error('Failed to clear dispatch legs:', deleteLegsError);
        toast.error('Failed to clear previous assignment: ' + deleteLegsError.message);
        setIsRequesting(false);
        return;
      }

      const { error: deleteRequestsError } = await supabase
        .from('career_requests')
        .delete()
        .eq('user_id', user!.id)
        .in('status', ['approved', 'rejected']);

      if (deleteRequestsError) {
        console.error('Failed to clear career requests:', deleteRequestsError);
      }

      const { error: autoAssignError } = await supabase.functions.invoke('auto-assign-career', {
        body: { departureBase: selectedBase || undefined, routingRule },
      });

      if (autoAssignError) {
        throw autoAssignError;
      }

      toast.success('New vCAREER auto-assigned!');
      fetchDispatchData();
    } catch (e: any) {
      console.error('requestAnotherCareer error:', e);
      toast.error(e?.message ?? 'Failed to request new career');
    } finally {
      setIsRequesting(false);
    }
  };

  const dispatchFlight = async (legId: string) => {
    const leg = dispatchLegs.find(l => l.id === legId);
    
    const { error } = await supabase
      .from('dispatch_legs')
      .update({ status: 'dispatched' })
      .eq('id', legId);

    if (error) {
      toast.error('Failed to dispatch flight: ' + error.message);
    } else {
      toast.success('Flight dispatched!');
      
      if (leg?.route) {
        const params = new URLSearchParams({
          orig: leg.route.departure_airport,
          dest: leg.route.arrival_airport,
          fltnum: leg.route.flight_number?.replace(/\D/g, '') || '1234',
          type: leg.aircraft?.type_code || 'A320',
          legId: legId,
        });
        navigate(`/simbrief?${params.toString()}`);
      } else {
        fetchDispatchData();
      }
    }
  };

  const buildSimbriefUrl = (leg: DispatchLeg) => {
    const baseUrl = 'https://dispatch.simbrief.com/options/custom';
    const params = new URLSearchParams({
      airline: 'AFL',
      fltnum: leg.route?.flight_number?.replace(/\D/g, '') || '1234',
      type: leg.aircraft?.type_code || 'A320',
      orig: leg.route?.departure_airport || 'UUEE',
      dest: leg.route?.arrival_airport || 'UUEE',
    });
    return `${baseUrl}?${params.toString()}`;
  };

  if (loading || isLoading) {
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

  const completedLegs = dispatchLegs.filter(leg => 
    leg.status === 'completed' || leg.pirep?.status === 'approved'
  ).length;
  const totalLegs = dispatchLegs.length;
  const progressPercent = totalLegs > 0 ? (completedLegs / totalLegs) * 100 : 0;
  const totalDistance = dispatchLegs.reduce((sum, leg) => sum + (leg.route?.distance_nm || 0), 0);
  const totalTime = dispatchLegs.reduce((sum, leg) => sum + (leg.route?.estimated_time_hrs || 0), 0);

  const getButtonForLeg = (leg: DispatchLeg, index: number) => {
    const previousLegReady = index === 0 || 
      dispatchLegs[index - 1]?.status === 'completed' || 
      dispatchLegs[index - 1]?.pirep?.status === 'approved' ||
      dispatchLegs[index - 1]?.pirep?.status === 'pending';
    
    if (leg.pirep) {
      if (leg.pirep.status === 'rejected') {
        return (
          <Button 
            size="sm"
            variant="destructive"
            onClick={() => navigate(`/pirep?leg=${leg.id}`)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Re-File PIREP
          </Button>
        );
      }
      if (leg.pirep.status === 'pending') {
        return (
          <Button size="sm" variant="secondary" disabled className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Awaiting Review
          </Button>
        );
      }
      if (leg.pirep.status === 'approved') {
        return null;
      }
    }

    switch (leg.status) {
      case 'assigned':
        if (!previousLegReady) {
          return (
            <Button size="sm" variant="secondary" disabled className="gap-2">
              <Lock className="h-4 w-4" />
              Locked
            </Button>
          );
        }
        return (
          <Button 
            size="sm"
            onClick={() => dispatchFlight(leg.id)}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Dispatch
          </Button>
        );
      case 'dispatched':
        return (
          <Button 
            size="sm"
            onClick={() => navigate(`/pirep?leg=${leg.id}`)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            File PIREP
          </Button>
        );
      case 'awaiting_approval':
        return (
          <Button size="sm" variant="secondary" disabled className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Awaiting Approval
          </Button>
        );
      case 'completed':
        return null;
      default:
        return null;
    }
  };

  const getLegStatus = (leg: DispatchLeg) => {
    if (leg.pirep) {
      if (leg.pirep.status === 'rejected') return 'rejected';
      if (leg.pirep.status === 'pending') return 'awaiting_approval';
      if (leg.pirep.status === 'approved') return 'completed';
    }
    return leg.status;
  };

  // No dispatch legs and no active request
  if (dispatchLegs.length === 0) {
    return (
      <DashboardLayout>
        <SectionCard 
          title="Flight Dispatch" 
          icon={<Plane className="h-5 w-5 text-muted-foreground" />}
        >
          <div className="text-center py-12">
            {!careerRequest && (
              <>
                <Plane className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2 text-card-foreground">No Active Dispatch</h3>
                <p className="text-muted-foreground mb-6">
                  Choose your departure base and routing preference, then request a vCAREER assignment.
                </p>

                {/* Departure Base & Routing Rule Selection */}
                <div className="max-w-md mx-auto space-y-4 mb-6 text-left">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Departure Base
                    </Label>
                    <Select value={selectedBase} onValueChange={setSelectedBase}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select departure base" />
                      </SelectTrigger>
                      <SelectContent>
                        {departureBases.map((b) => (
                          <SelectItem key={b.icao_code} value={b.icao_code}>
                            {b.icao_code} — {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Routing Rule</Label>
                    <Select value={routingRule} onValueChange={setRoutingRule}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="return_to_base">Return to Base</SelectItem>
                        <SelectItem value="any_destination">Any Destination</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={requestCareerAuto} disabled={isRequesting || !selectedBase} className="gap-2">
                  <Send className="h-4 w-4" />
                  {isRequesting ? 'Requesting...' : 'Request vCAREER'}
                </Button>
              </>
            )}
            
            {careerRequest?.status === 'pending' && (
              <>
                <AlertCircle className="h-16 w-16 mx-auto text-warning mb-4" />
                <h3 className="text-lg font-medium mb-2 text-card-foreground">Request Pending</h3>
                <p className="text-muted-foreground">
                  Your career request is being reviewed by an admin. Please wait for approval.
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Requested: {new Date(careerRequest.requested_at).toLocaleString('ru-RU')}
                </p>
              </>
            )}

            {careerRequest?.status === 'approved' && (
              <>
                <AlertCircle className="h-16 w-16 mx-auto text-success mb-4" />
                <h3 className="text-lg font-medium mb-2 text-card-foreground">Request Approved!</h3>
                <p className="text-muted-foreground mb-4">
                  Your career has been assigned. Refreshing...
                </p>
                <Button onClick={fetchDispatchData} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </>
            )}
          </div>
        </SectionCard>
      </DashboardLayout>
    );
  }

  const firstLeg = dispatchLegs[0];
  const aircraftInfo = firstLeg?.aircraft;

  return (
    <DashboardLayout>
      <SectionCard className="mb-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-card-foreground">
              {aircraftInfo?.type_code || 'A320'} • {firstLeg?.tail_number || 'RA-XXX'} • {totalLegs} Legs
              <StatusBadge status="active" />
            </h2>
            <p className="text-muted-foreground text-sm">
              Progress: {completedLegs}/{totalLegs} legs completed
            </p>
          </div>
          <div className="text-right">
            <span className="text-primary font-bold">{Math.round(progressPercent)}% Complete</span>
          </div>
        </div>
        
        <Progress value={progressPercent} className="h-2 mb-4" />

        {progressPercent === 100 && (
          <div className="mb-6 p-4 bg-success/10 border border-success/30 rounded-xl text-center">
            <p className="text-success font-bold mb-3">🎉 Congratulations! You've completed all legs!</p>
            <Button 
              onClick={requestAnotherCareer}
              disabled={isRequesting}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {isRequesting ? 'Requesting...' : 'Request Another vCAREER'}
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {dispatchLegs.map((leg, index) => (
            <div 
              key={leg.id}
              className="p-4 bg-secondary/50 rounded-xl border border-border"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-primary font-medium">LEG {leg.leg_number}</p>
                  <p className="text-lg font-bold text-card-foreground">
                    {leg.route?.flight_number} • {leg.route?.departure_airport} → {leg.route?.arrival_airport}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {leg.route?.distance_nm} NM • {leg.route?.estimated_time_hrs?.toFixed(2)} hrs flight time
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={getLegStatus(leg) as any} />
                  {(leg.status === 'dispatched' || leg.pirep?.status === 'pending') && (
                    <a
                      href={buildSimbriefUrl(leg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      SimBrief
                    </a>
                  )}
                  {getButtonForLeg(leg, index)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Distance</p>
            <p className="text-xl font-bold text-primary">{totalDistance} NM</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Time</p>
            <p className="text-xl font-bold text-primary">{totalTime.toFixed(2)} hrs</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Aircraft</p>
            <p className="text-xl font-bold text-primary">{aircraftInfo?.type_code || 'A320'}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Tail Number</p>
            <p className="text-xl font-bold text-primary">{firstLeg?.tail_number || 'RA-XXX'}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono">
            Sector ID: {firstLeg?.dispatch_group_id || 'N/A'}
          </p>
        </div>
      </SectionCard>
    </DashboardLayout>
  );
}
