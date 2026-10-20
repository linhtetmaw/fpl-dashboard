/**
 * Squad Planner: dummy FPL squads that live on this site (not on the real FPL game).
 *
 * Squads belong to a Telegram account (see auth.js); each account can keep up to MAX_PER_USER. Every save is stored
 * as a version tagged with the gameweek it first counts for (the next deadline after saving), so points for past
 * gameweeks always use the squad as it was at that deadline.
 *
 * The server is the source of truth for squad rules and prices: a player keeps the price they were bought at,
 * newly added players cost their current FPL price, and the 15 must fit the £100.0m budget.
 *
 * Env:
 *   DATA_DIR – optional; point at a persistent volume in production so squads survive redeploys.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { requireUser } from './auth.js';
import { fplGet } from './fpl-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'squads.json');


export const BUDGET = 1000; // £100.0m in tenths
const SQUAD_SIZE = 15;
const QUOTA = { 1: 2, 2: 5, 3: 5, 4: 3 };
const MAX_PER_CLUB = 3;
const MAX_NAME = 30;
const MAX_SQUADS = 100000;
export const MAX_PER_USER = 3;

/** @type {{ squads: Record<string, any> }} */
let store = { squads: {} };

function loadStore() {
  try {
    store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!store || typeof store.squads !== 'object') store = { squads: {} };
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Squads store load error:', err.message);
    store = { squads: {} };
  }
}

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
}

function getBootstrap() {
  return fplGet('/bootstrap-static/');
}

/** First gameweek whose deadline is still ahead: a save made now counts from this gameweek. */
function nextGameweek(bootstrap, now = Date.now()) {
  const ev = (bootstrap.events ?? []).find((e) => new Date(e.deadline_time).getTime() > now);
  return ev?.id ?? null;
}

class SquadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Check a submitted squad against FPL rules and price it.
 * Input picks: [{ element, position (1–15; 1–11 start, 12 = bench GK, 13–15 bench order), is_captain, is_vice_captain }].
 */
function validatePicks(input, bootstrap, previousPicks) {
  if (!Array.isArray(input) || input.length !== SQUAD_SIZE) throw new SquadError('A squad needs exactly 15 players.');
  const elements = new Map((bootstrap.elements ?? []).map((e) => [e.id, e]));
  const prevPrice = new Map((previousPicks ?? []).map((p) => [p.element, p.purchase_price]));
  const seenElements = new Set();
  const seenPositions = new Set();
  const typeCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const startType = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const clubCount = new Map();
  let captains = 0;
  let vices = 0;
  let spent = 0;

  const picks = input.map((p) => {
    const element = Number(p?.element);
    const position = Number(p?.position);
    const el = elements.get(element);
    if (!el) throw new SquadError('Unknown player in squad.');
    if (!Number.isInteger(position) || position < 1 || position > SQUAD_SIZE) throw new SquadError('Invalid squad positions.');
    if (seenElements.has(element)) throw new SquadError('A player can only be picked once.');
    if (seenPositions.has(position)) throw new SquadError('Invalid squad positions.');
    seenElements.add(element);
    seenPositions.add(position);
    typeCount[el.element_type] += 1;
    if (position <= 11) startType[el.element_type] += 1;
    if (position === 12 && el.element_type !== 1) throw new SquadError('The first bench slot must be a goalkeeper.');
    clubCount.set(el.team, (clubCount.get(el.team) ?? 0) + 1);
    const is_captain = p?.is_captain === true;
    const is_vice_captain = p?.is_vice_captain === true;
    if (is_captain) captains += 1;
    if (is_vice_captain) vices += 1;
    if ((is_captain || is_vice_captain) && position > 11) throw new SquadError('Captain and vice-captain must be in the starting XI.');
    const purchase_price = prevPrice.get(element) ?? el.now_cost;
    spent += purchase_price;
    return { element, position, is_captain, is_vice_captain, purchase_price };
  });

  for (const [type, n] of Object.entries(QUOTA)) {
    if (typeCount[type] !== n) throw new SquadError('A squad needs 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards.');
  }
  if ([...clubCount.values()].some((n) => n > MAX_PER_CLUB)) throw new SquadError('Maximum 3 players from one club.');
  if (startType[1] !== 1 || startType[2] < 3 || startType[3] < 2 || startType[4] < 1) {
    throw new SquadError('The starting XI needs 1 goalkeeper, at least 3 defenders, 2 midfielders and 1 forward.');
  }
  if (captains !== 1 || vices !== 1 || picks.some((p) => p.is_captain && p.is_vice_captain)) {
    throw new SquadError('Pick one captain and a different vice-captain.');
  }
  if (spent > BUDGET) throw new SquadError(`Squad costs £${(spent / 10).toFixed(1)}m — over the £100.0m budget.`);
  return picks.sort((a, b) => a.position - b.position);
}

