/**
 * Google Analytics 4 (GA4) helpers.
 * Uses the configured env var when present, otherwise falls back to the site's Google tag ID.
 */

const DEFAULT_MEASUREMENT_ID = 'G-TQ2V2Q97YW';
const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || DEFAULT_MEASUREMENT_ID;

function loadGtag(): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag === 'function') {
    // #region agent log
    fetch('http://127.0.0.1:7265/ingest/4d7ea2c2-d18f-4d14-9be4-518c22545374',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c16caa'},body:JSON.stringify({sessionId:'c16caa',runId:'post-fix',hypothesisId:'H4',location:'client/src/analytics.ts:loadGtag',message:'Existing Google tag detected',data:{measurementId:MEASUREMENT_ID},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return;
  }
  if (!MEASUREMENT_ID) {
    // #region agent log
    fetch('http://127.0.0.1:7265/ingest/4d7ea2c2-d18f-4d14-9be4-518c22545374',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c16caa'},body:JSON.stringify({sessionId:'c16caa',runId:'pre-fix',hypothesisId:'H1',location:'client/src/analytics.ts:loadGtag',message:'GA measurement ID missing',data:{hasMeasurementId:false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return;
  }
  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  script.onload = () => {
    // #region agent log
    fetch('http://127.0.0.1:7265/ingest/4d7ea2c2-d18f-4d14-9be4-518c22545374',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c16caa'},body:JSON.stringify({sessionId:'c16caa',runId:'pre-fix',hypothesisId:'H2',location:'client/src/analytics.ts:script.onload',message:'GA script loaded',data:{measurementId:MEASUREMENT_ID},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  };
  script.onerror = () => {
    // #region agent log
    fetch('http://127.0.0.1:7265/ingest/4d7ea2c2-d18f-4d14-9be4-518c22545374',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c16caa'},body:JSON.stringify({sessionId:'c16caa',runId:'pre-fix',hypothesisId:'H2',location:'client/src/analytics.ts:script.onerror',message:'GA script failed to load',data:{measurementId:MEASUREMENT_ID,src:script.src},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  };
  document.head.appendChild(script);
}

let initialized = false;

export function initGA(): void {
  if (initialized || !MEASUREMENT_ID) return;
  initialized = true;
  loadGtag();
}

export function pageView(path: string, title?: string): void {
  // #region agent log
  fetch('http://127.0.0.1:7265/ingest/4d7ea2c2-d18f-4d14-9be4-518c22545374',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c16caa'},body:JSON.stringify({sessionId:'c16caa',runId:'pre-fix',hypothesisId:'H3',location:'client/src/analytics.ts:pageView',message:'Page view invoked',data:{path,hasMeasurementId:Boolean(MEASUREMENT_ID),hasGtag:typeof window !== 'undefined' && typeof window.gtag === 'function'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (typeof window === 'undefined' || !window.gtag || !MEASUREMENT_ID) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title ?? document.title,
  });
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag || !MEASUREMENT_ID) return;
  window.gtag('event', name, params);
}
