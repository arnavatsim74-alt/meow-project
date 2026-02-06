import { supabase } from '@/integrations/supabase/client';
import md5 from 'blueimp-md5';

export interface SimBriefFormData {
  orig: string;
  dest: string;
  type: string;
  airline?: string;
  fltnum?: string;
  reg?: string;
  units?: string;
  contpct?: string;
  resvrule?: string;
  navlog?: string;
  etops?: string;
  stepclimbs?: string;
  tlr?: string;
  notams?: string;
  firnot?: string;
  maps?: string;
  planformat?: string;
  cargo?: string;
  pax?: string;
  route?: string;
}

export interface PendingOFP {
  formData: SimBriefFormData;
  timestamp: number;
  dispatchLegId?: string;
}

// Store pending OFP data in sessionStorage
export function storePendingOFP(data: PendingOFP): void {
  sessionStorage.setItem('pending_ofp', JSON.stringify(data));
}

// Retrieve pending OFP data
export function getPendingOFP(): PendingOFP | null {
  const data = sessionStorage.getItem('pending_ofp');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Clear pending OFP data
export function clearPendingOFP(): void {
  sessionStorage.removeItem('pending_ofp');
  localStorage.removeItem('simbrief_ofp_id');
}

// Calculate OFP ID based on form params and timestamp
// Format: {timestamp}_{MD5_HASH_FIRST_10_CHARS_UPPERCASE}
// Example: 1769239995_A33F87B1DF
export function calculateOfpId(timestamp: number, orig: string, dest: string, type: string): string {
  const fullHash = md5(orig.toUpperCase() + dest.toUpperCase() + type);
  const shortHash = fullHash.substring(0, 10).toUpperCase();
  return `${timestamp}_${shortHash}`;
}

// Open SimBrief popup with form data
export async function openSimBriefPopup(
  formData: SimBriefFormData,
  outputPage: string
): Promise<{ popup: Window | null; timestamp: number }> {
  const timestamp = Math.floor(Date.now() / 1000);

  // Use the exact outputpage value for both API code generation and the SimBrief request
  const outputpage = outputPage;

  // Get API code from backend
  const { data, error } = await supabase.functions.invoke('simbrief-api', {
    body: {
      action: 'generate_api_code',
      orig: formData.orig.toUpperCase(),
      dest: formData.dest.toUpperCase(),
      type: formData.type,
      timestamp,
      outputpage,
    },
  });

  if (error || !data?.api_code) {
    console.error('Failed to get API code:', error || data?.error);
    throw new Error('Failed to generate API code');
  }

  // Build SimBrief URL with all parameters
  const simbriefUrl = new URL('https://www.simbrief.com/ofp/ofp.loader.api.php');
  const params = new URLSearchParams();
  
  // Required params
  params.set('apicode', data.api_code);
  params.set('outputpage', outputpage);
  params.set('timestamp', timestamp.toString());
  params.set('orig', formData.orig.toUpperCase());
  params.set('dest', formData.dest.toUpperCase());
  params.set('type', formData.type);
  
  
  // Optional params
  if (formData.airline) params.set('airline', formData.airline);
  if (formData.fltnum) params.set('fltnum', formData.fltnum);
  if (formData.reg) params.set('reg', formData.reg);
  if (formData.units) params.set('units', formData.units);
  if (formData.contpct) params.set('contpct', formData.contpct);
  if (formData.resvrule) params.set('resvrule', formData.resvrule);
  if (formData.navlog) params.set('navlog', formData.navlog);
  if (formData.etops) params.set('etops', formData.etops);
  if (formData.stepclimbs) params.set('stepclimbs', formData.stepclimbs);
  if (formData.tlr) params.set('tlr', formData.tlr);
  if (formData.notams) params.set('notams', formData.notams);
  if (formData.firnot) params.set('firnot', formData.firnot);
  if (formData.maps) params.set('maps', formData.maps);
  if (formData.planformat) params.set('planformat', formData.planformat);
  if (formData.cargo) params.set('cargo', formData.cargo);
  if (formData.pax) params.set('pax', formData.pax);
  if (formData.route) params.set('route', formData.route);

  simbriefUrl.search = params.toString();
  
  console.log('Opening SimBrief popup:', simbriefUrl.toString());
  
  // Open popup
  const popup = window.open(
    simbriefUrl.toString(),
    'SimBriefDispatch',
    'width=1200,height=800,resizable=yes,scrollbars=yes'
  );
  
  return { popup, timestamp };
}

// Monitor SimBrief popup and handle callback
export function monitorSimBriefPopup(
  popup: Window,
  formData: SimBriefFormData,
  timestamp: number,
  onComplete: (ofpId: string) => void,
  onTimeout: () => void,
  timeoutMs: number = 600000 // 10 minutes default
): () => void {
  const startTime = Date.now();
  
  const checkInterval = setInterval(() => {
    // Check if popup was closed
    if (popup.closed) {
      clearInterval(checkInterval);
      
      // Check if we got an ofp_id from the callback (stored by the popup)
      const ofpId = localStorage.getItem('simbrief_ofp_id');
      if (ofpId) {
        localStorage.removeItem('simbrief_ofp_id');
        onComplete(ofpId);
      } else {
        // No ofp_id but popup closed - calculate expected ID as fallback
        const calculatedId = calculateOfpId(timestamp, formData.orig, formData.dest, formData.type);
        onComplete(calculatedId);
      }
      return;
    }
    
    // Check for timeout
    if (Date.now() - startTime > timeoutMs) {
      clearInterval(checkInterval);
      popup.close();
      onTimeout();
      return;
    }
  }, 500);
  
  // Return cleanup function
  return () => {
    clearInterval(checkInterval);
  };
}
