/**
 * Line-ups from ESPN's public match data (site.api.espn.com, no key), since FPL doesn't publish them. A match's
 * roster there is empty until the teams are announced (about an hour before kick-off), then lists the starting XI
 * with each player's position (LB, CD-L, CM-R, AM-L, CF…), the formation and the bench. ESPN names are matched to
 * FPL players by club and name.
 *
 * GET /api/lineups/:fixtureId → {
 *   status: 'confirmed' | 'pending' | 'unknown',
 *   home, away,            // the announced line-ups (confirmed only)
 *   previous: { home, away } // each team's line-up in its last match, for the predicted XI (pending only), plus
 *                            // usual: { [element]: position } from its last few matches
 * }
 * where each side is { formation, xi: Player[], bench: Player[] } and Player is
 * { element (FPL id or null), name, type (FPL position 1–4), pos (ESPN position, e.g. "CD-L") }.
 * A match is only looked up from 90 minutes before kick-off; until it's confirmed it's rechecked every 2 minutes.
 */
import { fplGet } from './fpl-api.js';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';
const LOOKAHEAD_MS = 90 * 60 * 1000;
const PENDING_TTL = 2 * 60 * 1000;
const CONFIRMED_TTL = 6 * 60 * 60 * 1000;
/** Finished matches don't change. */
const FINISHED_TTL = 24 * 60 * 60 * 1000;
const SCOREBOARD_TTL = 10 * 60 * 1000;

/** FPL's short club names → ESPN's names (others match as they are, or one contains the other). */
const CLUB_ALIASES = {
  'man utd': 'manchester united',
  'man city': 'manchester city',
  spurs: 'tottenham hotspur',
  'nott m forest': 'nottingham forest',
  wolves: 'wolverhampton wanderers',
  'sheffield utd': 'sheffield united',
};

/** Small TTL cache of promises, so parallel requests share one ESPN call. */
function ttlCache(max) {
  const map = new Map();
  return async (key, compute, ttlFor) => {
    const hit = map.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;
    const promise = compute();
    map.set(key, { promise, expires: Date.now() + PENDING_TTL });
    const value = await promise;
    map.set(key, { promise, expires: Date.now() + ttlFor(value) });
    if (map.size > max) map.delete(map.keys().next().value);
    return value;
  };
}
const lineupCache = ttlCache(1000);
const scoreboardCache = ttlCache(100);

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
      pos: p.position?.abbreviation ?? null,
    };
  };
  const players = roster?.roster ?? [];
  return {
    formation: roster?.formation ?? null,
    xi: players.filter((p) => p.starter).map(toPlayer),
    bench: players.filter((p) => !p.starter).map(toPlayer),
  };
}

function scoreboard(day) {
  return scoreboardCache(day, () => espnJson(`/scoreboard?dates=${day}`), () => SCOREBOARD_TTL);
}

/** Both teams' line-ups for an FPL fixture from ESPN, or null if they haven't been announced (or can't be found). */
function espnLineup(f, bootstrap) {
  return lineupCache(
    f.id,
    async () => {
      try {
        const teams = new Map(bootstrap.teams.map((t) => [t.id, t]));
        const home = teams.get(f.team_h);
        const away = teams.get(f.team_a);
        const board = await scoreboard(f.kickoff_time.slice(0, 10).replace(/-/g, ''));
        const event = (board.events ?? []).find((ev) => {
          const cs = ev.competitions?.[0]?.competitors ?? [];
          const h = cs.find((c) => c.homeAway === 'home')?.team;
          const a = cs.find((c) => c.homeAway === 'away')?.team;
          return sameClub(home?.name, h) && sameClub(away?.name, a);
        });
        if (!event) return null;
        const summary = await espnJson(`/summary?event=${event.id}`);
        const rosters = summary.rosters ?? [];
        const rosterFor = (team) => rosters.find((r) => sameClub(team?.name, r.team));
        const squad = (teamId) => bootstrap.elements.filter((e) => e.team === teamId);
        const h = side(rosterFor(home), squad(f.team_h));
        const a = side(rosterFor(away), squad(f.team_a));
        return h.xi.length === 11 && a.xi.length === 11 ? { home: h, away: a } : null;
      } catch (err) {
        console.error('Line-ups lookup failed:', err.message);
        return null;
      }
    },
    (value) => (f.finished ? (value ? FINISHED_TTL : 60 * 60 * 1000) : value ? CONFIRMED_TTL : PENDING_TTL)
  );
}

/** How many recent matches to learn each player's usual position from. */
const USUAL_POS_MATCHES = 5;

/**
 * This team's line-up in its last finished match before the given kick-off, or null. Also returns `usual`: each
 * player's most common starting position over the team's last few matches, so the predicted XI can put a
 * replacement in the empty spot that suits them (e.g. a winger into an attacking spot, not a holding one).
 */
async function previousLineup(teamId, before, fixtures, bootstrap) {
  const recent = fixtures
    .filter((x) => x.finished && x.kickoff_time && x.kickoff_time < before && (x.team_h === teamId || x.team_a === teamId))
    .sort((a, b) => b.kickoff_time.localeCompare(a.kickoff_time))
    .slice(0, USUAL_POS_MATCHES);
  if (!recent.length) return null;
  const sides = await Promise.all(
    recent.map(async (x) => {
      const lineup = await espnLineup(x, bootstrap);
      return lineup ? lineup[x.team_h === teamId ? 'home' : 'away'] : null;
    })
  );
  const last = sides[0];
  if (!last) return null;
  const counts = new Map();
  for (const sideXi of sides) {
    for (const p of sideXi?.xi ?? []) {
      if (p.element == null || !p.pos) continue;
      const byPos = counts.get(p.element) ?? new Map();
      byPos.set(p.pos, (byPos.get(p.pos) ?? 0) + 1);
      counts.set(p.element, byPos);
    }
  }
  const usual = {};
  for (const [element, byPos] of counts) usual[element] = [...byPos].sort((a, b) => b[1] - a[1])[0][0];
  return { ...last, usual };
}

export async function getLineups(fixtureId) {
  const [fixtures, bootstrap] = await Promise.all([fplGet('/fixtures/'), fplGet('/bootstrap-static/')]);
  const f = fixtures.find((x) => x.id === fixtureId);
  if (!f || !f.kickoff_time) return { status: 'unknown' };
  const near = Date.now() >= new Date(f.kickoff_time).getTime() - LOOKAHEAD_MS;
  const announced = near ? await espnLineup(f, bootstrap) : null;
  if (announced) return { status: 'confirmed', source: 'ESPN', ...announced };
  const [home, away] = await Promise.all([
    previousLineup(f.team_h, f.kickoff_time, fixtures, bootstrap),
    previousLineup(f.team_a, f.kickoff_time, fixtures, bootstrap),
  ]);
  return { status: 'pending', previous: { home, away } };
}

export function registerLineupRoutes(app) {
  app.get('/api/lineups/:fixtureId', async (req, res) => {
    const { fixtureId } = req.params;
    if (!/^\d{1,6}$/.test(fixtureId)) return res.status(400).json({ error: 'Invalid fixture id' });
    try {
      const data = await getLineups(Number(fixtureId));
      res.set('Cache-Control', data.status === 'confirmed' ? 'public, max-age=600' : 'public, max-age=60');
      res.json(data);
    } catch (err) {
      console.error('Line-ups error:', err.message);
      res.status(502).json({ error: 'Could not load line-ups right now.' });
    }
  });
}
