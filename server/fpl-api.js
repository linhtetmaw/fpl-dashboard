/**
 * Shared, cached access to the FPL API. Every server call to fantasy.premierleague.com should go through fplGet so
 * that, however many visitors we have, FPL sees roughly one request per resource per cache period.
 *
 * - In-memory cache with a time-to-live per kind of data (see ttlFor): live points refresh every minute, while
 *   things that can no longer change (a team's picks after the deadline, finished gameweeks) are kept for hours.
 * - Identical requests in flight at the same moment share one upstream call.
 * - At most MAX_CONCURRENT upstream requests run at once; the rest queue, so bursts don't hammer FPL.
 * - If FPL errors or times out, a recently expired copy is served instead (stale-if-error).
 * - Memory is capped at MAX_BYTES; least recently used entries are dropped first.
 */
const FPL_BASE = 'https://fantasy.premierleague.com/api';
const UA = 'Mozilla/5.0 (compatible; FPLDashboard/1.0; +https://fantasy.premierleague.com)';
const TIMEOUT_MS = 15000;
const MAX_CONCURRENT = 16;
const MAX_BYTES = 150 * 1024 * 1024;
/** How long after expiry an entry may still be served when FPL is failing. */
const STALE_IF_ERROR_MS = 15 * 60 * 1000;
/** Not-found answers (e.g. picks for a gameweek that hasn't started) are remembered briefly. */
const NOT_FOUND_TTL_MS = 60 * 1000;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
/** Fixtures (minute, score) and live points of a gameweek that has started. */
const LIVE_TTL = 30 * 1000;

export class FplError extends Error {
  constructor(status, message) {
    super(message ?? `FPL API error ${status}`);
    this.status = status;
  }
}

/** @type {Map<string, { data?: unknown, error?: FplError, bytes: number, expires: number }>} */
const cache = new Map();
const inflight = new Map();
let cachedBytes = 0;
const stats = { hits: 0, misses: 0, stale: 0, errors: 0, upstream: 0 };

