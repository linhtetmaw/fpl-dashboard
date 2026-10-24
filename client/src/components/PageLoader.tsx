import { useEffect, useRef, useState, type RefObject } from 'react';
import { useIsFetching } from '@tanstack/react-query';

/** Pages already shown in this visit: going back to one opens it straight away. */
const seen = new Set<string>();

/** Always show the loader this long (no flicker), and never longer than the cap (a slow image never blocks). */
const MIN_MS = 500;
const MAX_MS = 3000;
const FADE_MS = 250;

/** Images in the page that are on screen and still downloading (lazy ones further down don't count). */
function imagesPending(root: HTMLElement | null): boolean {
  if (!root) return false;
  return [...root.querySelectorAll('img')].some((img) => {
    if (img.complete) return false;
    const r = img.getBoundingClientRect();
    return r.width > 0 && r.top < window.innerHeight && r.bottom > 0;
  });
}

/**
 * The FPL House logo, its three bars bobbing, over the whole screen the first time each page is opened: it stays
 * until the page's first data has arrived and the photos and badges on screen have loaded, then fades out. It
 * continues the loader index.html shows before the app starts (styles live there too), so the first visit is seamless.
 */
export default function PageLoader({ path, contentRef }: { path: string; contentRef: RefObject<HTMLElement> }) {
  const [phase, setPhase] = useState<'hidden' | 'showing' | 'fading'>(() => (seen.has(path) ? 'hidden' : 'showing'));
  // First loads of data this page shows (it has observers and no data yet): not background refreshes, and not a
  // previous page's requests still finishing.
  const fetching = useIsFetching({ predicate: (q) => q.getObserversCount() > 0 && q.state.data === undefined });
  const fetchingRef = useRef(fetching);
  fetchingRef.current = fetching;

  useEffect(() => {
    if (seen.has(path)) {
      setPhase('hidden');
      return;
    }
    setPhase('showing');
    const started = Date.now();
    let fadeTimer = 0;
    const poll = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const ready = fetchingRef.current === 0 && !imagesPending(contentRef.current);
      if (elapsed >= MAX_MS || (elapsed >= MIN_MS && ready)) {
        window.clearInterval(poll);
        seen.add(path);
        setPhase('fading');
        fadeTimer = window.setTimeout(() => setPhase('hidden'), FADE_MS);
      }
    }, 100);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(fadeTimer);
    };
  }, [path, contentRef]);

  if (phase === 'hidden') return null;
  return (
    <div className="fplh-loader" style={phase === 'fading' ? { opacity: 0 } : undefined} role="status" aria-label="Loading">
      <svg viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#37003C" />
        <polygon className="fplh-bar" points="12,52 12,33 23,24 23,52" fill="#FFFFFF" />
        <polygon className="fplh-bar fplh-bar-2" points="26,52 26,21 32,15 38,21 38,52" fill="#00FF85" />
        <polygon className="fplh-bar fplh-bar-3" points="41,52 41,24 52,33 52,52" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
