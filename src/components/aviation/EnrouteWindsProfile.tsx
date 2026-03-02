import { useMemo, useState } from 'react';
import { OFPNavlogFix } from '@/hooks/useSimBriefOFP';

interface EnrouteWindsProfileProps {
  navlog: OFPNavlogFix[];
  cruiseAltitude?: number;
}

interface WaypointData {
  ident: string;
  distance: number;
  altitude: number;
  windDir: number;
  windSpeed: number;
  track: number;
}

interface TooltipData {
  ident: string;
  altitude: number;
  windDir: number;
  windSpeed: number;
  component: number;
  componentType: 'headwind' | 'tailwind' | 'crosswind';
  crosswind: number;
}

const CRUISE_LEVEL = 340;

export function EnrouteWindsProfile({ navlog, cruiseAltitude = 350 }: EnrouteWindsProfileProps) {
  const [hoveredWaypoint, setHoveredWaypoint] = useState<WaypointData | null>(null);

  const { totalDistance, waypoints, climbWaypoints, cruiseWaypoints, descentWaypoints } = useMemo(() => {
    const filtered = navlog.filter(fix => {
      const alt = parseInt(fix.altitude_feet) || 0;
      return alt >= 1000;
    });

    const wpData = filtered.map(fix => ({
      ident: fix.ident,
      distance: parseFloat(fix.distance) || 0,
      altitude: Math.round((parseInt(fix.altitude_feet) || 0) / 100) * 100,
      windDir: parseInt(fix.wind_dir) || 0,
      windSpeed: parseInt(fix.wind_spd) || 0,
      track: parseFloat(fix.track_true) || parseFloat(fix.track_mag) || 0,
    }));

    const last = wpData[wpData.length - 1];
    const total = last ? last.distance : 0;

    const climb = wpData.filter(w => w.altitude < CRUISE_LEVEL - 5000);
    const cruise = wpData.filter(w => w.altitude >= CRUISE_LEVEL - 5000 && w.altitude <= CRUISE_LEVEL + 2000);
    const descent = wpData.filter(w => w.altitude < CRUISE_LEVEL - 5000 && w.distance > total * 0.7);

    return { totalDistance: total, waypoints: wpData, climbWaypoints: climb, cruiseWaypoints: cruise, descentWaypoints: descent };
  }, [navlog]);

  const calculateWindComponent = (windDir: number, windSpeed: number, track: number): { headwind: number; crosswind: number } => {
    if (windSpeed === 0) return { headwind: 0, crosswind: 0 };
    let relativeAngle = windDir - track;
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;
    const radians = (relativeAngle * Math.PI) / 180;
    const headwind = Math.round(windSpeed * Math.cos(radians));
    const crosswind = Math.round(windSpeed * Math.sin(radians));
    return { headwind, crosswind };
  };

  const getWindColor = (headwind: number, crosswind: number): string => {
    const absCrosswind = Math.abs(crosswind);
    if (absCrosswind > Math.abs(headwind) * 0.6) return 'yellow';
    return headwind >= 0 ? 'green' : 'red';
  };

  const width = 1000;
  const height = 280;
  const padding = { top: 40, right: 40, bottom: 35, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const scaleX = (dist: number) => padding.left + (dist / totalDistance) * chartWidth;
  const scaleY = (alt: number) => padding.top + chartHeight - (alt / 400) * chartHeight;

  const climbStartX = padding.left;
  const climbEndX = scaleX(climbWaypoints[climbWaypoints.length - 1]?.distance || totalDistance * 0.15);
  const cruiseStartX = climbEndX;
  const cruiseEndX = scaleX(totalDistance * 0.75);
  const descentStartX = cruiseEndX;
  const descentEndX = width - padding.right;

  const cruiseY = scaleY(CRUISE_LEVEL);

  return (
    <div className="relative overflow-hidden rounded-xl" style={{
      background: 'linear-gradient(180deg, #0c1929 0%, #0f2137 50%, #0a1525 100%)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.03)'
    }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-8 flex items-center px-4" style={{
        background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.12) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(6, 182, 212, 0.15)'
      }}>
        <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-cyan-400/80">
          EN-ROUTE WINDS PROFILE
        </span>
      </div>

      <svg width={width} height={height} className="mt-8">
        <defs>
          <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="arrowGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 100, 200, 300, 400].map(alt => (
          <line
            key={alt}
            x1={padding.left}
            y1={scaleY(alt)}
            x2={width - padding.right}
            y2={scaleY(alt)}
            stroke="rgba(100, 150, 200, 0.08)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}

        {/* Y-axis labels */}
        {[
          { label: 'GND', alt: 0 },
          { label: 'FL100', alt: 10000 },
          { label: 'FL200', alt: 20000 },
          { label: 'FL300', alt: 30000 },
          { label: 'FL400', alt: 40000 }
        ].map(item => (
          <text
            key={item.alt}
            x={padding.left - 8}
            y={scaleY(item.alt / 100)}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-[9px] fill-slate-500 font-mono"
          >
            {item.label}
          </text>
        ))}

        {/* X-axis labels */}
        <text
          x={padding.left}
          y={height - 8}
          textAnchor="start"
          className="text-[9px] fill-slate-500 font-mono"
        >
          0 NM
        </text>
        <text
          x={width - padding.right}
          y={height - 8}
          textAnchor="end"
          className="text-[9px] fill-slate-500 font-mono"
        >
          {Math.round(totalDistance)} NM
        </text>

        {/* Climb line - thin vertical cyan */}
        <line
          x1={climbStartX}
          y1={scaleY(0)}
          x2={climbStartX}
          y2={scaleY(CRUISE_LEVEL)}
          stroke="url(#cyanGlow)"
          strokeWidth="1.5"
          filter="url(#softGlow)"
        />

        {/* Descent line - thin vertical cyan */}
        <line
          x1={descentEndX}
          y1={scaleY(CRUISE_LEVEL)}
          x2={descentEndX}
          y2={scaleY(0)}
          stroke="url(#cyanGlow)"
          strokeWidth="1.5"
          filter="url(#softGlow)"
        />

        {/* Cruise band - horizontal line */}
        <line
          x1={cruiseStartX}
          y1={cruiseY}
          x2={cruiseEndX}
          y2={cruiseY}
          stroke="rgba(6, 182, 212, 0.25)"
          strokeWidth="1"
          strokeDasharray="6 4"
        />

        {/* Climb waypoints */}
        {climbWaypoints.filter((_, i) => i % 2 === 0).map((wp, idx) => {
          const x = scaleX(wp.distance);
          const y = scaleY(wp.altitude / 100);
          return (
            <g key={`climb-${idx}`} className="cursor-pointer" onMouseEnter={() => setHoveredWaypoint(wp)} onMouseLeave={() => setHoveredWaypoint(null)}>
              <circle cx={x} cy={y} r="3" fill="rgba(6, 182, 212, 0.6)" filter="url(#softGlow)" />
            </g>
          );
        })}

        {/* Cruise waypoints - main waypoints */}
        {cruiseWaypoints.filter((wp, i) => i === 0 || i === cruiseWaypoints.length - 1 || wp.ident.length <= 5).map((wp, idx) => {
          const x = scaleX(wp.distance);
          const y = cruiseY;
          return (
            <g key={`cruise-${idx}`} className="cursor-pointer" onMouseEnter={() => setHoveredWaypoint(wp)} onMouseLeave={() => setHoveredWaypoint(null)}>
              <circle cx={x} cy={y} r="4" fill="#06b6d4" filter="url(#softGlow)" />
              <text x={x} y={y + 14} textAnchor="middle" className="text-[7px] fill-slate-400 font-mono">{wp.ident}</text>
            </g>
          );
        })}

        {/* Descent waypoints */}
        {descentWaypoints.filter((_, i) => i % 2 === 0).map((wp, idx) => {
          const x = scaleX(wp.distance);
          const y = scaleY(wp.altitude / 100);
          return (
            <g key={`descent-${idx}`} className="cursor-pointer" onMouseEnter={() => setHoveredWaypoint(wp)} onMouseLeave={() => setHoveredWaypoint(null)}>
              <circle cx={x} cy={y} r="3" fill="rgba(6, 182, 212, 0.6)" filter="url(#softGlow)" />
            </g>
          );
        })}

        {/* Destination marker */}
        <g className="cursor-pointer" onMouseEnter={() => setHoveredWaypoint(waypoints[waypoints.length - 1])} onMouseLeave={() => setHoveredWaypoint(null)}>
          <circle cx={descentEndX} cy={scaleY(0)} r="4" fill="#06b6d4" filter="url(#softGlow)" />
          <text x={descentEndX} y={scaleY(0) - 8} textAnchor="middle" className="text-[7px] fill-slate-400 font-mono">{waypoints[waypoints.length - 1]?.ident}</text>
        </g>

        {/* Wind arrows - only in cruise */}
        {cruiseWaypoints.slice(1, -1).filter((_, i) => i % 2 === 0).map((wp, idx) => {
          const x = scaleX(wp.distance);
          const y = cruiseY - 20;
          const { headwind, crosswind } = calculateWindComponent(wp.windDir, wp.windSpeed, wp.track);
          const color = getWindColor(headwind, crosswind);
          const colorMap: Record<string, string> = { green: '#22c55e', red: '#ef4444', yellow: '#eab308' };

          if (wp.windSpeed < 5) return null;

          return (
            <g key={`wind-${idx}`} className="cursor-pointer" onMouseEnter={() => setHoveredWaypoint(wp)} onMouseLeave={() => setHoveredWaypoint(null)}>
              <line x1={x - 10} y1={y} x2={x + 10} y2={y} stroke={colorMap[color]} strokeWidth="1.5" strokeLinecap="round" filter="url(#arrowGlow)" />
              <polygon points={`${x+10},${y} ${x+5},${y-3} ${x+5},${y+3}`} fill={colorMap[color]} filter="url(#arrowGlow)" />
              <text x={x} y={y - 6} textAnchor="middle" className="text-[7px] font-bold font-mono" fill={colorMap[color]}>{wp.windSpeed}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-1.5 rounded-full" style={{
        background: 'rgba(15, 30, 50, 0.7)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(100, 150, 200, 0.12)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[9px] text-slate-400 font-medium">HEADWIND</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[9px] text-slate-400 font-medium">TAILWIND</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-[9px] text-slate-400 font-medium">CROSSWIND</span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredWaypoint && hoveredWaypoint.windSpeed > 0 && (
        <div className="absolute z-20 px-3 py-2 rounded-lg text-[10px]" style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(10, 25, 45, 0.95)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(6, 182, 212, 0.1)'
        }}>
          <div className="text-cyan-400 font-semibold mb-1">{hoveredWaypoint.ident}</div>
          <div className="text-slate-400">Alt: <span className="text-slate-200">FL{Math.round(hoveredWaypoint.altitude / 100)}</span></div>
          <div className="text-slate-400">Wind: <span className="text-slate-200">{hoveredWaypoint.windDir}° / {hoveredWaypoint.windSpeed}kt</span></div>
          {(() => {
            const { headwind, crosswind } = calculateWindComponent(hoveredWaypoint.windDir, hoveredWaypoint.windSpeed, hoveredWaypoint.track);
            const color = getWindColor(headwind, crosswind);
            const colorMap: Record<string, string> = { green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400' };
            return (
              <div className="text-slate-400">
                {Math.abs(crosswind) > Math.abs(headwind) * 0.6 ? (
                  <span className={colorMap.yellow}>Crosswind: {crosswind}kt</span>
                ) : (
                  <span className={headwind >= 0 ? colorMap.green : colorMap.red}>
                    {headwind >= 0 ? `Headwind: ${headwind}kt` : `Tailwind: ${Math.abs(headwind)}kt`}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
