import { useMemo, useState } from 'react';
import { Wind } from 'lucide-react';
import { OFPNavlogFix } from '@/hooks/useSimBriefOFP';
import { SectionCard } from '@/components/ui/section-card';

interface EnrouteWindsProfileProps {
  navlog: OFPNavlogFix[];
  cruiseAltitude?: number;
}

interface WaypointData {
  ident: string;
  distFromOrigin: number;
  altitude: number;
  windDir: number;
  windSpeed: number;
  track: number;
}

export function EnrouteWindsProfile({ navlog, cruiseAltitude }: EnrouteWindsProfileProps) {
  const [hoveredWp, setHoveredWp] = useState<WaypointData | null>(null);

  const { waypoints, totalDistance, maxAlt } = useMemo(() => {
    if (!navlog || navlog.length === 0) return { waypoints: [], totalDistance: 0, maxAlt: 40000 };

    const wps: WaypointData[] = [];

    for (let i = 0; i < navlog.length; i++) {
      const fix = navlog[i];
      const legDist = parseFloat(fix.distance) || 0;
      const alt = parseInt(fix.altitude_feet) || 0;

      wps.push({
        ident: fix.ident,
        distFromOrigin: legDist,
        altitude: alt,
        windDir: parseInt(fix.wind_dir) || 0,
        windSpeed: parseInt(fix.wind_spd) || 0,
        track: parseFloat(fix.track_true) || parseFloat(fix.track_mag) || 0,
      });
    }

    let isCumulative = true;
    for (let i = 1; i < wps.length; i++) {
      if (wps[i].distFromOrigin < wps[i - 1].distFromOrigin - 1) {
        isCumulative = false;
        break;
      }
    }

    if (!isCumulative) {
      let running = 0;
      for (const wp of wps) {
        running += wp.distFromOrigin;
        wp.distFromOrigin = running;
      }
    }

    const total = wps[wps.length - 1]?.distFromOrigin || 1;
    const mAlt = Math.max(...wps.map(w => w.altitude), 35000);

    return { waypoints: wps, totalDistance: total, maxAlt: Math.ceil(mAlt / 5000) * 5000 };
  }, [navlog]);

  const calculateWindComponent = (windDir: number, windSpeed: number, track: number) => {
    if (windSpeed === 0) return { headwind: 0, crosswind: 0 };
    let relAngle = windDir - track;
    while (relAngle > 180) relAngle -= 360;
    while (relAngle < -180) relAngle += 360;
    const rad = (relAngle * Math.PI) / 180;
    return {
      headwind: Math.round(windSpeed * Math.cos(rad)),
      crosswind: Math.round(windSpeed * Math.sin(rad)),
    };
  };

  if (waypoints.length < 2) {
    return (
      <SectionCard title="Vertical Profile & En-Route Winds" icon={<Wind className="h-5 w-5 text-muted-foreground" />}>
        <p className="text-sm text-muted-foreground text-center py-4">No navlog data available.</p>
      </SectionCard>
    );
  }

  const width = 960;
  const height = 280;
  const pad = { top: 25, right: 30, bottom: 35, left: 55 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const x = (d: number) => pad.left + (d / totalDistance) * cw;
  const y = (alt: number) => pad.top + ch - (alt / maxAlt) * ch;

  const pathD = waypoints
    .map((wp, i) => `${i === 0 ? 'M' : 'L'}${x(wp.distFromOrigin).toFixed(1)},${y(wp.altitude).toFixed(1)}`)
    .join(' ');

  const yLabels: { label: string; alt: number }[] = [];
  for (let a = 0; a <= maxAlt; a += 10000) {
    yLabels.push({ label: a === 0 ? 'GND' : `FL${a / 100}`, alt: a });
  }

  const labelStep = Math.max(1, Math.floor(waypoints.length / 12));
  const labeledIndices = new Set<number>();
  labeledIndices.add(0);
  labeledIndices.add(waypoints.length - 1);
  for (let i = 0; i < waypoints.length; i += labelStep) labeledIndices.add(i);

  const windStep = Math.max(1, Math.floor(waypoints.length / 20));
  const windWaypoints = waypoints.filter((_, i) => i % windStep === 0 && waypoints[i].windSpeed >= 5);

  const getWindColor = (wp: WaypointData) => {
    const { headwind, crosswind } = calculateWindComponent(wp.windDir, wp.windSpeed, wp.track);
    const absCross = Math.abs(crosswind);
    if (absCross > Math.abs(headwind) * 0.6) return 'hsl(var(--warning))';
    if (headwind > 0) return 'hsl(var(--destructive))';
    return 'hsl(142, 71%, 45%)';
  };

  return (
    <SectionCard title="Vertical Profile & En-Route Winds" icon={<Wind className="h-5 w-5 text-muted-foreground" />}>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="profileFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yLabels.map(({ alt }) => (
            <line key={alt} x1={pad.left} y1={y(alt)} x2={width - pad.right} y2={y(alt)}
              stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5" />
          ))}

          {/* Y-axis labels */}
          {yLabels.map(({ label, alt }) => (
            <text key={alt} x={pad.left - 8} y={y(alt)} textAnchor="end" dominantBaseline="middle"
              fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="monospace">{label}</text>
          ))}

          {/* X-axis labels */}
          <text x={pad.left} y={height - 6} textAnchor="start"
            fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="monospace">0 NM</text>
          <text x={width - pad.right} y={height - 6} textAnchor="end"
            fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="monospace">{Math.round(totalDistance)} NM</text>

          {/* Filled area */}
          <path
            d={`${pathD} L${x(waypoints[waypoints.length - 1].distFromOrigin).toFixed(1)},${y(0).toFixed(1)} L${x(waypoints[0].distFromOrigin).toFixed(1)},${y(0).toFixed(1)} Z`}
            fill="url(#profileFill)"
          />

          {/* Profile line */}
          <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />

          {/* Waypoint dots & labels */}
          {waypoints.map((wp, i) => {
            const cx = x(wp.distFromOrigin);
            const cy = y(wp.altitude);
            const showLabel = labeledIndices.has(i);
            return (
              <g key={i} className="cursor-pointer"
                onMouseEnter={() => setHoveredWp(wp)} onMouseLeave={() => setHoveredWp(null)}>
                <circle cx={cx} cy={cy} r={showLabel ? 3 : 1.5}
                  fill="hsl(var(--primary))" opacity={showLabel ? 1 : 0.4} />
                {showLabel && (
                  <text x={cx} y={cy + 12} textAnchor="middle"
                    fill="hsl(var(--muted-foreground))" fontSize="7" fontFamily="monospace">
                    {wp.ident}
                  </text>
                )}
              </g>
            );
          })}

          {/* Wind arrows */}
          {windWaypoints.map((wp, i) => {
            const cx = x(wp.distFromOrigin);
            const cy = y(wp.altitude) - 16;
            const color = getWindColor(wp);

            return (
              <g key={`w${i}`} className="cursor-pointer"
                onMouseEnter={() => setHoveredWp(wp)} onMouseLeave={() => setHoveredWp(null)}>
                <line x1={cx - 7} y1={cy} x2={cx + 7} y2={cy} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                <polygon points={`${cx + 7},${cy} ${cx + 3.5},${cy - 2} ${cx + 3.5},${cy + 2}`} fill={color} />
                <text x={cx} y={cy - 5} textAnchor="middle" fontSize="7" fontWeight="bold" fontFamily="monospace" fill={color}>
                  {wp.windSpeed}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex justify-center mt-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <span>Headwind</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(142, 71%, 45%)' }} />
              <span>Tailwind</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Crosswind</span>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredWp && hoveredWp.windSpeed > 0 && (() => {
          const { headwind, crosswind } = calculateWindComponent(hoveredWp.windDir, hoveredWp.windSpeed, hoveredWp.track);
          return (
            <div className="absolute z-20 px-3 py-2 rounded-lg text-xs pointer-events-none bg-popover border border-border shadow-lg"
              style={{ left: '50%', top: '40%', transform: 'translate(-50%, -50%)' }}>
              <div className="font-semibold text-primary mb-1">{hoveredWp.ident}</div>
              <div className="text-muted-foreground">Alt: <span className="text-foreground">FL{Math.round(hoveredWp.altitude / 100)}</span></div>
              <div className="text-muted-foreground">Wind: <span className="text-foreground">{hoveredWp.windDir}°/{hoveredWp.windSpeed}kt</span></div>
              <div className={headwind > 0 ? 'text-destructive' : 'text-green-500'}>
                {headwind > 0 ? `Headwind: ${headwind}kt` : `Tailwind: ${Math.abs(headwind)}kt`}
              </div>
              {Math.abs(crosswind) > 5 && (
                <div className="text-yellow-500">Crosswind: {Math.abs(crosswind)}kt</div>
              )}
            </div>
          );
        })()}
      </div>
    </SectionCard>
  );
}
