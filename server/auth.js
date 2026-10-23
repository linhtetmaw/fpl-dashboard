/**
 * Telegram login (https://core.telegram.org/widgets/login) and a signed session cookie.
 *
 * The Telegram widget hands the browser a signed bundle of the user's Telegram id and name; we check the signature
 * with the bot token, then set our own HttpOnly cookie so later requests know who's logged in. Nothing else about
 * the user is stored.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN     – from @BotFather; required for login.
 *   TELEGRAM_BOT_USERNAME  – the bot's username (without @), used to show the login button.
 *   SESSION_SECRET         – long random string used to sign session cookies. Without it a random one is made at
 *                            startup, so everyone is logged out whenever the server restarts.
 */
import crypto from 'crypto';
import { sendChannelInvite } from './telegram-welcome.js';

const COOKIE = 'fplh_session';
const SESSION_DAYS = 30;
/** Reject Telegram login bundles older than this, so a leaked one can't be replayed later. */
const MAX_AUTH_AGE_S = 24 * 60 * 60;

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  const log = process.env.RAILWAY_ENVIRONMENT ? console.error : console.warn;
  log('SESSION_SECRET not set: using a temporary one, so everyone is logged out whenever the server restarts.');
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Check a Telegram login bundle. Returns { id, name, username } or null. */
export function verifyTelegramLogin(data, botToken = process.env.TELEGRAM_BOT_TOKEN) {
  if (!botToken || !data || typeof data !== 'object' || typeof data.hash !== 'string') return null;
  const fields = Object.keys(data)
    .filter((k) => k !== 'hash' && data[k] != null)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(fields).digest('hex');
  if (!safeEqual(expected, data.hash)) return null;
  const age = Date.now() / 1000 - Number(data.auth_date);
  if (!Number.isFinite(age) || age > MAX_AUTH_AGE_S || age < -300) return null;
  const id = Number(data.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim().slice(0, 64) || 'Telegram user';
  return { id, name, username: typeof data.username === 'string' ? data.username.slice(0, 64) : null };
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/** The logged-in user for this request, or null. */
export function getSessionUser(req) {
  const raw = readCookie(req, COOKIE);
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  if (!safeEqual(sign(payload), raw.slice(dot + 1))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!user?.id || typeof user.exp !== 'number' || user.exp < Date.now()) return null;
    return { id: user.id, name: user.name, username: user.username ?? null };
  } catch {
    return null;
  }
}

function setSession(req, res, user) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ ...user, exp })).toString('base64url');
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`
  );
}

/** Express middleware: 401 unless logged in; sets req.user. */
export function requireUser(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Log in with Telegram to save squads.' });
  req.user = user;
  next();
}

export function registerAuthRoutes(app) {
  app.get('/api/auth/me', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      user: getSessionUser(req),
      telegram_bot: process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_USERNAME || null : null,
    });
  });

  app.post('/api/auth/telegram', (req, res) => {
    const user = verifyTelegramLogin(req.body);
    if (!user) return res.status(401).json({ error: 'Telegram login could not be verified. Please try again.' });
    setSession(req, res, user);
    res.json({ user });
    // Invite them to the Telegram channel (once per user, in the background).
    sendChannelInvite(user);
  });

  app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  });
}
