import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * SimBrief Callback Page
 * 
 * This page is the outputpage target for SimBrief popup.
 * SimBrief redirects the POPUP here with ofp_id parameter.
 * 
 * Since this runs in the popup (not parent window), we need to
 * communicate back to the parent window and close this popup.
 * 
 * The parent window (OFP Generator) monitors for popup closure
 * and handles the redirect to OFP viewer.
 */
export default function SimBriefCallback() {
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const ofpId = searchParams.get("ofp_id");
    
    if (ofpId) {
      console.log('SimBrief callback received ofp_id:', ofpId);
      
      // Persist the ofp_id so the parent window can retrieve it
      // (localStorage is shared across windows on the same origin; sessionStorage is not)
      localStorage.setItem('simbrief_ofp_id', ofpId);

      // Also try to message the opener directly (best-effort)
      try {
        window.opener?.postMessage({ type: 'SIMBRIEF_OFP_ID', ofpId }, window.location.origin);
      } catch {
        // ignore
      }

      // Close this popup - the parent window will handle redirect
      // We wait a moment to ensure storage/message is delivered
      setTimeout(() => {
        window.close();
      }, 500);
    } else {
      // No ofp_id means generation was cancelled or failed
      console.log('SimBrief callback: no ofp_id received');
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Flight Plan Generated!</h2>
        <p className="text-muted-foreground">Closing this window...</p>
      </div>
    </div>
  );
}
