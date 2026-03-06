import { useMemo, useState } from 'react';
import { OFPNavlogFix } from '@/hooks/useSimBriefOFP';

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

    // Build cumulative distance and parse altitude
    let cumDist = 0;
    const wps: WaypointData[] = [];

    for (let i = 0; i < navlog.length; i++) {
      const fix = navlog[i];
      const legDist = parseFloat(fix.distance) || 0;
      // distance in navlog is cumulative distance from origin for that fix
      // but sometimes it's leg distance - let's check if values are ascending
      const alt = parseInt(fix.altitude_feet) || 0;
      
      wps.push({
        ident: fix.ident,
        distFromOrigin: legDist, // SimBrief distance is cumulative from origin
        altitude: alt,
        windDir: parseInt(fix.wind_dir) || 0,
        windSpeed: parseInt(fix.wind_spd) || 0,
        track: parseFloat(fix.track_true) || parseFloat(fix.track_mag) || 0,
      });
    }

    // Determine if distance values are cumulative or per-leg
    // If last value is larger than sum of middle values, it's cumulative
    const lastDist = wps[wps.length - 1]?.distFromOrigin || 0;
    const secondDist = wps.length > 2 ? wps[1]?.distFromOrigin || 0 : 0;
    
    // Check if distances are monotonically increasing (cumulative)
    let isCumulative = true;
    for (let i = 1; i < wps.length; i++) {
      if (wps[i].distFromOrigin < wps[i - 1].distFromOrigin - 1) {
        isCumulative = false;
        break;
      }
    }

    if (!isCumulative) {
      // Convert leg distances to cumulative
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
      <div className="rounded-xl p-6 text-center text-sm text-muted-foreground" style={{
        background: 'linear-gradient(180deg, #0c1929 0%, #0f2137 50%, #0a1525 100%)',
      }}>
        No navlog data available for winds profile.
      </div>
    );
  }

  // SVG dimensions
  const width = 960;
  const height = 300;
  const pad = { top: 30, right: 30, bottom: 40, left: 55 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const x = (d: number) => pad.left + (d / totalDistance) * cw;
  const y = (alt: number) => pad.top + ch - (alt / maxAlt) * ch;

  // Build the path
  const pathD = waypoints
    .map((wp, i) => `${i === 0 ? 'M' : 'L'}${x(wp.distFromOrigin).toFixed(1)},${y(wp.altitude).toFixed(1)}`)
    .join(' ');

  // Y-axis labels
  const yLabels: { label: string; alt: number }[] = [];
  for (let a = 0; a <= maxAlt; a += 10000) {
    yLabels.push({ label: a === 0 ? 'GND' : `FL${a / 100}`, alt: a });
  }

  // Pick a subset of waypoints to label (every Nth + first + last)
  const labelStep = Math.max(1, Math.floor(waypoints.length / 12));
  const labeledIndices = new Set<number>();
  labeledIndices.add(0);
  labeledIndices.add(waypoints.length - 1);
  for (let i = 0; i < waypoints.length; i += labelStep) labeledIndices.add(i);

  // Wind arrows for waypoints with wind > 5kt, spaced out
  const windStep = Math.max(1, Math.floor(waypoints.length / 20));
  const windWaypoints = waypoints.filter((_, i) => i % windStep === 0 && waypoints[i].windSpeed >= 5);

  return (
    <div className="relative overflow-hidden rounded-xl" style={{
      background: 'linear-gradient(180deg, #0c1929 0%, #0f2137 50%, #0a1525 100%)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.03)'
    }}>
      {/* Header */}
      <div className="h-8 flex items-center px-4" style={{
        background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.12) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(6, 182, 212, 0.15)'
      }}>
        <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-cyan-400/80">
          VERTICAL PROFILE &amp; EN-ROUTE WINDS
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="profileFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
          <filter id="glow2">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {yLabels.map(({ alt }) => (
          <line key={alt} x1={pad.left} y1={y(alt)} x2={width - pad.right} y2={y(alt)}
            stroke="rgba(100,150,200,0.08)" strokeWidth="1" strokeDasharray="3 4" />
        ))}

        {/* Y-axis labels */}
        {yLabels.map(({ label, alt }) => (
          <text key={alt} x={pad.left - 8} y={y(alt)} textAnchor="end" dominantBaseline="middle"
            className="text-[9px] fill-slate-500 font-mono">{label}</text>
        ))}

        {/* X-axis distance labels */}
        <text x={pad.left} y={height - 8} textAnchor="start" className="text-[9px] fill-slate-500 font-mono">0 NM</text>
        <text x={width - pad.right} y={height - 8} textAnchor="end" className="text-[9px] fill-slate-500 font-mono">
          {Math.round(totalDistance)} NM
        </text>

        {/* Filled area under profile */}
        <path
          d={`${pathD} L${x(waypoints[waypoints.length - 1].distFromOrigin).toFixed(1)},${y(0).toFixed(1)} L${x(waypoints[0].distFromOrigin).toFixed(1)},${y(0).toFixed(1)} Z`}
          fill="url(#profileFill)"
        />

        {/* Profile line */}
        <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="2" filter="url(#glow2)" />

        {/* Waypoint dots & labels */}
        {waypoints.map((wp, i) => {
          const cx = x(wp.distFromOrigin);
          const cy = y(wp.altitude);
          const showLabel = labeledIndices.has(i);
          return (
            <g key={i} className="cursor-pointer"
              onMouseEnter={() => setHoveredWp(wp)} onMouseLeave={() => setHoveredWp(null)}>
              <circle cx={cx} cy={cy} r={showLabel ? 3.5 : 2} fill="#06b6d4" opacity={showLabel ? 1 : 0.5} />
              {showLabel && (
                <text x={cx} y={cy + 12} textAnchor="middle" className="text-[7px] fill-slate-400 font-mono">
                  {wp.ident}
                </text>
              )}
            </g>
          );
        })}

        {/* Wind arrows */}
        {windWaypoints.map((wp, i) => {
          const cx = x(wp.distFromOrigin);
          const cy = y(wp.altitude) - 18;
          const { headwind, crosswind } = calculateWindComponent(wp.windDir, wp.windSpeed, wp.track);
          const absCross = Math.abs(crosswind);
          let color = '#22c55e'; // tailwind
          if (absCross > Math.abs(headwind) * 0.6) color = '#eab308'; // crosswind
          else if (headwind >= 0) color = '#22c55e'; // headwind (good)
          else color = '#ef4444'; // tailwind (red = against you... actually headwind is bad)
          
          // Convention: positive headwind = wind hitting you from front = slows you down = red
          // negative headwind = tailwind = speeds you up = green
          if (headwind > 0) color = '#ef4444'; // headwind
          else color = '#22c55e'; // tailwind
          if (absCross > Math.abs(headwind) * 0.6) color = '#eab308';

          return (
            <g key={`w${i}`} className="cursor-pointer"
              onMouseEnter={() => setHoveredWp(wp)} onMouseLeave={() => setHoveredWp(null)}>
              <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
              <polygon points={`${cx + 8},${cy} ${cx + 4},${cy - 2.5} ${cx + 4},${cy + 2.5}`} fill={color} />
              <text x={cx} y={cy - 5} textAnchor="middle" className="text-[7px] font-bold font-mono" fill={color}>
                {wp.windSpeed}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex justify-center pb-2">
        <div className="flex items-center gap-4 px-4 py-1 rounded-full" style={{
          background: 'rgba(15,30,50,0.7)', border: '1px solid rgba(100,150,200,0.12)'
        }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[9px] text-slate-400">HEADWIND</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[9px] text-slate-400">TAILWIND</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-[9px] text-slate-400">CROSSWIND</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredWp && hoveredWp.windSpeed > 0 && (() => {
        const { headwind, crosswind } = calculateWindComponent(hoveredWp.windDir, hoveredWp.windSpeed, hoveredWp.track);
        return (
          <div className="absolute z-20 px-3 py-2 rounded-lg text-[10px] pointer-events-none" style={{
            left: '50%', top: '40%', transform: 'translate(-50%, -50%)',
            background: 'rgba(10,25,45,0.95)', border: '1px solid rgba(6,182,212,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}>
            <div className="text-cyan-400 font-semibold mb-1">{hoveredWp.ident}</div>
            <div className="text-slate-400">Alt: <span className="text-slate-200">FL{Math.round(hoveredWp.altitude / 100)}</span></div>
            <div className="text-slate-400">Wind: <span className="text-slate-200">{hoveredWp.windDir}°/{hoveredWp.windSpeed}kt</span></div>
            <div className={headwind > 0 ? 'text-red-400' : 'text-green-400'}>
              {headwind > 0 ? `Headwind: ${headwind}kt` : `Tailwind: ${Math.abs(headwind)}kt`}
            </div>
            {Math.abs(crosswind) > 5 && (
              <div className="text-yellow-400">Crosswind: {Math.abs(crosswind)}kt</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
