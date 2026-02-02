import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OFPNavlogFix {
  ident: string;
  name: string;
  type: string;
  frequency: string | null;
  pos_lat: string;
  pos_long: string;
  via_airway: string | null;
  is_sid_star: string;
  distance: string;
  track_true: string;
  track_mag: string;
  altitude_feet: string;
  wind_dir: string;
  wind_spd: string;
  time_leg: string;
  time_total: string;
  fuel_plan_onboard: string;
  oat: string;
}

export interface OFPMapImage {
  name: string;
  link: string;
  fullUrl: string;
}

export interface OFPData {
  fetch: {
    status: string;
    time: string;
  };
  params: {
    request_id: string;
    static_id: string;
    ofp_layout: string;
    units: string;
  };
  general: {
    icao_airline: string;
    flight_number: string;
    cruise_profile: string;
    climb_profile: string;
    descent_profile: string;
    cruise_mach: string;
    cruise_tas: string;
    costindex: string;
    initial_altitude: string;
    avg_wind_comp: string;
    avg_wind_dir: string;
    avg_wind_spd: string;
    gc_distance: string;
    air_distance: string;
    route: string;
    route_ifps: string;
    sid_ident: string | null;
    star_ident: string | null;
  };
  origin: {
    icao_code: string;
    iata_code: string;
    name: string;
    plan_rwy: string | null;
    metar: string | null;
    metar_time: string | null;
    metar_category: string;
    taf: string | null;
    elevation: string;
    pos_lat: string;
    pos_long: string;
  };
  destination: {
    icao_code: string;
    iata_code: string;
    name: string;
    plan_rwy: string | null;
    metar: string | null;
    metar_time: string | null;
    metar_category: string;
    taf: string | null;
    elevation: string;
    pos_lat: string;
    pos_long: string;
  };
  alternate: {
    icao_code: string;
    iata_code: string;
    name: string;
    plan_rwy: string | null;
    metar: string | null;
    elevation: string;
    pos_lat: string;
    pos_long: string;
  };
  aircraft: {
    icaocode: string;
    iatacode: string;
    name: string;
    reg: string | null;
    selcal: string | null;
    fin: string | null;
    base: string | null;
  };
  fuel: {
    taxi: string;
    enroute_burn: string;
    contingency: string;
    alternate_burn: string;
    reserve: string;
    etops: string;
    extra: string;
    min_takeoff: string;
    plan_takeoff: string;
    plan_ramp: string;
    plan_landing: string;
    avg_fuel_flow: string;
    max_tanks: string;
  };
  weights: {
    oew: string;
    pax_count: string;
    bag_count: string;
    pax_weight: string;
    bag_weight: string;
    cargo: string;
    payload: string;
    est_zfw: string;
    max_zfw: string;
    est_tow: string;
    max_tow: string;
    est_ldw: string;
    max_ldw: string;
  };
  times: {
    sched_out: string;
    sched_off: string;
    sched_on: string;
    sched_in: string;
    sched_block: string;
    est_time_enroute: string;
    est_out: string;
    est_off: string;
    est_on: string;
    est_in: string;
    est_block: string;
  };
  atc: {
    callsign: string;
    flightplan_text: string;
  };
  navlog: OFPNavlogFix[];
  images: {
    maps: OFPMapImage[];
  };
  links: {
    skyvector: string | null;
  };
  text: string;
  files: {
    pdf: {
      link: string;
    };
  };
}

