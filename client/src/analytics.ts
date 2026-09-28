/**
 * Google Analytics 4 (GA4) helpers.
 * Uses the configured env var when present, otherwise falls back to the site's Google tag ID.
 */

const DEFAULT_MEASUREMENT_ID = 'G-TQ2V2Q97YW';
const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) || DEFAULT_MEASUREMENT_ID;

function loadGtag(): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag === 'function') return;
  if (!MEASUREMENT_ID) return;
  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

let initialized = false;

export function initGA(): void {
  if (initialized || !MEASUREMENT_ID) return;
  initialized = true;
  loadGtag();
}

export function pageView(path: string, title?: string): void {
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
