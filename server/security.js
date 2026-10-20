/**
 * Production hardening: security headers, HTTPS + canonical-domain redirects and per-IP rate limits.
 *
 * Env:
 *   CANONICAL_HOST – e.g. "fplhouse.com". When set, requests on any other host (such as the *.up.railway.app
 *                    address or "www.") are redirected there, so Telegram login (tied to one domain) always works.
 */

/** Redirect to https://CANONICAL_HOST (when set) and from http to https behind Railway's proxy. */
export function redirects(req, res, next) {
  const canonical = process.env.CANONICAL_HOST?.trim().toLowerCase();
  const host = String(req.get('host') ?? '').toLowerCase();
  const proto = req.get('x-forwarded-proto');
  // Local development (localhost) is never redirected.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (!isLocal && canonical && host !== canonical) {
    return res.redirect(301, `https://${canonical}${req.originalUrl}`);
  }
  if (!isLocal && proto === 'http') {
    // Only ever redirect to our own canonical host; fall back to the request host when none is configured.
    return res.redirect(301, `https://${canonical || host}${req.originalUrl}`);
  }
  next();
}

/** Standard security headers. A full Content-Security-Policy is left out because GA, Google Fonts, Telegram and YouTube all load third-party code. */
export function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Don't let other sites frame us (clickjacking, e.g. over the Telegram login button).
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Content-Security-Policy', "frame-ancestors 'self'");
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

/**
 * Fixed-window per-IP rate limiter kept in memory (fine for a single instance).
 * Returns Express middleware allowing `limit` requests per `windowMs` per IP for the routes it's mounted on.
 */
export function rateLimit({ limit, windowMs = 60 * 1000, name = 'api' }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, w] of hits) if (w.reset <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip ?? 'unknown';
    let w = hits.get(ip);
    if (!w || w.reset <= now) {
      w = { count: 0, reset: now + windowMs };
      hits.set(ip, w);
    }
    w.count += 1;
    if (w.count > limit) {
      res.set('Retry-After', String(Math.ceil((w.reset - now) / 1000)));
      if (w.count === limit + 1) console.warn(`Rate limit (${name}) hit by ${ip}`);
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again in a minute.' });
    }
    next();
  };
}