function cleanName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return name || 'My Squad';
}

function publicSquad(id, s) {
  return { id, name: s.name, created_at: s.created_at, updated_at: s.updated_at, start_gw: s.versions[0]?.gw ?? null, versions: s.versions };
}

function ownedSquad(userId, id) {
  const s = typeof id === 'string' ? store.squads[id] : null;
  if (!s || s.owner !== userId) throw new SquadError('Squad not found.', 404);
  return s;
}

export function listSquads(userId) {
  return Object.entries(store.squads)
    .filter(([, s]) => s.owner === userId)
    .sort(([, a], [, b]) => a.created_at.localeCompare(b.created_at))
    .map(([id, s]) => publicSquad(id, s));
}

export async function createSquad(userId, body) {
  if (listSquads(userId).length >= MAX_PER_USER) throw new SquadError(`You can keep up to ${MAX_PER_USER} squads. Delete one to make a new one.`, 409);
  if (Object.keys(store.squads).length >= MAX_SQUADS) throw new SquadError('Squad storage is full.', 503);
  const bootstrap = await getBootstrap();
  const now = Date.now();
  const gw = nextGameweek(bootstrap, now);
  if (gw == null) throw new SquadError('The season is over — no deadlines left to save for.', 409);
  const picks = validatePicks(body?.picks, bootstrap, null);
  const id = crypto.randomUUID();
  const iso = new Date(now).toISOString();
  store.squads[id] = { owner: userId, name: cleanName(body?.name), created_at: iso, updated_at: iso, versions: [{ gw, saved_at: iso, picks }] };
  saveStore();
  return publicSquad(id, store.squads[id]);
}

export async function updateSquad(userId, id, body) {
  const s = ownedSquad(userId, id);
  const bootstrap = await getBootstrap();
  const now = Date.now();
  const gw = nextGameweek(bootstrap, now);
  if (gw == null) throw new SquadError('The season is over — no deadlines left to save for.', 409);
  const last = s.versions[s.versions.length - 1];
  const picks = validatePicks(body?.picks, bootstrap, last?.picks);
  const iso = new Date(now).toISOString();
  const version = { gw, saved_at: iso, picks };
  // Several saves before the same deadline only keep the latest one.
  if (last && last.gw === gw) s.versions[s.versions.length - 1] = version;
  else s.versions.push(version);
  s.name = cleanName(body?.name ?? s.name);
  s.updated_at = iso;
  saveStore();
  return publicSquad(id, s);
}

export function deleteSquad(userId, id) {
  ownedSquad(userId, id);
  delete store.squads[id];
  saveStore();
  return { ok: true };
}

/** Express handlers: GET/POST/PUT /api/squads. */
export function registerSquadRoutes(app) {
  const send = (res, fn) =>
    Promise.resolve()
      .then(fn)
      .then((data) => res.json(data))
      .catch((err) => {
        if (err instanceof SquadError) return res.status(err.status).json({ error: err.message });
        console.error('Squad error:', err.message);
        res.status(502).json({ error: 'Could not save the squad right now. Please try again.' });
      });

  app.get('/api/squads', requireUser, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ squads: listSquads(req.user.id), max: MAX_PER_USER });
  });
  app.post('/api/squads', requireUser, (req, res) => send(res, () => createSquad(req.user.id, req.body)));
  app.put('/api/squads/:id', requireUser, (req, res) => send(res, () => updateSquad(req.user.id, req.params.id, req.body)));
  app.delete('/api/squads/:id', requireUser, (req, res) => send(res, () => deleteSquad(req.user.id, req.params.id)));
}

export function startSquads() {
  loadStore();
}
