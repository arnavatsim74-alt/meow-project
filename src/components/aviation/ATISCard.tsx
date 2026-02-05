import { Radio, RefreshCw, AlertCircle, Wifi, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteFlightATIS } from '@/hooks/useInfiniteFlightATIS';

interface ATISCardProps {
  icao: string;
  label: 'Departure' | 'Arrival';
}

export function ATISCard({ icao, label }: ATISCardProps) {
  const { data, loading, error, refetch } = useInfiniteFlightATIS(icao);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="h-5 w-5 text-primary animate-pulse" />
          <span className="font-medium text-card-foreground">{label} ATIS - {icao}</span>
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive" />
            <span className="font-medium text-card-foreground">{label} ATIS - {icao}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // ATIS is now returned as a string directly, not nested in an object
  const atisText = data?.atis && typeof data.atis === 'string' 
    ? data.atis.trim() 
    : null;
  
  const hasATIS = atisText && atisText.length > 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className={`h-5 w-5 ${hasATIS ? 'text-success' : 'text-muted-foreground'}`} />
          <span className="font-medium text-card-foreground">{label} ATIS - {icao}</span>
          {hasATIS && (
            <span className="bg-success/20 text-success text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <Wifi className="h-3 w-3" />
              LIVE
            </span>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={refetch}
          className="hover:bg-primary/10"
          title="Refresh ATIS"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {hasATIS ? (
        <div className="space-y-3">
          {/* ATIS Message */}
          <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm text-slate-100 leading-relaxed whitespace-pre-wrap border border-slate-700/50">
            {atisText}
          </div>
          
          {/* Session and Airport Info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            {data?.session?.name && (
              <span className="flex items-center gap-1">
                <Server className="h-3 w-3" />
                <span className="font-medium">Server:</span>
                <span className="text-slate-300">{data.session.name}</span>
              </span>
            )}
            {data?.airport && (
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3" />
                <span className="font-medium">Airport:</span>
                <span className="text-slate-300">{data.airport}</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Radio className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground font-medium mb-1">
            {data?.message || `No ATIS available for ${icao}`}
          </p>
          
          {data?.sessions && data.sessions.length > 0 && (
            <div className="mt-3 p-2 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground/80 mb-1">
                Active Infinite Flight servers:
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {data.sessions.map(s => s.name).join(', ')}
              </p>
            </div>
          )}
          
          {data?.error && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-destructive/80">
              <AlertCircle className="h-3 w-3" />
              <span>{data.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
