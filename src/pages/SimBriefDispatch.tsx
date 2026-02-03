import { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Plane, ArrowLeft, Settings, Loader2, Send, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SimBriefFormData, storePendingOFP, openSimBriefPopup, monitorSimBriefPopup, clearPendingOFP } from '@/lib/simbrief';

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

export default function SimBriefDispatch() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [generating, setGenerating] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  // Form state with URL params as initial values
  const [formData, setFormData] = useState<SimBriefFormData>({
    orig: searchParams.get('orig') || '',
    dest: searchParams.get('dest') || '',
    type: searchParams.get('type') || 'A320',
    airline: 'AFL',
    fltnum: searchParams.get('fltnum') || '',
    reg: '',
    units: 'KGS',
    contpct: 'auto',
    resvrule: '45',
    navlog: '1',
    etops: '0',
    stepclimbs: '1',
    tlr: '1',
    notams: '1',
    firnot: '0',
    maps: 'detail',
    planformat: 'lido',
  });

  const legId = searchParams.get('legId') || '';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
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

  const handleInputChange = (field: keyof SimBriefFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field: keyof SimBriefFormData, checked: boolean) => {
    setFormData(prev => ({ ...prev, [field]: checked ? '1' : '0' }));
  };

  const handleGenerateOFP = async () => {
    if (!formData.orig || !formData.dest) {
      toast({
        title: 'Missing Fields',
        description: 'Please enter origin and destination airports',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    clearPendingOFP();

    try {
      // Output page is the callback URL - SimBrief will redirect the popup here with ofp_id
      const outputPage = `${window.location.origin}/simbrief/callback`;
      
      // Open SimBrief popup
      const { popup, timestamp } = await openSimBriefPopup(formData, outputPage);
      
      if (!popup) {
        throw new Error('Failed to open SimBrief popup. Please disable your pop-up blocker.');
      }
      
      popupRef.current = popup;
      
      // Store pending data for retrieval after redirect
      storePendingOFP({
        formData,
        timestamp,
        dispatchLegId: legId || undefined,
      });
      
      toast({
        title: 'SimBrief Opened',
        description: 'Complete the flight plan in the popup. You will be redirected when done.',
      });
      
      // Monitor popup - when it closes, redirect to OFP Viewer with ofp_id
      cleanupRef.current = monitorSimBriefPopup(
        popup,
        formData,
        timestamp,
        (ofpId) => {
          setGenerating(false);
          // Navigate to OFP Viewer with the ofp_id
          navigate(`/ofp?ofp_id=${ofpId}${legId ? `&legId=${legId}` : ''}`);
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
      
    } catch (error) {
      setGenerating(false);
      console.error('Error generating OFP:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate flight plan',
        variant: 'destructive',
      });
    }
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
              <Plane className="h-5 w-5" />
              OFP Generator
            </h1>
            <p className="text-sm text-muted-foreground">
              SimBrief Flight Planning
            </p>
          </div>
        </div>
      </div>

      {generating && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-warning" />
            <div>
              <p className="font-semibold text-foreground">Generating Flight Plan...</p>
              <p className="text-sm text-muted-foreground">
                Complete the plan in the SimBrief popup. This page will update automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Flight Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-1 h-6 bg-warning rounded-full" />
              Flight Details
            </CardTitle>
            <CardDescription>
              Enter your flight information. SimBrief will calculate the optimal route.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orig">Origin (ICAO) *</Label>
                <Input
                  id="orig"
                  placeholder="e.g., UUEE"
                  value={formData.orig}
                  onChange={(e) => handleInputChange('orig', e.target.value.toUpperCase())}
                  maxLength={4}
                  className="uppercase"
                  disabled={generating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dest">Destination (ICAO) *</Label>
                <Input
                  id="dest"
                  placeholder="e.g., LFPG"
                  value={formData.dest}
                  onChange={(e) => handleInputChange('dest', e.target.value.toUpperCase())}
                  maxLength={4}
                  className="uppercase"
                  disabled={generating}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Aircraft Type *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => handleInputChange('type', v)}
                  disabled={generating}
                >
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
                <Label htmlFor="airline">Airline Code</Label>
                <Input
                  id="airline"
                  placeholder="e.g., AFL"
                  value={formData.airline}
                  onChange={(e) => handleInputChange('airline', e.target.value.toUpperCase())}
                  maxLength={3}
                  className="uppercase"
                  disabled={generating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fltnum">Flight Number</Label>
                <Input
                  id="fltnum"
                  placeholder="e.g., 1234"
                  value={formData.fltnum}
                  onChange={(e) => handleInputChange('fltnum', e.target.value)}
                  disabled={generating}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg">Registration</Label>
                <Input
                  id="reg"
                  placeholder="e.g., VP-BYT"
                  value={formData.reg}
                  onChange={(e) => handleInputChange('reg', e.target.value.toUpperCase())}
                  className="uppercase"
                  disabled={generating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo (kg)</Label>
                <Input
                  id="cargo"
                  type="number"
                  placeholder="e.g., 5000"
                  value={formData.cargo || ''}
                  onChange={(e) => handleInputChange('cargo', e.target.value)}
                  disabled={generating}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="stepclimbs"
                checked={formData.stepclimbs === '1'}
                onCheckedChange={(c) => handleCheckboxChange('stepclimbs', !!c)}
                disabled={generating}
              />
              <Label htmlFor="stepclimbs" className="text-sm">Step Climbs</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notams"
                checked={formData.notams === '1'}
                onCheckedChange={(c) => handleCheckboxChange('notams', !!c)}
                disabled={generating}
              />
              <Label htmlFor="notams" className="text-sm">Include NOTAMs</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tlr"
                checked={formData.tlr === '1'}
                onCheckedChange={(c) => handleCheckboxChange('tlr', !!c)}
                disabled={generating}
              />
              <Label htmlFor="tlr" className="text-sm">Takeoff/Landing Report</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="etops"
                checked={formData.etops === '1'}
                onCheckedChange={(c) => handleCheckboxChange('etops', !!c)}
                disabled={generating}
              />
              <Label htmlFor="etops" className="text-sm">ETOPS</Label>
            </div>

            <div className="space-y-2 pt-4">
              <Label htmlFor="units">Units</Label>
              <Select 
                value={formData.units} 
                onValueChange={(v) => handleInputChange('units', v)}
                disabled={generating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KGS">Kilograms</SelectItem>
                  <SelectItem value="LBS">Pounds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="planformat">Plan Format</Label>
              <Select 
                value={formData.planformat} 
                onValueChange={(v) => handleInputChange('planformat', v)}
                disabled={generating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lido">LIDO</SelectItem>
                  <SelectItem value="aal">American Airlines</SelectItem>
                  <SelectItem value="aca">Air Canada</SelectItem>
                  <SelectItem value="baw">British Airways</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Button */}
      <div className="mt-6">
        <Button
          size="lg"
          onClick={handleGenerateOFP}
          disabled={!formData.orig || !formData.dest || generating}
          className="w-full md:w-auto gap-2"
        >
          {generating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {generating ? 'Generating...' : 'Generate Flight Plan'}
        </Button>
      </div>

      {!formData.orig && !formData.dest && (
        <div className="mt-6 bg-muted/50 border border-border rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground">How it works</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your origin and destination airports, select your aircraft type, and click Generate.
                A SimBrief popup will open where you can customize your flight plan. Once complete, you'll
                be automatically redirected to view your OFP.
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
