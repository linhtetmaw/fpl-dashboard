/**
 * Confirmed line-ups, about an hour before kick-off. FPL doesn't publish line-ups, so they come from ESPN's public
 * match data (site.api.espn.com, no key): its roster for a match is empty until the teams are announced, then lists
 * the starting XI, formation and bench. ESPN names are matched to FPL players by club and name.
 *
 * GET /api/lineups/:fixtureId → { status: 'confirmed', home, away } or { status: 'pending' }, where each side is
 * { formation, xi: Player[], bench: Player[] } and Player is { element (FPL id or null), name, type (1–4) }.
 * Only looked up from 90 minutes before kick-off; once confirmed it's kept, before that rechecked every 2 minutes.
 */
import { fplGet } from './fpl-api.js';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';
const LOOKAHEAD_MS = 90 * 60 * 1000;
const PENDING_TTL = 2 * 60 * 1000;
const CONFIRMED_TTL = 6 * 60 * 60 * 1000;

/** FPL's short club names → ESPN's names (others match as they are, or one contains the other). */
const CLUB_ALIASES = {
  'man utd': 'manchester united',
  'man city': 'manchester city',
  spurs: 'tottenham hotspur',
  'nott m forest': 'nottingham forest',
  wolves: 'wolverhampton wanderers',
  'sheffield utd': 'sheffield united',
};

const cache = new Map();

/** Letters that don't decompose into a base letter + accent. */
const SPECIAL = { ß: 'ss', ı: 'i', ø: 'o', æ: 'ae', œ: 'oe', đ: 'd', ł: 'l', þ: 'th' };

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[ßıøæœđłþ]/g, (c) => SPECIAL[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();

const compact = (s) => norm(s).replace(/ /g, '');

function sameClub(fplName, espnTeam) {
  const fpl = norm(fplName);
  const want = CLUB_ALIASES[fpl] ?? fpl;
  return [espnTeam?.displayName, espnTeam?.shortDisplayName, espnTeam?.name].some((n) => {
    const e = norm(n);
    return e && (e === want || e.includes(want) || want.includes(e));
  });
}

async function espnJson(path) {
  const res = await fetch(`${ESPN}${path}`, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

/** ESPN position abbreviation (G, CD-L, LB, CM, AM-R, F…) → FPL element type, for players we can't match. */
function typeFromEspn(abbr) {
  const a = String(abbr ?? '').toUpperCase();
  if (a === 'G' || a === 'GK') return 1;
  if (/^(CD|LB|RB|D|WB|LWB|RWB|SW)/.test(a)) return 2;
  if (/^(F|CF|S|ST|LW|RW)/.test(a)) return 4;
  return 3;
}

/** Find the FPL player for an ESPN athlete among one club's players, trying the surest name matches first. */
function matchPlayer(athlete, squad, taken) {
  const display = norm(athlete.displayName);
  const last = norm(athlete.lastName) || display.split(' ').pop();
  const first = norm(athlete.firstName) || display.split(' ')[0];
  const free = squad.filter((e) => !taken.has(e.id));
  const rules = [
    (e) => norm(`${e.first_name} ${e.second_name}`) === display,
    (e) => norm(e.web_name) === display,
    (e) => norm(e.web_name) === last,
    // Spacing differs between sources, e.g. "Da Silva" / "Dasilva".
    (e) => compact(`${e.first_name} ${e.second_name}`) === compact(display) || compact(e.web_name) === compact(last),
    (e) => norm(e.second_name).split(' ').pop() === last && norm(e.first_name)[0] === first[0],
    (e) => {
      const tokens = new Set(norm(`${e.first_name} ${e.second_name}`).split(' '));
      return display.split(' ').every((t) => tokens.has(t));
    },
    (e) => norm(e.web_name).length >= 4 && display.includes(norm(e.web_name)),
  ];
  for (const rule of rules) {
    const hits = free.filter(rule);
    if (hits.length === 1) return hits[0];
  }
  return null;
}

function side(roster, squad) {
  const taken = new Set();
  const toPlayer = (p) => {
    const match = matchPlayer(p.athlete ?? {}, squad, taken);
    if (match) taken.add(match.id);
    return {
      element: match?.id ?? null,
      name: match?.web_name ?? p.athlete?.shortName ?? p.athlete?.displayName ?? '?',
      type: match?.element_type ?? typeFromEspn(p.position?.abbreviation),
    };
  };
  const players = roster?.roster ?? [];
  return {
    formation: roster?.formation ?? null,
    xi: players.filter((p) => p.starter).map(toPlayer),
    bench: players.filter((p) => !p.starter).map(toPlayer),
  };
}

async function lookup(fixtureId) {
  const [fixtures, bootstrap] = await Promise.all([fplGet('/fixtures/'), fplGet('/bootstrap-static/')]);
  const f = fixtures.find((x) => x.id === fixtureId);
  if (!f) return { status: 'unknown' };
  const kickoff = new Date(f.kickoff_time).getTime();
  if (!f.kickoff_time || f.finished || Date.now() < kickoff - LOOKAHEAD_MS) return { status: 'pending' };

  const teams = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const home = teams.get(f.team_h);
  const away = teams.get(f.team_a);
  const day = f.kickoff_time.slice(0, 10).replace(/-/g, '');
  const board = await espnJson(`/scoreboard?dates=${day}`);
  const event = (board.events ?? []).find((ev) => {
    const cs = ev.competitions?.[0]?.competitors ?? [];
    const h = cs.find((c) => c.homeAway === 'home')?.team;
    const a = cs.find((c) => c.homeAway === 'away')?.team;
    return sameClub(home?.name, h) && sameClub(away?.name, a);
  });
  if (!event) return { status: 'pending' };

  const summary = await espnJson(`/summary?event=${event.id}`);
  const rosters = summary.rosters ?? [];
  const rosterFor = (team) => rosters.find((r) => sameClub(team?.name, r.team));
  const squad = (teamId) => bootstrap.elements.filter((e) => e.team === teamId);
  const h = side(rosterFor(home), squad(f.team_h));
  const a = side(rosterFor(away), squad(f.team_a));
  if (h.xi.length !== 11 || a.xi.length !== 11) return { status: 'pending' };
  return { status: 'confirmed', source: 'ESPN', home: h, away: a };
}

export async function getLineups(fixtureId) {
  const hit = cache.get(fixtureId);
  if (hit && hit.expires > Date.now()) return hit.promise;
  const promise = lookup(fixtureId).catch((err) => {
    console.error('Line-ups lookup failed:', err.message);
    return { status: 'pending' };
  });
  cache.set(fixtureId, { promise, expires: Date.now() + PENDING_TTL });
  const value = await promise;
  cache.set(fixtureId, { promise, expires: Date.now() + (value.status === 'confirmed' ? CONFIRMED_TTL : PENDING_TTL) });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}

export function registerLineupRoutes(app) {
  app.get('/api/lineups/:fixtureId', async (req, res) => {
    const { fixtureId } = req.params;
    if (!/^\d{1,6}$/.test(fixtureId)) return res.status(400).json({ error: 'Invalid fixture id' });
    const data = await getLineups(Number(fixtureId));
    res.set('Cache-Control', data.status === 'confirmed' ? 'public, max-age=600' : 'public, max-age=60');
    res.json(data);
  });
}
