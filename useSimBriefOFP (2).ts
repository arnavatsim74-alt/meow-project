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

  const fetchOFPByPid = useCallback(async (pid: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching OFP by PID:', pid);
      const { data, error: invokeError } = await supabase.functions.invoke('simbrief-api', {
        body: { action: 'fetch_by_pid', pid },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Parse the SimBrief JSON response into our OFPData structure
      const parsed = parseSimBriefResponse(data);
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

  const fetchOFPById = useCallback(async (ofpId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching OFP by ID:', ofpId);
      const { data, error: invokeError } = await supabase.functions.invoke('simbrief-api', {
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

  const fetchOFP = useCallback(async (pidOrOfpId: string) => {
    // Check if it's an OFP ID (format: 10 digits + underscore + 10 uppercase hex chars)
    // Example: 1769239995_A33F87B1DF
    const ofpIdPattern = /^[0-9]{10}_[A-F0-9]{10}$/i;
    if (ofpIdPattern.test(pidOrOfpId)) {
      return fetchOFPById(pidOrOfpId);
    }
    return fetchOFPByPid(pidOrOfpId);
  }, [fetchOFPById, fetchOFPByPid]);

  const clearOFP = useCallback(() => {
    setOfpData(null);
    setError(null);
  }, []);

  return {
    ofpData,
    loading,
    error,
    fetchOFP,
    fetchOFPByPid,
    fetchOFPById,
    clearOFP,
  };
}

function parseSimBriefResponse(data: any): OFPData {
  const origin = data.origin || {};
  const destination = data.destination || {};
  const alternate = data.alternate || {};
  const aircraft = data.aircraft || {};
  const fuel = data.fuel || {};
  const weights = data.weights || {};
  const times = data.times || {};
  const general = data.general || {};
  const atc = data.atc || {};
  const params = data.params || {};
  const fetchInfo = data.fetch || {};
  const files = data.files || {};
  const images = data.images || {};
  const text = data.text || '';
  
  // Parse navlog
  const navlogRaw = data.navlog?.fix || [];
  const navlog: OFPNavlogFix[] = (Array.isArray(navlogRaw) ? navlogRaw : [navlogRaw]).map((fix: any) => ({
    ident: fix.ident || '',
    name: fix.name || '',
    type: fix.type || '',
    frequency: fix.frequency || null,
    pos_lat: fix.pos_lat || '',
    pos_long: fix.pos_long || '',
    via_airway: fix.via_airway || null,
    is_sid_star: fix.is_sid_star || '0',
    distance: fix.distance || '0',
    track_true: fix.track_true || '',
    track_mag: fix.track_mag || '',
    altitude_feet: fix.altitude_feet || '0',
    wind_dir: fix.wind_dir || '',
    wind_spd: fix.wind_spd || '',
    time_leg: fix.time_leg || '0',
    time_total: fix.time_total || '0',
    fuel_plan_onboard: fix.fuel_plan_onboard || '0',
    oat: fix.oat || '',
  }));

  // Parse maps - construct full URLs properly using the directory
  const mapsRaw = images.map || [];
  const imagesDirectory = images.directory || 'https://www.simbrief.com/ofp/flightplans/';
  const maps: OFPMapImage[] = (Array.isArray(mapsRaw) ? mapsRaw : [mapsRaw])
    .filter((m: any) => m.link)
    .map((m: any) => {
      const link = m.link || '';
      // If link starts with http, use as is; otherwise prepend directory
      const fullUrl = link.startsWith('http') ? link : `${imagesDirectory}${link}`;
      return {
        name: m.name || 'Map',
        link,
        fullUrl,
      };
    });

  return {
    fetch: {
      status: fetchInfo.status || 'OK',
      time: fetchInfo.time || '',
    },
    params: {
      request_id: params.request_id || '',
      static_id: params.static_id || '',
      ofp_layout: params.ofp_layout || '',
      units: params.units || 'KGS',
    },
    general: {
      icao_airline: general.icao_airline || '',
      flight_number: general.flight_number || '',
      cruise_profile: general.cruise_profile || '',
      climb_profile: general.climb_profile || '',
      descent_profile: general.descent_profile || '',
      cruise_mach: general.cruise_mach || '',
      cruise_tas: general.cruise_tas || '',
      costindex: general.costindex || '',
      initial_altitude: general.initial_altitude || '',
      avg_wind_comp: general.avg_wind_comp || '',
      avg_wind_dir: general.avg_wind_dir || '',
      avg_wind_spd: general.avg_wind_spd || '',
      gc_distance: general.gc_distance || '',
      air_distance: general.air_distance || '',
      route: general.route || '',
      route_ifps: general.route_ifps || '',
      sid_ident: general.sid_ident || null,
      star_ident: general.star_ident || null,
    },
    origin: {
      icao_code: origin.icao_code || '',
      iata_code: origin.iata_code || '',
      name: origin.name || '',
      plan_rwy: origin.plan_rwy || null,
      metar: origin.metar || null,
      metar_time: origin.metar_time || null,
      metar_category: origin.metar_category || 'unknown',
      taf: origin.taf || null,
      elevation: origin.elevation || '',
      pos_lat: origin.pos_lat || '',
      pos_long: origin.pos_long || '',
    },
    destination: {
      icao_code: destination.icao_code || '',
      iata_code: destination.iata_code || '',
      name: destination.name || '',
      plan_rwy: destination.plan_rwy || null,
      metar: destination.metar || null,
      metar_time: destination.metar_time || null,
      metar_category: destination.metar_category || 'unknown',
      taf: destination.taf || null,
      elevation: destination.elevation || '',
      pos_lat: destination.pos_lat || '',
      pos_long: destination.pos_long || '',
    },
    alternate: {
      icao_code: alternate.icao_code || '',
      iata_code: alternate.iata_code || '',
      name: alternate.name || '',
      plan_rwy: alternate.plan_rwy || null,
      metar: alternate.metar || null,
      elevation: alternate.elevation || '',
      pos_lat: alternate.pos_lat || '',
      pos_long: alternate.pos_long || '',
    },
    aircraft: {
      icaocode: aircraft.icaocode || '',
      iatacode: aircraft.iatacode || '',
      name: aircraft.name || '',
      reg: aircraft.reg || null,
      selcal: aircraft.selcal || null,
      fin: aircraft.fin || null,
      base: aircraft.base || null,
    },
    fuel: {
      taxi: fuel.taxi || '0',
      enroute_burn: fuel.enroute_burn || '0',
      contingency: fuel.contingency || '0',
      alternate_burn: fuel.alternate_burn || '0',
      reserve: fuel.reserve || '0',
      etops: fuel.etops || '0',
      extra: fuel.extra || '0',
      min_takeoff: fuel.min_takeoff || '0',
      plan_takeoff: fuel.plan_takeoff || '0',
      plan_ramp: fuel.plan_ramp || '0',
      plan_landing: fuel.plan_landing || '0',
      avg_fuel_flow: fuel.avg_fuel_flow || '0',
      max_tanks: fuel.max_tanks || '0',
    },
    weights: {
      oew: weights.oew || '0',
      pax_count: weights.pax_count || '0',
      bag_count: weights.bag_count || '0',
      pax_weight: weights.pax_weight || '0',
      bag_weight: weights.bag_weight || '0',
      cargo: weights.cargo || '0',
      payload: weights.payload || '0',
      est_zfw: weights.est_zfw || '0',
      max_zfw: weights.max_zfw || '0',
      est_tow: weights.est_tow || '0',
      max_tow: weights.max_tow || '0',
      est_ldw: weights.est_ldw || '0',
      max_ldw: weights.max_ldw || '0',
    },
    times: {
      sched_out: times.sched_out || '',
      sched_off: times.sched_off || '',
      sched_on: times.sched_on || '',
      sched_in: times.sched_in || '',
      sched_block: times.sched_block || '',
      est_time_enroute: times.est_time_enroute || '0',
      est_out: times.est_out || '',
      est_off: times.est_off || '',
      est_on: times.est_on || '',
      est_in: times.est_in || '',
      est_block: times.est_block || '',
    },
    atc: {
      callsign: atc.callsign || '',
      flightplan_text: atc.flightplan_text || '',
    },
    navlog,
    images: {
      maps,
    },
    links: {
      skyvector: general.dx_rmk || null,
    },
    text: text,
    files: {
      pdf: {
        link: files.pdf?.link || files.directory || '',
      },
    },
  };
}

function parseXMLToOFP(xmlDoc: Document): OFPData {
  const getText = (parent: Element | Document, tag: string): string => {
    const el = parent.getElementsByTagName(tag)[0];
    return el?.textContent || '';
  };

  const origin = xmlDoc.getElementsByTagName('origin')[0];
  const destination = xmlDoc.getElementsByTagName('destination')[0];
  const alternate = xmlDoc.getElementsByTagName('alternate')[0];
  const aircraft = xmlDoc.getElementsByTagName('aircraft')[0];
  const fuel = xmlDoc.getElementsByTagName('fuel')[0];
  const weights = xmlDoc.getElementsByTagName('weights')[0];
  const times = xmlDoc.getElementsByTagName('times')[0];
  const general = xmlDoc.getElementsByTagName('general')[0];
  const atc = xmlDoc.getElementsByTagName('atc')[0];
  const params = xmlDoc.getElementsByTagName('params')[0];
  const fetchEl = xmlDoc.getElementsByTagName('fetch')[0];
  const files = xmlDoc.getElementsByTagName('files')[0];
  const images = xmlDoc.getElementsByTagName('images')[0];
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

  // Parse maps - get the directory for constructing full URLs
  const imagesEl = xmlDoc.getElementsByTagName('images')[0];
  const imagesDirectory = imagesEl ? getText(imagesEl, 'directory') : 'https://www.simbrief.com/ofp/flightplans/';
  const mapElements = imagesEl?.getElementsByTagName('map') || [];
  const maps: OFPMapImage[] = Array.from(mapElements).map((m) => {
    const link = getText(m, 'link');
    // Construct full URL using the directory from the XML
    const fullUrl = link.startsWith('http') ? link : `${imagesDirectory}${link}`;
    return {
      name: getText(m, 'name') || 'Map',
      link,
      fullUrl,
    };
  });

  return {
    fetch: {
      status: fetchEl ? getText(fetchEl, 'status') : 'OK',
      time: fetchEl ? getText(fetchEl, 'time') : '',
    },
    params: {
      request_id: params ? getText(params, 'request_id') : '',
      static_id: params ? getText(params, 'static_id') : '',
      ofp_layout: params ? getText(params, 'ofp_layout') : '',
      units: params ? getText(params, 'units') : 'KGS',
    },
    general: {
      icao_airline: general ? getText(general, 'icao_airline') : '',
      flight_number: general ? getText(general, 'flight_number') : '',
      cruise_profile: general ? getText(general, 'cruise_profile') : '',
      climb_profile: general ? getText(general, 'climb_profile') : '',
      descent_profile: general ? getText(general, 'descent_profile') : '',
      cruise_mach: general ? getText(general, 'cruise_mach') : '',
      cruise_tas: general ? getText(general, 'cruise_tas') : '',
      costindex: general ? getText(general, 'costindex') : '',
      initial_altitude: general ? getText(general, 'initial_altitude') : '',
      avg_wind_comp: general ? getText(general, 'avg_wind_comp') : '',
      avg_wind_dir: general ? getText(general, 'avg_wind_dir') : '',
      avg_wind_spd: general ? getText(general, 'avg_wind_spd') : '',
      gc_distance: general ? getText(general, 'gc_distance') : '',
      air_distance: general ? getText(general, 'air_distance') : '',
      route: general ? getText(general, 'route') : '',
      route_ifps: general ? getText(general, 'route_ifps') : '',
      sid_ident: general ? getText(general, 'sid_ident') || null : null,
      star_ident: general ? getText(general, 'star_ident') || null : null,
    },
    origin: {
      icao_code: origin ? getText(origin, 'icao_code') : '',
      iata_code: origin ? getText(origin, 'iata_code') : '',
      name: origin ? getText(origin, 'name') : '',
      plan_rwy: origin ? getText(origin, 'plan_rwy') || null : null,
      metar: origin ? getText(origin, 'metar') || null : null,
      metar_time: origin ? getText(origin, 'metar_time') || null : null,
      metar_category: origin ? getText(origin, 'metar_category') : 'unknown',
      taf: origin ? getText(origin, 'taf') || null : null,
      elevation: origin ? getText(origin, 'elevation') : '',
      pos_lat: origin ? getText(origin, 'pos_lat') : '',
      pos_long: origin ? getText(origin, 'pos_long') : '',
    },
    destination: {
      icao_code: destination ? getText(destination, 'icao_code') : '',
      iata_code: destination ? getText(destination, 'iata_code') : '',
      name: destination ? getText(destination, 'name') : '',
      plan_rwy: destination ? getText(destination, 'plan_rwy') || null : null,
      metar: destination ? getText(destination, 'metar') || null : null,
      metar_time: destination ? getText(destination, 'metar_time') || null : null,
      metar_category: destination ? getText(destination, 'metar_category') : 'unknown',
      taf: destination ? getText(destination, 'taf') || null : null,
      elevation: destination ? getText(destination, 'elevation') : '',
      pos_lat: destination ? getText(destination, 'pos_lat') : '',
      pos_long: destination ? getText(destination, 'pos_long') : '',
    },
    alternate: {
      icao_code: alternate ? getText(alternate, 'icao_code') : '',
      iata_code: alternate ? getText(alternate, 'iata_code') : '',
      name: alternate ? getText(alternate, 'name') : '',
      plan_rwy: alternate ? getText(alternate, 'plan_rwy') || null : null,
      metar: alternate ? getText(alternate, 'metar') || null : null,
      elevation: alternate ? getText(alternate, 'elevation') : '',
      pos_lat: alternate ? getText(alternate, 'pos_lat') : '',
      pos_long: alternate ? getText(alternate, 'pos_long') : '',
    },
    aircraft: {
      icaocode: aircraft ? getText(aircraft, 'icaocode') : '',
      iatacode: aircraft ? getText(aircraft, 'iatacode') : '',
      name: aircraft ? getText(aircraft, 'name') : '',
      reg: aircraft ? getText(aircraft, 'reg') || null : null,
      selcal: aircraft ? getText(aircraft, 'selcal') || null : null,
      fin: aircraft ? getText(aircraft, 'fin') || null : null,
      base: aircraft ? getText(aircraft, 'base') || null : null,
    },
    fuel: {
      taxi: fuel ? getText(fuel, 'taxi') : '0',
      enroute_burn: fuel ? getText(fuel, 'enroute_burn') : '0',
      contingency: fuel ? getText(fuel, 'contingency') : '0',
      alternate_burn: fuel ? getText(fuel, 'alternate_burn') : '0',
      reserve: fuel ? getText(fuel, 'reserve') : '0',
      etops: fuel ? getText(fuel, 'etops') : '0',
      extra: fuel ? getText(fuel, 'extra') : '0',
      min_takeoff: fuel ? getText(fuel, 'min_takeoff') : '0',
      plan_takeoff: fuel ? getText(fuel, 'plan_takeoff') : '0',
      plan_ramp: fuel ? getText(fuel, 'plan_ramp') : '0',
      plan_landing: fuel ? getText(fuel, 'plan_landing') : '0',
      avg_fuel_flow: fuel ? getText(fuel, 'avg_fuel_flow') : '0',
      max_tanks: fuel ? getText(fuel, 'max_tanks') : '0',
    },
    weights: {
      oew: weights ? getText(weights, 'oew') : '0',
      pax_count: weights ? getText(weights, 'pax_count') : '0',
      bag_count: weights ? getText(weights, 'bag_count') : '0',
      pax_weight: weights ? getText(weights, 'pax_weight') : '0',
      bag_weight: weights ? getText(weights, 'bag_weight') : '0',
      cargo: weights ? getText(weights, 'cargo') : '0',
      payload: weights ? getText(weights, 'payload') : '0',
      est_zfw: weights ? getText(weights, 'est_zfw') : '0',
      max_zfw: weights ? getText(weights, 'max_zfw') : '0',
      est_tow: weights ? getText(weights, 'est_tow') : '0',
      max_tow: weights ? getText(weights, 'max_tow') : '0',
      est_ldw: weights ? getText(weights, 'est_ldw') : '0',
      max_ldw: weights ? getText(weights, 'max_ldw') : '0',
    },
    times: {
      sched_out: times ? getText(times, 'sched_out') : '',
      sched_off: times ? getText(times, 'sched_off') : '',
      sched_on: times ? getText(times, 'sched_on') : '',
      sched_in: times ? getText(times, 'sched_in') : '',
      sched_block: times ? getText(times, 'sched_block') : '',
      est_time_enroute: times ? getText(times, 'est_time_enroute') : '0',
      est_out: times ? getText(times, 'est_out') : '',
      est_off: times ? getText(times, 'est_off') : '',
      est_on: times ? getText(times, 'est_on') : '',
      est_in: times ? getText(times, 'est_in') : '',
      est_block: times ? getText(times, 'est_block') : '',
    },
    atc: {
      callsign: atc ? getText(atc, 'callsign') : '',
      flightplan_text: atc ? getText(atc, 'flightplan_text') : '',
    },
    navlog,
    images: {
      maps,
    },
    links: {
      skyvector: general ? getText(general, 'dx_rmk') || null : null,
    },
    text: textEl?.textContent || '',
    files: {
      pdf: {
        link: files ? getText(files, 'directory') : '',
      },
    },
  };
}
