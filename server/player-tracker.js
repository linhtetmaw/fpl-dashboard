/**
 * Records what FPL's data doesn't timestamp:
 *  - when each player's price changed (FPL only gives this gameweek's total change), and
 *  - hourly snapshots of each player's transfers in/out, to show "+12K in the last 24h".
 *
 * Reads the cached bootstrap every CHECK_MS, so price times are accurate to within ~10 minutes. History only exists
 * from when the tracker first ran; earlier changes have no time. Saved to DATA_DIR; reset each new season.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fplGet } from './fpl-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'player-tracker.json');

const CHECK_MS = 10 * 60 * 1000;
const SNAPSHOT_EVERY_MS = 60 * 60 * 1000;
const KEEP_SNAPSHOTS_MS = 26 * 60 * 60 * 1000;
const KEEP_PRICE_EVENTS_MS = 30 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * @type {{
 *   season: string | null,
 *   prices: Record<string, number>,
 *   priceEvents: { element: number, from: number, to: number, at: string, gw: number | null }[],
 *   snapshots: { at: string, gw: number | null, t: Record<string, [number, number]> }[],
 *   checkedAt: string | null,
 *   gw?: number | null,
 * }}
 */
let store = { season: null, prices: {}, priceEvents: [], snapshots: [], checkedAt: null };
let running = false;

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    store = { season: d.season ?? null, prices: d.prices ?? {}, priceEvents: d.priceEvents ?? [], snapshots: d.snapshots ?? [], checkedAt: d.checkedAt ?? null, gw: d.gw ?? null };
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Player tracker load error:', err.message);
  }
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store), 'utf8');
    fs.renameSync(tmp, STORE_PATH);
  } catch (err) {
    console.error('Player tracker save error:', err.message);
  }
}

function seasonOf(bootstrap) {
  const first = bootstrap.events?.[0]?.deadline_time;
  const year = first ? new Date(first).getUTCFullYear() : new Date().getUTCFullYear();
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

/** Gameweek whose transfer counts are currently accumulating (the next deadline's GW). */
function transferGw(bootstrap) {
  return (bootstrap.events ?? []).find((e) => e.is_next)?.id ?? (bootstrap.events ?? []).find((e) => e.is_current)?.id ?? null;
}

export async function checkPlayers() {
  if (running) return;
  running = true;
  try {
    const bootstrap = await fplGet('/bootstrap-static/');
    const now = Date.now();
    const iso = new Date(now).toISOString();
    const season = seasonOf(bootstrap);
    if (store.season !== season) store = { season, prices: {}, priceEvents: [], snapshots: [], checkedAt: null };
    const gw = (bootstrap.events ?? []).find((e) => e.is_current)?.id ?? null;
    const firstRun = Object.keys(store.prices).length === 0;

    for (const e of bootstrap.elements ?? []) {
      const prev = store.prices[e.id];
      // The first run only records a baseline: we don't know when earlier changes happened.
      if (!firstRun && prev != null && prev !== e.now_cost) {
        store.priceEvents.push({ element: e.id, from: prev, to: e.now_cost, at: iso, gw });
      }
      store.prices[e.id] = e.now_cost;
    }
    store.priceEvents = store.priceEvents.filter((p) => now - new Date(p.at).getTime() < KEEP_PRICE_EVENTS_MS);

    const last = store.snapshots[store.snapshots.length - 1];
    if (!last || now - new Date(last.at).getTime() >= SNAPSHOT_EVERY_MS - 60 * 1000) {
      const t = {};
      for (const e of bootstrap.elements ?? []) {
        if (e.transfers_in_event || e.transfers_out_event) t[e.id] = [e.transfers_in_event ?? 0, e.transfers_out_event ?? 0];
      }
      store.snapshots.push({ at: iso, gw: transferGw(bootstrap), t });
    }
    store.snapshots = store.snapshots.filter((s) => now - new Date(s.at).getTime() < KEEP_SNAPSHOTS_MS);
    store.checkedAt = iso;
    store.gw = gw;
    save();
  } catch (err) {
    console.error('Player tracker check failed:', err.message);
  } finally {
    running = false;
  }
}

/**
 * Latest price change time per player for the current gameweek, plus transfers in/out over the last 24 hours
 * (or since the earliest snapshot in this gameweek if we have less than a day — `transfers_window_hours` says which).
 */
export function getPlayerTracker() {
  const now = Date.now();
  const latest = store.snapshots[store.snapshots.length - 1];
  const priceChangedAt = {};
  const currentGw = store.gw ?? null;
  for (const p of store.priceEvents) {
    if (p.gw === currentGw) priceChangedAt[p.element] = p.at;
  }

  let transfers24h = {};
  let windowHours = 0;
  if (latest) {
    // Counts reset at each deadline, so only compare snapshots from the same gameweek.
    const sameGw = store.snapshots.filter((s) => s.gw === latest.gw && s !== latest);
    const base = sameGw.find((s) => now - new Date(s.at).getTime() <= WINDOW_MS) ?? null;
    if (base) {
      windowHours = Math.round((new Date(latest.at).getTime() - new Date(base.at).getTime()) / (60 * 60 * 1000));
      for (const [id, [tin, tout]] of Object.entries(latest.t)) {
        const [bin, bout] = base.t[id] ?? [0, 0];
        const dIn = tin - bin;
        const dOut = tout - bout;
        if (dIn > 0 || dOut > 0) transfers24h[id] = [dIn, dOut];
      }
    }
  }
  return {
    checked_at: store.checkedAt,
    tracking_since: store.snapshots[0]?.at ?? null,
    price_changed_at: priceChangedAt,
    transfers_window_hours: windowHours,
    transfers_recent: transfers24h,
  };
}

export function startPlayerTracker() {
  load();
  setTimeout(checkPlayers, 20 * 1000).unref();
  setInterval(checkPlayers, CHECK_MS).unref();
}
