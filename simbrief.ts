/**
 * SimBrief API Integration Utilities
 * 
 * This module provides utilities for interacting with the SimBrief API
 * for generating flight plans via the VA Integration API.
 * 
 * Based on the official SimBrief APIv1 JS flow:
 * 1. Open popup to SimBrief worker URL with form params
 * 2. When popup closes, calculate ofp_id = timestamp + '_' + md5(orig+dest+type)
 * 3. Verify OFP exists on server
 * 4. Redirect PARENT window to callback with ofp_id
 */

import { supabase } from '@/integrations/supabase/client';

// SimBrief worker URL
const SIMBRIEF_WORKER_URL = 'https://www.simbrief.com/ofp/ofp.loader.api.php';

// Storage key for pending OFP
const PENDING_OFP_KEY = 'pendingSimBriefOFP';

export interface SimBriefFormData {
  // Required fields
  orig: string;        // Departure ICAO
  dest: string;        // Arrival ICAO
  type: string;        // Aircraft type ICAO code
  
  // Optional flight info
  airline?: string;    // Airline code (e.g., "AFL")
  fltnum?: string;     // Flight number
  route?: string;      // Route string
  
  // Optional date/time
  date?: string;       // Departure date (e.g., "01JAN24")
  deph?: string;       // Departure hour (0-23)
  depm?: string;       // Departure minute (0-59)
  
  // Optional aircraft info
  reg?: string;        // Aircraft registration
  selcal?: string;     // SELCAL code
  
  // Optional fuel/weight options
  units?: 'KGS' | 'LBS';
  contpct?: string;    // Contingency fuel percentage
  resvrule?: string;   // Reserve fuel minutes
  
  // Optional flight options
  navlog?: '0' | '1';
  etops?: '0' | '1';
  stepclimbs?: '0' | '1';
  tlr?: '0' | '1';     // Runway analysis
  notams?: '0' | '1';
  firnot?: '0' | '1';  // FIR NOTAMs
  maps?: 'detail' | 'simple' | 'none';
  planformat?: string; // OFP layout (e.g., "lido")
  
  // Scheduled time enroute
  steh?: string;       // Hours
  stem?: string;       // Minutes
  
  // Cargo weight
  cargo?: string;      // Cargo weight in units
}

export interface PendingOFPData {
  deliveryId: string;
  contractId: string;
  timestamp: number;
  formData: SimBriefFormData;
}

/**
 * MD5 hash function (browser-compatible, matches SimBrief's PHP md5)
 * This is the same implementation used by SimBrief's JS API
 */