export function useSimBriefOFP() {
  const [ofpData, setOfpData] = useState<OFPData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch OFP by ofp_id (from SimBrief popup callback)
  const fetchOFPById = useCallback(async (ofpId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching OFP by ID:', ofpId);
      const { data, error: invokeError } = await supabase.functions.invoke('simbrief-ofp', {
        body: { action: 'fetch_ofp', ofp_id: ofpId },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.raw_xml, 'text/xml');
      const parsed = parseXMLToOFP(xmlDoc);
      setOfpData(parsed);
      return parsed;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch OFP data';
      setError(message);
      console.error('Error fetching OFP:', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch latest OFP by SimBrief pilot ID/username (legacy)
  const fetchOFPByPid = useCallback(async (pid: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching OFP by PID:', pid);
      const { data, error: invokeError } = await supabase.functions.invoke('simbrief-ofp', {
        body: { action: 'fetch_by_pid', pid },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const parsed = parseSimBriefJSON(data);
      setOfpData(parsed);
      return parsed;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch OFP data';
      setError(message);
      console.error('Error fetching OFP:', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearOFP = useCallback(() => {
    setOfpData(null);
    setError(null);
  }, []);

  return {
    ofpData,
    loading,
    error,
    fetchOFPById,
    fetchOFPByPid,
    clearOFP,
  };
}

// Parse SimBrief JSON response (from fetch_by_pid)
function parseSimBriefJSON(data: Record<string, unknown>): OFPData {
  const origin = (data.origin || {}) as Record<string, unknown>;
  const destination = (data.destination || {}) as Record<string, unknown>;
  const alternate = (data.alternate || {}) as Record<string, unknown>;
  const aircraft = (data.aircraft || {}) as Record<string, unknown>;
  const fuel = (data.fuel || {}) as Record<string, unknown>;
  const weights = (data.weights || {}) as Record<string, unknown>;
  const times = (data.times || {}) as Record<string, unknown>;
  const general = (data.general || {}) as Record<string, unknown>;
  const atc = (data.atc || {}) as Record<string, unknown>;
  const params = (data.params || {}) as Record<string, unknown>;
  const fetchInfo = (data.fetch || {}) as Record<string, unknown>;
  const files = (data.files || {}) as Record<string, unknown>;
  const images = (data.images || {}) as Record<string, unknown>;
  const text = (data.text as string) || '';
  const navlogData = (data.navlog || {}) as Record<string, unknown>;

  // Parse navlog
  const navlogRaw = (navlogData.fix || []) as Record<string, unknown>[];
  const navlog: OFPNavlogFix[] = (Array.isArray(navlogRaw) ? navlogRaw : [navlogRaw]).map((fix) => ({
    ident: (fix.ident as string) || '',
    name: (fix.name as string) || '',
    type: (fix.type as string) || '',
    frequency: (fix.frequency as string) || null,
    pos_lat: (fix.pos_lat as string) || '',
    pos_long: (fix.pos_long as string) || '',
    via_airway: (fix.via_airway as string) || null,
    is_sid_star: (fix.is_sid_star as string) || '0',
    distance: (fix.distance as string) || '0',
    track_true: (fix.track_true as string) || '',
    track_mag: (fix.track_mag as string) || '',
    altitude_feet: (fix.altitude_feet as string) || '0',
    wind_dir: (fix.wind_dir as string) || '',
    wind_spd: (fix.wind_spd as string) || '',
    time_leg: (fix.time_leg as string) || '0',
    time_total: (fix.time_total as string) || '0',
    fuel_plan_onboard: (fix.fuel_plan_onboard as string) || '0',
    oat: (fix.oat as string) || '',
  }));

  // Parse maps
  const mapsRaw = ((images.map || []) as Record<string, unknown>[]);
  const imagesDirectory = (images.directory as string) || 'https://www.simbrief.com/ofp/flightplans/';
  const maps: OFPMapImage[] = (Array.isArray(mapsRaw) ? mapsRaw : [mapsRaw])
    .filter((m) => m.link)
    .map((m) => {
      const link = (m.link as string) || '';
      const fullUrl = link.startsWith('http') ? link : `${imagesDirectory}${link}`;
      return {
        name: (m.name as string) || 'Map',
        link,
        fullUrl,
      };
    });

  return buildOFPData(
    fetchInfo, params, general, origin, destination, alternate,
    aircraft, fuel, weights, times, atc, navlog, maps, text, files
  );
}

// Parse XML to OFP
function parseXMLToOFP(xmlDoc: Document): OFPData {
  const getText = (parent: Element | Document | null, tag: string): string => {
    if (!parent) return '';
    const el = parent.getElementsByTagName(tag)[0];
    return el?.textContent || '';
  };

  const originEl = xmlDoc.getElementsByTagName('origin')[0];
  const destinationEl = xmlDoc.getElementsByTagName('destination')[0];
  const alternateEl = xmlDoc.getElementsByTagName('alternate')[0];
  const aircraftEl = xmlDoc.getElementsByTagName('aircraft')[0];
  const fuelEl = xmlDoc.getElementsByTagName('fuel')[0];
  const weightsEl = xmlDoc.getElementsByTagName('weights')[0];
  const timesEl = xmlDoc.getElementsByTagName('times')[0];
  const generalEl = xmlDoc.getElementsByTagName('general')[0];
  const atcEl = xmlDoc.getElementsByTagName('atc')[0];
  const paramsEl = xmlDoc.getElementsByTagName('params')[0];
  const fetchEl = xmlDoc.getElementsByTagName('fetch')[0];
  const filesEl = xmlDoc.getElementsByTagName('files')[0];
  const imagesEl = xmlDoc.getElementsByTagName('images')[0];
  const textEl = xmlDoc.getElementsByTagName('text')[0];

  // Parse navlog
  const navlogEl = xmlDoc.getElementsByTagName('navlog')[0];
  const fixElements = navlogEl?.getElementsByTagName('fix') || [];
  const navlog: OFPNavlogFix[] = Array.from(fixElements).map((fix) => ({
    ident: getText(fix, 'ident'),
    name: getText(fix, 'name'),
    type: getText(fix, 'type'),
    frequency: getText(fix, 'frequency') || null,
    pos_lat: getText(fix, 'pos_lat'),
    pos_long: getText(fix, 'pos_long'),
    via_airway: getText(fix, 'via_airway') || null,
    is_sid_star: getText(fix, 'is_sid_star'),
    distance: getText(fix, 'distance'),
    track_true: getText(fix, 'track_true'),
    track_mag: getText(fix, 'track_mag'),
    altitude_feet: getText(fix, 'altitude_feet'),
    wind_dir: getText(fix, 'wind_dir'),
    wind_spd: getText(fix, 'wind_spd'),
    time_leg: getText(fix, 'time_leg'),
    time_total: getText(fix, 'time_total'),
    fuel_plan_onboard: getText(fix, 'fuel_plan_onboard'),
    oat: getText(fix, 'oat'),
  }));

  // Parse maps
  const imagesDirectory = imagesEl ? getText(imagesEl, 'directory') : 'https://www.simbrief.com/ofp/flightplans/';
  const mapElements = imagesEl?.getElementsByTagName('map') || [];
  const maps: OFPMapImage[] = Array.from(mapElements).map((m) => {
    const link = getText(m, 'link');
    const fullUrl = link.startsWith('http') ? link : `${imagesDirectory}${link}`;
    return {
      name: getText(m, 'name') || 'Map',
      link,
      fullUrl,
    };
  });

  const fetchInfo = {
    status: fetchEl ? getText(fetchEl, 'status') : 'OK',
    time: fetchEl ? getText(fetchEl, 'time') : '',
  };

  const params = {
    request_id: paramsEl ? getText(paramsEl, 'request_id') : '',
    static_id: paramsEl ? getText(paramsEl, 'static_id') : '',
    ofp_layout: paramsEl ? getText(paramsEl, 'ofp_layout') : '',
    units: paramsEl ? getText(paramsEl, 'units') : 'KGS',
  };

  const general = {
    icao_airline: generalEl ? getText(generalEl, 'icao_airline') : '',
    flight_number: generalEl ? getText(generalEl, 'flight_number') : '',
    cruise_profile: generalEl ? getText(generalEl, 'cruise_profile') : '',
    climb_profile: generalEl ? getText(generalEl, 'climb_profile') : '',
    descent_profile: generalEl ? getText(generalEl, 'descent_profile') : '',
    cruise_mach: generalEl ? getText(generalEl, 'cruise_mach') : '',
    cruise_tas: generalEl ? getText(generalEl, 'cruise_tas') : '',
    costindex: generalEl ? getText(generalEl, 'costindex') : '',
    initial_altitude: generalEl ? getText(generalEl, 'initial_altitude') : '',
    avg_wind_comp: generalEl ? getText(generalEl, 'avg_wind_comp') : '',
    avg_wind_dir: generalEl ? getText(generalEl, 'avg_wind_dir') : '',
    avg_wind_spd: generalEl ? getText(generalEl, 'avg_wind_spd') : '',
    gc_distance: generalEl ? getText(generalEl, 'gc_distance') : '',
    air_distance: generalEl ? getText(generalEl, 'air_distance') : '',
    route: generalEl ? getText(generalEl, 'route') : '',
    route_ifps: generalEl ? getText(generalEl, 'route_ifps') : '',
    sid_ident: generalEl ? getText(generalEl, 'sid_ident') || null : null,
    star_ident: generalEl ? getText(generalEl, 'star_ident') || null : null,
  };

  const origin = {
    icao_code: originEl ? getText(originEl, 'icao_code') : '',
    iata_code: originEl ? getText(originEl, 'iata_code') : '',
    name: originEl ? getText(originEl, 'name') : '',
    plan_rwy: originEl ? getText(originEl, 'plan_rwy') || null : null,
    metar: originEl ? getText(originEl, 'metar') || null : null,
    metar_time: originEl ? getText(originEl, 'metar_time') || null : null,
    metar_category: originEl ? getText(originEl, 'metar_category') : 'unknown',
    taf: originEl ? getText(originEl, 'taf') || null : null,
    elevation: originEl ? getText(originEl, 'elevation') : '',
    pos_lat: originEl ? getText(originEl, 'pos_lat') : '',
    pos_long: originEl ? getText(originEl, 'pos_long') : '',
  };

  const destination = {
    icao_code: destinationEl ? getText(destinationEl, 'icao_code') : '',
    iata_code: destinationEl ? getText(destinationEl, 'iata_code') : '',
    name: destinationEl ? getText(destinationEl, 'name') : '',
    plan_rwy: destinationEl ? getText(destinationEl, 'plan_rwy') || null : null,
    metar: destinationEl ? getText(destinationEl, 'metar') || null : null,
    metar_time: destinationEl ? getText(destinationEl, 'metar_time') || null : null,
    metar_category: destinationEl ? getText(destinationEl, 'metar_category') : 'unknown',
    taf: destinationEl ? getText(destinationEl, 'taf') || null : null,
    elevation: destinationEl ? getText(destinationEl, 'elevation') : '',
    pos_lat: destinationEl ? getText(destinationEl, 'pos_lat') : '',
    pos_long: destinationEl ? getText(destinationEl, 'pos_long') : '',
  };

  const alternate = {
    icao_code: alternateEl ? getText(alternateEl, 'icao_code') : '',
    iata_code: alternateEl ? getText(alternateEl, 'iata_code') : '',
    name: alternateEl ? getText(alternateEl, 'name') : '',
    plan_rwy: alternateEl ? getText(alternateEl, 'plan_rwy') || null : null,
    metar: alternateEl ? getText(alternateEl, 'metar') || null : null,
    elevation: alternateEl ? getText(alternateEl, 'elevation') : '',
    pos_lat: alternateEl ? getText(alternateEl, 'pos_lat') : '',
    pos_long: alternateEl ? getText(alternateEl, 'pos_long') : '',
  };

  const aircraft = {
    icaocode: aircraftEl ? getText(aircraftEl, 'icaocode') : '',
    iatacode: aircraftEl ? getText(aircraftEl, 'iatacode') : '',
    name: aircraftEl ? getText(aircraftEl, 'name') : '',
    reg: aircraftEl ? getText(aircraftEl, 'reg') || null : null,
    selcal: aircraftEl ? getText(aircraftEl, 'selcal') || null : null,
    fin: aircraftEl ? getText(aircraftEl, 'fin') || null : null,
    base: aircraftEl ? getText(aircraftEl, 'base') || null : null,
  };

  const fuel = {
    taxi: fuelEl ? getText(fuelEl, 'taxi') : '0',
    enroute_burn: fuelEl ? getText(fuelEl, 'enroute_burn') : '0',
    contingency: fuelEl ? getText(fuelEl, 'contingency') : '0',
    alternate_burn: fuelEl ? getText(fuelEl, 'alternate_burn') : '0',
    reserve: fuelEl ? getText(fuelEl, 'reserve') : '0',
    etops: fuelEl ? getText(fuelEl, 'etops') : '0',
    extra: fuelEl ? getText(fuelEl, 'extra') : '0',
    min_takeoff: fuelEl ? getText(fuelEl, 'min_takeoff') : '0',
    plan_takeoff: fuelEl ? getText(fuelEl, 'plan_takeoff') : '0',
    plan_ramp: fuelEl ? getText(fuelEl, 'plan_ramp') : '0',
    plan_landing: fuelEl ? getText(fuelEl, 'plan_landing') : '0',
    avg_fuel_flow: fuelEl ? getText(fuelEl, 'avg_fuel_flow') : '0',
    max_tanks: fuelEl ? getText(fuelEl, 'max_tanks') : '0',
  };

  const weights = {
    oew: weightsEl ? getText(weightsEl, 'oew') : '0',
    pax_count: weightsEl ? getText(weightsEl, 'pax_count') : '0',
    bag_count: weightsEl ? getText(weightsEl, 'bag_count') : '0',
    pax_weight: weightsEl ? getText(weightsEl, 'pax_weight') : '0',
    bag_weight: weightsEl ? getText(weightsEl, 'bag_weight') : '0',
    cargo: weightsEl ? getText(weightsEl, 'cargo') : '0',
    payload: weightsEl ? getText(weightsEl, 'payload') : '0',
    est_zfw: weightsEl ? getText(weightsEl, 'est_zfw') : '0',
    max_zfw: weightsEl ? getText(weightsEl, 'max_zfw') : '0',
    est_tow: weightsEl ? getText(weightsEl, 'est_tow') : '0',
    max_tow: weightsEl ? getText(weightsEl, 'max_tow') : '0',
    est_ldw: weightsEl ? getText(weightsEl, 'est_ldw') : '0',
    max_ldw: weightsEl ? getText(weightsEl, 'max_ldw') : '0',
  };

  const times = {
    sched_out: timesEl ? getText(timesEl, 'sched_out') : '',
    sched_off: timesEl ? getText(timesEl, 'sched_off') : '',
    sched_on: timesEl ? getText(timesEl, 'sched_on') : '',
    sched_in: timesEl ? getText(timesEl, 'sched_in') : '',
    sched_block: timesEl ? getText(timesEl, 'sched_block') : '',
    est_time_enroute: timesEl ? getText(timesEl, 'est_time_enroute') : '0',
    est_out: timesEl ? getText(timesEl, 'est_out') : '',
    est_off: timesEl ? getText(timesEl, 'est_off') : '',
    est_on: timesEl ? getText(timesEl, 'est_on') : '',
    est_in: timesEl ? getText(timesEl, 'est_in') : '',
    est_block: timesEl ? getText(timesEl, 'est_block') : '',
  };

  const atc = {
    callsign: atcEl ? getText(atcEl, 'callsign') : '',
    flightplan_text: atcEl ? getText(atcEl, 'flightplan_text') : '',
  };

  const text = textEl?.textContent || '';
  const pdfLink = filesEl ? getText(filesEl, 'directory') : '';

  return {
    fetch: fetchInfo,
    params,
    general,
    origin,
    destination,
    alternate,
    aircraft,
    fuel,
    weights,
    times,
    atc,
    navlog,
    images: { maps },
    links: { skyvector: generalEl ? getText(generalEl, 'dx_rmk') || null : null },
    text,
    files: { pdf: { link: pdfLink } },
  };
}

// Helper to build OFPData from parsed components
function buildOFPData(
  fetchInfo: Record<string, unknown>,
  params: Record<string, unknown>,
  general: Record<string, unknown>,
  origin: Record<string, unknown>,
  destination: Record<string, unknown>,
  alternate: Record<string, unknown>,
  aircraft: Record<string, unknown>,
  fuel: Record<string, unknown>,
  weights: Record<string, unknown>,
  times: Record<string, unknown>,
  atc: Record<string, unknown>,
  navlog: OFPNavlogFix[],
  maps: OFPMapImage[],
  text: string,
  files: Record<string, unknown>
): OFPData {
  return {
    fetch: {
      status: (fetchInfo.status as string) || 'OK',
      time: (fetchInfo.time as string) || '',
    },
    params: {
      request_id: (params.request_id as string) || '',
      static_id: (params.static_id as string) || '',
      ofp_layout: (params.ofp_layout as string) || '',
      units: (params.units as string) || 'KGS',
    },
    general: {
      icao_airline: (general.icao_airline as string) || '',
      flight_number: (general.flight_number as string) || '',
      cruise_profile: (general.cruise_profile as string) || '',
      climb_profile: (general.climb_profile as string) || '',
      descent_profile: (general.descent_profile as string) || '',
      cruise_mach: (general.cruise_mach as string) || '',
      cruise_tas: (general.cruise_tas as string) || '',
      costindex: (general.costindex as string) || '',
      initial_altitude: (general.initial_altitude as string) || '',
      avg_wind_comp: (general.avg_wind_comp as string) || '',
      avg_wind_dir: (general.avg_wind_dir as string) || '',
      avg_wind_spd: (general.avg_wind_spd as string) || '',
      gc_distance: (general.gc_distance as string) || '',
      air_distance: (general.air_distance as string) || '',
      route: (general.route as string) || '',
      route_ifps: (general.route_ifps as string) || '',
      sid_ident: (general.sid_ident as string) || null,
      star_ident: (general.star_ident as string) || null,
    },
    origin: {
      icao_code: (origin.icao_code as string) || '',
      iata_code: (origin.iata_code as string) || '',
      name: (origin.name as string) || '',
      plan_rwy: (origin.plan_rwy as string) || null,
      metar: (origin.metar as string) || null,
      metar_time: (origin.metar_time as string) || null,
      metar_category: (origin.metar_category as string) || 'unknown',
      taf: (origin.taf as string) || null,
      elevation: (origin.elevation as string) || '',
      pos_lat: (origin.pos_lat as string) || '',
      pos_long: (origin.pos_long as string) || '',
    },
    destination: {
      icao_code: (destination.icao_code as string) || '',
      iata_code: (destination.iata_code as string) || '',
      name: (destination.name as string) || '',
      plan_rwy: (destination.plan_rwy as string) || null,
      metar: (destination.metar as string) || null,
      metar_time: (destination.metar_time as string) || null,
      metar_category: (destination.metar_category as string) || 'unknown',
      taf: (destination.taf as string) || null,
      elevation: (destination.elevation as string) || '',
      pos_lat: (destination.pos_lat as string) || '',
      pos_long: (destination.pos_long as string) || '',
    },
    alternate: {
      icao_code: (alternate.icao_code as string) || '',
      iata_code: (alternate.iata_code as string) || '',
      name: (alternate.name as string) || '',
      plan_rwy: (alternate.plan_rwy as string) || null,
      metar: (alternate.metar as string) || null,
      elevation: (alternate.elevation as string) || '',
      pos_lat: (alternate.pos_lat as string) || '',
      pos_long: (alternate.pos_long as string) || '',
    },
    aircraft: {
      icaocode: (aircraft.icaocode as string) || '',
      iatacode: (aircraft.iatacode as string) || '',
      name: (aircraft.name as string) || '',
      reg: (aircraft.reg as string) || null,
      selcal: (aircraft.selcal as string) || null,
      fin: (aircraft.fin as string) || null,
      base: (aircraft.base as string) || null,
    },
    fuel: {
      taxi: (fuel.taxi as string) || '0',
      enroute_burn: (fuel.enroute_burn as string) || '0',
      contingency: (fuel.contingency as string) || '0',
      alternate_burn: (fuel.alternate_burn as string) || '0',
      reserve: (fuel.reserve as string) || '0',
      etops: (fuel.etops as string) || '0',
      extra: (fuel.extra as string) || '0',
      min_takeoff: (fuel.min_takeoff as string) || '0',
      plan_takeoff: (fuel.plan_takeoff as string) || '0',
      plan_ramp: (fuel.plan_ramp as string) || '0',
      plan_landing: (fuel.plan_landing as string) || '0',
      avg_fuel_flow: (fuel.avg_fuel_flow as string) || '0',
      max_tanks: (fuel.max_tanks as string) || '0',
    },
    weights: {
      oew: (weights.oew as string) || '0',
      pax_count: (weights.pax_count as string) || '0',
      bag_count: (weights.bag_count as string) || '0',
      pax_weight: (weights.pax_weight as string) || '0',
      bag_weight: (weights.bag_weight as string) || '0',
      cargo: (weights.cargo as string) || '0',
      payload: (weights.payload as string) || '0',
      est_zfw: (weights.est_zfw as string) || '0',
      max_zfw: (weights.max_zfw as string) || '0',
      est_tow: (weights.est_tow as string) || '0',
      max_tow: (weights.max_tow as string) || '0',
      est_ldw: (weights.est_ldw as string) || '0',
      max_ldw: (weights.max_ldw as string) || '0',
    },
    times: {
      sched_out: (times.sched_out as string) || '',
      sched_off: (times.sched_off as string) || '',
      sched_on: (times.sched_on as string) || '',
      sched_in: (times.sched_in as string) || '',
      sched_block: (times.sched_block as string) || '',
      est_time_enroute: (times.est_time_enroute as string) || '0',
      est_out: (times.est_out as string) || '',
      est_off: (times.est_off as string) || '',
      est_on: (times.est_on as string) || '',
      est_in: (times.est_in as string) || '',
      est_block: (times.est_block as string) || '',
    },
    atc: {
      callsign: (atc.callsign as string) || '',
      flightplan_text: (atc.flightplan_text as string) || '',
    },
    navlog,
    images: { maps },
    links: { skyvector: (general.dx_rmk as string) || null },
    text,
    files: { pdf: { link: ((files.pdf as Record<string, unknown>)?.link as string) || (files.directory as string) || '' } },
  };
}
