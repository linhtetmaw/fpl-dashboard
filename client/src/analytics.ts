/**
 * Google Analytics 4 (GA4) helpers.
 * Set VITE_GA_MEASUREMENT_ID in .env (e.g. G-XXXXXXXXXX) to enable tracking.
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

function loadGtag(): void {
  if (typeof window === 'undefined' || !MEASUREMENT_ID) return;
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