function md5(str: string): string {
  const rotateLeft = (lValue: number, iShiftBits: number) => {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  };

  const addUnsigned = (lX: number, lY: number) => {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  };

  const _F = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const _G = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const _H = (x: number, y: number, z: number) => x ^ y ^ z;
  const _I = (x: number, y: number, z: number) => y ^ (x | ~z);

  const _FF = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(_F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };
  const _GG = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(_G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };
  const _HH = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(_H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };
  const _II = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(_I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };

  const convertToWordArray = (str: string) => {
    const lMessageLength = str.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray: number[] = new Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] || 0) | (str.charCodeAt(lByteCount) << lBytePosition);
      lByteCount++;
    }
    const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = (lWordArray[lWordCount] || 0) | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  };

  const wordToHex = (lValue: number) => {
    let wordToHexValue = '';
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255;
      const wordToHexValue_temp = '0' + lByte.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2);
    }
    return wordToHexValue;
  };

  const utf8Encode = (argString: string) => {
    let utftext = '';
    for (let n = 0; n < argString.length; n++) {
      const c = argString.charCodeAt(n);
      if (c < 128) {
        utftext += String.fromCharCode(c);
      } else if (c > 127 && c < 2048) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      } else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }
    return utftext;
  };

  str = utf8Encode(str);
  const x = convertToWordArray(str);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = _FF(a, b, c, d, x[k + 0] || 0, S11, 0xd76aa478);
    d = _FF(d, a, b, c, x[k + 1] || 0, S12, 0xe8c7b756);
    c = _FF(c, d, a, b, x[k + 2] || 0, S13, 0x242070db);
    b = _FF(b, c, d, a, x[k + 3] || 0, S14, 0xc1bdceee);
    a = _FF(a, b, c, d, x[k + 4] || 0, S11, 0xf57c0faf);
    d = _FF(d, a, b, c, x[k + 5] || 0, S12, 0x4787c62a);
    c = _FF(c, d, a, b, x[k + 6] || 0, S13, 0xa8304613);
    b = _FF(b, c, d, a, x[k + 7] || 0, S14, 0xfd469501);
    a = _FF(a, b, c, d, x[k + 8] || 0, S11, 0x698098d8);
    d = _FF(d, a, b, c, x[k + 9] || 0, S12, 0x8b44f7af);
    c = _FF(c, d, a, b, x[k + 10] || 0, S13, 0xffff5bb1);
    b = _FF(b, c, d, a, x[k + 11] || 0, S14, 0x895cd7be);
    a = _FF(a, b, c, d, x[k + 12] || 0, S11, 0x6b901122);
    d = _FF(d, a, b, c, x[k + 13] || 0, S12, 0xfd987193);
    c = _FF(c, d, a, b, x[k + 14] || 0, S13, 0xa679438e);
    b = _FF(b, c, d, a, x[k + 15] || 0, S14, 0x49b40821);
    a = _GG(a, b, c, d, x[k + 1] || 0, S21, 0xf61e2562);
    d = _GG(d, a, b, c, x[k + 6] || 0, S22, 0xc040b340);
    c = _GG(c, d, a, b, x[k + 11] || 0, S23, 0x265e5a51);
    b = _GG(b, c, d, a, x[k + 0] || 0, S24, 0xe9b6c7aa);
    a = _GG(a, b, c, d, x[k + 5] || 0, S21, 0xd62f105d);
    d = _GG(d, a, b, c, x[k + 10] || 0, S22, 0x02441453);
    c = _GG(c, d, a, b, x[k + 15] || 0, S23, 0xd8a1e681);
    b = _GG(b, c, d, a, x[k + 4] || 0, S24, 0xe7d3fbc8);
    a = _GG(a, b, c, d, x[k + 9] || 0, S21, 0x21e1cde6);
    d = _GG(d, a, b, c, x[k + 14] || 0, S22, 0xc33707d6);
    c = _GG(c, d, a, b, x[k + 3] || 0, S23, 0xf4d50d87);
    b = _GG(b, c, d, a, x[k + 8] || 0, S24, 0x455a14ed);
    a = _GG(a, b, c, d, x[k + 13] || 0, S21, 0xa9e3e905);
    d = _GG(d, a, b, c, x[k + 2] || 0, S22, 0xfcefa3f8);
    c = _GG(c, d, a, b, x[k + 7] || 0, S23, 0x676f02d9);
    b = _GG(b, c, d, a, x[k + 12] || 0, S24, 0x8d2a4c8a);
    a = _HH(a, b, c, d, x[k + 5] || 0, S31, 0xfffa3942);
    d = _HH(d, a, b, c, x[k + 8] || 0, S32, 0x8771f681);
    c = _HH(c, d, a, b, x[k + 11] || 0, S33, 0x6d9d6122);
    b = _HH(b, c, d, a, x[k + 14] || 0, S34, 0xfde5380c);
    a = _HH(a, b, c, d, x[k + 1] || 0, S31, 0xa4beea44);
    d = _HH(d, a, b, c, x[k + 4] || 0, S32, 0x4bdecfa9);
    c = _HH(c, d, a, b, x[k + 7] || 0, S33, 0xf6bb4b60);
    b = _HH(b, c, d, a, x[k + 10] || 0, S34, 0xbebfbc70);
    a = _HH(a, b, c, d, x[k + 13] || 0, S31, 0x289b7ec6);
    d = _HH(d, a, b, c, x[k + 0] || 0, S32, 0xeaa127fa);
    c = _HH(c, d, a, b, x[k + 3] || 0, S33, 0xd4ef3085);
    b = _HH(b, c, d, a, x[k + 6] || 0, S34, 0x04881d05);
    a = _HH(a, b, c, d, x[k + 9] || 0, S31, 0xd9d4d039);
    d = _HH(d, a, b, c, x[k + 12] || 0, S32, 0xe6db99e5);
    c = _HH(c, d, a, b, x[k + 15] || 0, S33, 0x1fa27cf8);
    b = _HH(b, c, d, a, x[k + 2] || 0, S34, 0xc4ac5665);
    a = _II(a, b, c, d, x[k + 0] || 0, S41, 0xf4292244);
    d = _II(d, a, b, c, x[k + 7] || 0, S42, 0x432aff97);
    c = _II(c, d, a, b, x[k + 14] || 0, S43, 0xab9423a7);
    b = _II(b, c, d, a, x[k + 5] || 0, S44, 0xfc93a039);
    a = _II(a, b, c, d, x[k + 12] || 0, S41, 0x655b59c3);
    d = _II(d, a, b, c, x[k + 3] || 0, S42, 0x8f0ccc92);
    c = _II(c, d, a, b, x[k + 10] || 0, S43, 0xffeff47d);
    b = _II(b, c, d, a, x[k + 1] || 0, S44, 0x85845dd1);
    a = _II(a, b, c, d, x[k + 8] || 0, S41, 0x6fa87e4f);
    d = _II(d, a, b, c, x[k + 15] || 0, S42, 0xfe2ce6e0);
    c = _II(c, d, a, b, x[k + 6] || 0, S43, 0xa3014314);
    b = _II(b, c, d, a, x[k + 13] || 0, S44, 0x4e0811a1);
    a = _II(a, b, c, d, x[k + 4] || 0, S41, 0xf7537e82);
    d = _II(d, a, b, c, x[k + 11] || 0, S42, 0xbd3af235);
    c = _II(c, d, a, b, x[k + 2] || 0, S43, 0x2ad7d2bb);
    b = _II(b, c, d, a, x[k + 9] || 0, S44, 0xeb86d391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

/**
 * Store pending OFP data for retrieval after redirect
 */
export function storePendingOFP(data: PendingOFPData): void {
  sessionStorage.setItem(PENDING_OFP_KEY, JSON.stringify(data));
}

/**
 * Retrieve and clear pending OFP data
 */
export function getPendingOFP(): PendingOFPData | null {
  const data = sessionStorage.getItem(PENDING_OFP_KEY);
  if (data) {
    sessionStorage.removeItem(PENDING_OFP_KEY);
    return JSON.parse(data);
  }
  return null;
}

/**
 * Calculate OFP ID from timestamp and form data
 * Format: timestamp_HASH where HASH is first 10 chars of MD5 hash in uppercase
 * Example output: 1769239995_A33F87B1DF
 * This matches SimBrief's internal ofp_id calculation
 */
export function calculateOfpId(timestamp: number, orig: string, dest: string, type: string): string {
  const fullHash = md5(orig.toUpperCase() + dest.toUpperCase() + type);
  // SimBrief uses only the first 10 characters of the MD5 hash, in uppercase
  const shortHash = fullHash.substring(0, 10).toUpperCase();
  return `${timestamp}_${shortHash}`;
}

/**
 * Open SimBrief popup window for flight plan generation
 */
export async function openSimBriefPopup(
  formData: SimBriefFormData,
  outputPage: string
): Promise<{ popup: Window | null; timestamp: number }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const orig = formData.orig.toUpperCase();
  const dest = formData.dest.toUpperCase();
  const type = formData.type;
  
  // SimBrief requires outputpage without protocol
  const outputPageForApi = outputPage.replace(/^https?:\/\//, '');
  
  // Get API code from backend edge function
  const { data: apiCodeData, error: apiCodeError } = await supabase.functions.invoke(
    'simbrief-api',
    {
      body: {
        action: 'generate_api_code',
        orig,
        dest,
        type,
        timestamp,
        outputpage: outputPageForApi
      }
    }
  );

  if (apiCodeError || !apiCodeData?.api_code) {
    throw new Error(apiCodeError?.message || 'Failed to generate API code');
  }

  const apiCode = apiCodeData.api_code;

  // Build the SimBrief worker URL with all parameters
  const workerUrl = new URL(SIMBRIEF_WORKER_URL);
  
  // Required params
  workerUrl.searchParams.set('orig', orig);
  workerUrl.searchParams.set('dest', dest);
  workerUrl.searchParams.set('type', type);
  workerUrl.searchParams.set('apicode', apiCode);
  workerUrl.searchParams.set('timestamp', timestamp.toString());
  workerUrl.searchParams.set('outputpage', outputPageForApi);

  // Optional params
  if (formData.route) workerUrl.searchParams.set('route', formData.route);
  if (formData.airline) workerUrl.searchParams.set('airline', formData.airline);
  if (formData.fltnum) workerUrl.searchParams.set('fltnum', formData.fltnum);
  if (formData.date) workerUrl.searchParams.set('date', formData.date);
  if (formData.deph) workerUrl.searchParams.set('deph', formData.deph);
  if (formData.depm) workerUrl.searchParams.set('depm', formData.depm);
  if (formData.reg) workerUrl.searchParams.set('reg', formData.reg);
  if (formData.selcal) workerUrl.searchParams.set('selcal', formData.selcal);
  if (formData.units) workerUrl.searchParams.set('units', formData.units);
  if (formData.contpct) workerUrl.searchParams.set('contpct', formData.contpct);
  if (formData.resvrule) workerUrl.searchParams.set('resvrule', formData.resvrule);
  if (formData.navlog) workerUrl.searchParams.set('navlog', formData.navlog);
  if (formData.etops) workerUrl.searchParams.set('etops', formData.etops);
  if (formData.stepclimbs) workerUrl.searchParams.set('stepclimbs', formData.stepclimbs);
  if (formData.tlr) workerUrl.searchParams.set('tlr', formData.tlr);
  if (formData.notams) workerUrl.searchParams.set('notams', formData.notams);
  if (formData.firnot) workerUrl.searchParams.set('firnot', formData.firnot);
  if (formData.maps) workerUrl.searchParams.set('maps', formData.maps);
  if (formData.planformat) workerUrl.searchParams.set('planformat', formData.planformat);
  if (formData.cargo) workerUrl.searchParams.set('cargo', formData.cargo);

  console.log('Opening SimBrief popup:', workerUrl.toString());

  // Calculate popup position
  const popupWidth = 600;
  const popupHeight = 400;
  const left = (window.screen.width - popupWidth) / 2;
  const top = (window.screen.height - popupHeight) / 2;
  
  // Open popup
  const popup = window.open(
    workerUrl.toString(),
    'SimBriefDispatch',
    `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes`
  );
  
  if (!popup) {
    throw new Error('Please disable your pop-up blocker to generate a flight plan!');
  }
  
  popup.focus();
  
  return { popup, timestamp };
}

/**
 * Monitor popup and redirect parent window when done
 * Like SimBrief JS API - when popup closes, redirect parent to viewer with ofp_id
 * The VIEWER page handles fetching the OFP, not the generator
 */
export function monitorSimBriefPopup(
  popup: Window,
  formData: SimBriefFormData,
  timestamp: number,
  onComplete: (ofpId: string) => void,
  onTimeout?: () => void
): () => void {
  let checkCount = 0;
  const maxChecks = 360; // 3 minutes max wait
  
  const checkInterval = window.setInterval(() => {
    checkCount++;
    
    if (popup.closed) {
      window.clearInterval(checkInterval);
      console.log('SimBrief popup closed');
      
      // Calculate ofp_id exactly like SimBrief JS API does
      const ofpId = calculateOfpId(timestamp, formData.orig, formData.dest, formData.type);
      console.log('Calculated OFP ID:', ofpId);
      
      // Redirect to viewer - the viewer will fetch the OFP
      onComplete(ofpId);
    } else if (checkCount >= maxChecks) {
      window.clearInterval(checkInterval);
      if (onTimeout) onTimeout();
    }
  }, 500);
  
  return () => window.clearInterval(checkInterval);
}
