import { Navigate, useNavigate } from 'react-router-dom';
import { Plane, ArrowLeft, Send } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

/**
 * Flight Briefing Page
 * 
 * This page redirects users to generate an OFP using SimBrief.
 * The actual OFP generation and viewing is handled by:
 * - /simbrief (OFP Generator) - Generate flight plan via SimBrief popup
 * - /ofp (OFP Viewer) - View generated flight plan
 */
export default function FlightBriefing() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/dispatch')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dispatch
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Flight Briefing
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate your Operational Flight Plan
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Plane className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Generate Flight Plan</CardTitle>
            <CardDescription className="text-base">
              Use our SimBrief integration to create a detailed Operational Flight Plan (OFP) 
              with weather data, fuel calculations, and navigation information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">What's included in your OFP:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                  Flight route with waypoints and airways
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                  Fuel calculations and planning
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                  Weight and balance data
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                  Real-time weather (METAR/TAF)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                  Navigation log with times and altitudes
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                  Route maps and charts
                </li>
              </ul>
            </div>

            <Button 
              size="lg" 
              className="w-full gap-2" 
              onClick={() => navigate('/simbrief')}
            >
              <Send className="h-5 w-5" />
              Open OFP Generator
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
