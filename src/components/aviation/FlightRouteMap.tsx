 import { useEffect, useMemo } from 'react';
 import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
 import L from 'leaflet';
 import 'leaflet/dist/leaflet.css';
 import { OFPNavlogFix } from '@/hooks/useSimBriefOFP';
 
 interface FlightRouteMapProps {
   navlog: OFPNavlogFix[];
   origin: {
     icao_code: string;
     name: string;
     pos_lat: string;
     pos_long: string;
   };
   destination: {
     icao_code: string;
     name: string;
     pos_lat: string;
     pos_long: string;
   };
 }
 
 // Custom marker icons
 const departureIcon = L.divIcon({
   className: 'custom-marker',
   html: `<div style="
     width: 28px;
     height: 28px;
     background-color: #22c55e;
     border: 3px solid white;
     border-radius: 50%;
     box-shadow: 0 2px 6px rgba(0,0,0,0.4);
     display: flex;
     align-items: center;
     justify-content: center;
     color: white;
     font-weight: bold;
     font-size: 12px;
   ">D</div>`,
   iconSize: [28, 28],
   iconAnchor: [14, 14],
 });
 
 const arrivalIcon = L.divIcon({
   className: 'custom-marker',
   html: `<div style="
     width: 28px;
     height: 28px;
     background-color: #ef4444;
     border: 3px solid white;
     border-radius: 50%;
     box-shadow: 0 2px 6px rgba(0,0,0,0.4);
     display: flex;
     align-items: center;
     justify-content: center;
     color: white;
     font-weight: bold;
     font-size: 12px;
   ">A</div>`,
   iconSize: [28, 28],
   iconAnchor: [14, 14],
 });
 
 const waypointIcon = L.divIcon({
   className: 'custom-marker',
   html: `<div style="
     width: 10px;
     height: 10px;
     background-color: #38bdf8;
     border: 2px solid white;
     border-radius: 50%;
     box-shadow: 0 2px 4px rgba(0,0,0,0.3);
   "></div>`,
   iconSize: [10, 10],
   iconAnchor: [5, 5],
 });
 
 // Component to fit the map bounds to the route
 function FitBounds({ positions }: { positions: [number, number][] }) {
   const map = useMap();
   
   useEffect(() => {
     if (positions.length > 0) {
       const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
       map.fitBounds(bounds, { padding: [50, 50] });
     }
   }, [map, positions]);
   
   return null;
 }
 
 // Map Legend Component
 function MapLegend() {
   return (
     <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg border p-3 shadow-lg">
       <p className="text-xs font-semibold mb-2 text-foreground">Legend</p>
       <div className="space-y-1.5">
         <div className="flex items-center gap-2">
           <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow">D</div>
           <span className="text-xs text-muted-foreground">Departure</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow">A</div>
           <span className="text-xs text-muted-foreground">Arrival</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-2.5 h-2.5 rounded-full bg-sky-400 border border-white shadow ml-1"></div>
           <span className="text-xs text-muted-foreground">Waypoint</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-5 h-0.5 bg-sky-400 ml-0"></div>
           <span className="text-xs text-muted-foreground">Route</span>
         </div>
       </div>
     </div>
   );
 }
 
 export function FlightRouteMap({ navlog, origin, destination }: FlightRouteMapProps) {
   // Parse coordinates from navlog
   const waypoints = useMemo(() => {
     return navlog
       .filter(fix => fix.pos_lat && fix.pos_long)
       .map(fix => ({
         ...fix,
         lat: parseFloat(fix.pos_lat),
         lng: parseFloat(fix.pos_long),
       }))
       .filter(fix => !isNaN(fix.lat) && !isNaN(fix.lng));
   }, [navlog]);
 
   // Create route positions for the polyline
   const routePositions: [number, number][] = useMemo(() => {
     return waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
   }, [waypoints]);
 
   // Origin and destination coordinates
   const originCoords = useMemo(() => {
     const lat = parseFloat(origin.pos_lat);
     const lng = parseFloat(origin.pos_long);
     return !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
   }, [origin]);
 
   const destCoords = useMemo(() => {
     const lat = parseFloat(destination.pos_lat);
     const lng = parseFloat(destination.pos_long);
     return !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
   }, [destination]);
 
   // Calculate center of the map
   const center = useMemo((): [number, number] => {
     if (routePositions.length > 0) {
       const midIndex = Math.floor(routePositions.length / 2);
       return routePositions[midIndex];
     }
     if (originCoords) return [originCoords.lat, originCoords.lng];
     return [0, 0];
   }, [routePositions, originCoords]);
 
   // Format altitude for display
   const formatAltitude = (alt: string) => {
     const feet = parseInt(alt);
     if (isNaN(feet)) return alt;
     if (feet >= 18000) return `FL${Math.round(feet / 100)}`;
     return `${feet.toLocaleString()} ft`;
   };
 
   if (waypoints.length === 0) {
     return (
       <div className="h-[500px] flex items-center justify-center bg-muted/50 rounded-xl">
         <p className="text-muted-foreground">No route coordinates available</p>
       </div>
     );
   }
 
   return (
     <div className="h-[500px] rounded-xl overflow-hidden border relative">
       <MapContainer
         center={center}
         zoom={5}
         style={{ height: '100%', width: '100%' }}
         className="z-0"
       >
         <TileLayer
           attribution='&copy; <a href="https://carto.com/">CARTO</a>'
           url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
         />
         
         <FitBounds positions={routePositions} />
         
         {/* Route line */}
         <Polyline
           positions={routePositions}
           pathOptions={{
             color: '#38bdf8',
             weight: 3,
             opacity: 0.9,
           }}
         />
         
         {/* Departure marker */}
         {originCoords && (
           <Marker position={[originCoords.lat, originCoords.lng]} icon={departureIcon}>
             <Popup>
               <div className="text-sm font-sans">
                 <p className="font-bold text-green-600">📍 {origin.icao_code}</p>
                 <p className="text-xs text-gray-600">{origin.name}</p>
                 <p className="text-xs mt-1">Departure Airport</p>
               </div>
             </Popup>
           </Marker>
         )}
         
         {/* Arrival marker */}
         {destCoords && (
           <Marker position={[destCoords.lat, destCoords.lng]} icon={arrivalIcon}>
             <Popup>
               <div className="text-sm font-sans">
                 <p className="font-bold text-red-600">📍 {destination.icao_code}</p>
                 <p className="text-xs text-gray-600">{destination.name}</p>
                 <p className="text-xs mt-1">Arrival Airport</p>
               </div>
             </Popup>
           </Marker>
         )}
         
         {/* Waypoint markers */}
         {waypoints.map((wp, index) => {
           // Skip first and last (departure/arrival)
           if (index === 0 || index === waypoints.length - 1) return null;
           
           return (
             <Marker
               key={`${wp.ident}-${index}`}
               position={[wp.lat, wp.lng]}
               icon={waypointIcon}
             >
               <Popup>
                 <div className="text-sm font-sans min-w-[140px]">
                   <p className="font-bold text-sky-500">📍 {wp.ident}</p>
                   {wp.name && <p className="text-xs text-gray-600">{wp.name}</p>}
                   <div className="mt-2 space-y-1 text-xs">
                     {wp.via_airway && (
                       <p><span className="text-gray-500">Airway:</span> {wp.via_airway}</p>
                     )}
                     <p><span className="text-gray-500">Alt:</span> {formatAltitude(wp.altitude_feet)}</p>
                     {wp.frequency && (
                       <p><span className="text-gray-500">Freq:</span> {wp.frequency}</p>
                     )}
                     {wp.type && (
                       <p><span className="text-gray-500">Type:</span> {wp.type}</p>
                     )}
                   </div>
                 </div>
               </Popup>
             </Marker>
           );
         })}
       </MapContainer>
       
       {/* Legend overlay */}
       <MapLegend />
     </div>
   );
 }