let active = 0;
const queue = [];
async function withSlot(fn) {
  if (active >= MAX_CONCURRENT) await new Promise((resolve) => queue.push(resolve));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

function store(key, value, ttl) {
  const old = cache.get(key);
  if (old) {
    cachedBytes -= old.bytes;
    cache.delete(key);
  }
  cache.set(key, { ...value, expires: Date.now() + ttl });
  cachedBytes += value.bytes;
  for (const [k, v] of cache) {
    if (cachedBytes <= MAX_BYTES) break;
    cache.delete(k);
    cachedBytes -= v.bytes;
  }
}

/** Gameweek facts from the cached bootstrap (no fetch). */
function eventInfo(gw) {
  const events = cache.get('/bootstrap-static/')?.data?.events;
  const ev = Array.isArray(events) ? events.find((e) => e.id === gw) : null;
  if (!ev) return null;
  return { finished: Boolean(ev.finished && ev.data_checked), deadlinePassed: new Date(ev.deadline_time).getTime() <= Date.now() };
}

/** How long each kind of FPL response stays fresh. */
export function ttlFor(path) {
  let m;
  if (path === '/bootstrap-static/') return 5 * MIN;
  // Live points and match minutes: every 30 seconds while the gameweek is under way (FPL itself moves the minute
  // about once a minute), so the site trails FPL by well under a minute.
  if ((m = path.match(/^\/event\/(\d+)\/live\/$/))) {
    const ev = eventInfo(Number(m[1]));
    return ev?.finished ? 6 * HOUR : ev?.deadlinePassed ? LIVE_TTL : MIN;
  }
  if ((m = path.match(/^\/entry\/\d+\/event\/(\d+)\/picks\/$/))) {
    // Picks are locked at the deadline.
    return eventInfo(Number(m[1]))?.deadlinePassed ? 6 * HOUR : MIN;
  }
  if ((m = path.match(/^\/fixtures\/\?event=(\d+)$/))) {
    const ev = eventInfo(Number(m[1]));
    return ev?.finished ? HOUR : ev?.deadlinePassed ? LIVE_TTL : 2 * MIN;
  }
  if (path.startsWith('/fixtures/')) return 2 * MIN;
  // History is used for transfer hits, team value and past GW points, none of which move during a live
  // gameweek (live points come from /event/N/live/), so it can be cached for longer.
  if (/^\/entry\/\d+\/history\/$/.test(path)) return 30 * MIN;
  if (/^\/entry\/\d+\/$/.test(path)) return 5 * MIN;
  if (path.startsWith('/leagues-classic/')) return 2 * MIN;
  if (path.startsWith('/element-summary/')) return 10 * MIN;
  return MIN;
}

/** Normalise "/x/?b=2&a=1" to "/x/?a=1&b=2" so equal requests share a cache entry. */
export function cacheKey(path, query) {
  const params = new URLSearchParams(query ?? '');
  params.sort();
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function fetchUpstream(key) {
  stats.upstream += 1;
  const res = await withSlot(() =>
    fetch(`${FPL_BASE}${key}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  );
  if (!res.ok) throw new FplError(res.status);
  const text = await res.text();
  return { data: JSON.parse(text), bytes: text.length };
}

/**
 * GET an FPL API path (e.g. "/bootstrap-static/", "/fixtures/?event=7") as parsed JSON, from cache when fresh.
 * Throws FplError (with .status) when FPL answers with an error and no usable cached copy exists.
 * Callers must not modify the returned object: it is shared with other requests.
 */
export async function fplGet(path, { ttl } = {}) {
  const [p, q] = path.split('?');
  const key = cacheKey(p, q);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    stats.hits += 1;
    cache.delete(key); // refresh LRU position
    cache.set(key, hit);
    if (hit.error) throw hit.error;
    return hit.data;
  }
  if (inflight.has(key)) return inflight.get(key);

  stats.misses += 1;
  const promise = fetchUpstream(key)
    .then((value) => {
      store(key, value, ttl ?? ttlFor(key));
      return value.data;
    })
    .catch((err) => {
      stats.errors += 1;
      const status = err instanceof FplError ? err.status : 502;
      if (status === 404) {
        const error = new FplError(404);
        store(key, { error, bytes: 64 }, NOT_FOUND_TTL_MS);
        throw error;
      }
      // FPL down, rate limiting or timing out: fall back to a recent copy if we have one.
      if (hit?.data !== undefined && Date.now() - hit.expires < STALE_IF_ERROR_MS) {
        stats.stale += 1;
        return hit.data;
      }
      throw err instanceof FplError ? err : new FplError(502, `FPL API unreachable: ${err.message}`);
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Cache any computed value (e.g. a league table built from many FPL calls) with the same in-flight sharing. */
const memoCache = new Map();
const memoInflight = new Map();
const MAX_MEMO = 2000;
export async function memo(key, ttl, compute) {
  const hit = memoCache.get(key);
  if (hit && hit.expires > Date.now()) {
    stats.hits += 1;
    return hit.value;
  }
  if (memoInflight.has(key)) return memoInflight.get(key);
  stats.misses += 1;
  const promise = compute()
    .then((value) => {
      memoCache.delete(key);
      memoCache.set(key, { value, expires: Date.now() + ttl });
      if (memoCache.size > MAX_MEMO) memoCache.delete(memoCache.keys().next().value);
      return value;
    })
    .finally(() => memoInflight.delete(key));
  memoInflight.set(key, promise);
  return promise;
}

export function cacheStats() {
  return {
    ...stats,
    entries: cache.size,
    computed_entries: memoCache.size,
    megabytes: Math.round((cachedBytes / 1024 / 1024) * 10) / 10,
    active_upstream: active,
    queued_upstream: queue.length,
  };
}
