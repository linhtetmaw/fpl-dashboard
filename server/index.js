import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import compression from 'compression';
import fetch from 'node-fetch';
import { loadIndex, addToIndex, addStandingsRows, searchIndex, getIndexSize, saveNow as saveSearchIndex } from './search-index.js';
import { startTeamCrawler } from './team-crawler.js';
import { renderPage, sitemapXml } from './seo.js';
import { projectedBonus } from './bonus.js';
import { startPlayerTracker, getPlayerTracker } from './player-tracker.js';
import { loadLeagueIndex, addLeagueToIndex, searchLeaguesByName } from './league-index.js';
import { startFplNews, getFplNews } from './fpl-news.js';
import { startSquads, registerSquadRoutes } from './squads.js';
import { registerAuthRoutes } from './auth.js';
import { registerLineupRoutes } from './lineups.js';
import { fplGet, memo, cacheKey, cacheStats, FplError } from './fpl-api.js';
import { redirects, securityHeaders, rateLimit, clientIp } from './security.js';

// Log instead of silently dying on a stray async error.
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

/** In production, serve the built React app from client/dist */
const clientDist = path.join(__dirname, '..', 'client', 'dist');
/** Client public folder for override images (joao-pedro.png, gabriel-magalhaes.png) – served by API so redirect/proxy issues are avoided */
const clientPublic = path.join(__dirname, '..', 'client', 'public');
// 2025-26: PL CDN serves current-season player photos at this path (no season folder; they update in place)
const PL_PHOTO_BASE = 'https://resources.premierleague.com/premierleague/photos/players/250x250';
// TheSportsDB for badges (PL CDN badge IDs do not match FPL team IDs – causes wrong logos)
const THESPORTSDB_API = 'https://www.thesportsdb.com/api/v1/json/123';

/** In-memory cache: player query -> image URL (from TheSportsDB) to avoid repeated API calls. */
const playerPhotoCache = new Map();

/** Cache: FPL team id -> TheSportsDB badge URL. */
const badgeUrlCache = new Map();

/** FPL team id -> team name (from bootstrap). Populated at startup and on first badge request. */
let teamIdToName = new Map();

/** Fallback when bootstrap not yet loaded: common FPL team IDs (season-dependent). */
const FALLBACK_TEAM_NAMES = {
  1: 'Arsenal',
  2: 'Aston Villa',
  3: 'Bournemouth',
  4: 'Brentford',
  5: 'Brighton and Hove Albion',
  6: 'Chelsea',
  7: 'Crystal Palace',
  8: 'Everton',
  9: 'Fulham',
  10: 'Liverpool',
  11: 'Luton Town',
  12: 'Manchester City',
  13: 'Manchester United',
  14: 'Newcastle United',
  15: 'Nottingham Forest',
  16: 'Southampton',
  17: 'Tottenham Hotspur',
  18: 'West Ham United',
  19: 'Wolverhampton Wanderers',
  20: 'Ipswich Town',
};

/** FPL team name -> TheSportsDB search name (searchteams.php). Ensures correct badge per team. */
const TEAM_NAME_TO_SEARCH = {
  'Arsenal': 'Arsenal',
  'Aston Villa': 'Aston Villa',
  'Bournemouth': 'Bournemouth',
  'Brentford': 'Brentford',
  'Brighton and Hove Albion': 'Brighton and Hove Albion',
  'Brighton': 'Brighton and Hove Albion',
  'Chelsea': 'Chelsea',
  'Crystal Palace': 'Crystal Palace',
  'Everton': 'Everton',
  'Fulham': 'Fulham',
  'Ipswich Town': 'Ipswich Town',
  'Liverpool': 'Liverpool',
  'Luton Town': 'Luton Town',
  'Manchester City': 'Manchester City',
  'Man City': 'Manchester City',
  'Manchester United': 'Manchester United',
  'Man Utd': 'Manchester United',
  'Newcastle United': 'Newcastle United',
  'Newcastle': 'Newcastle United',
  'Nottingham Forest': 'Nottingham Forest',
  "Nott'm Forest": 'Nottingham Forest',
  'Southampton': 'Southampton',
  'Tottenham Hotspur': 'Tottenham Hotspur',
  'Spurs': 'Tottenham Hotspur',
  'Tottenham': 'Tottenham Hotspur',
  'West Ham United': 'West Ham United',
  'West Ham': 'West Ham United',
  'Wolverhampton Wanderers': 'Wolverhampton Wanderers',
  'Wolves': 'Wolverhampton Wanderers',
  'Leeds United': 'Leeds United',
  'Leeds': 'Leeds United',
  'Burnley': 'Burnley',
};

/** Manual override for Gabriel Magalhaes (Arsenal): set env GABRIEL_MAGALHAES_PHOTO_URL to an image URL, or add client/public/gabriel-magalhaes.png */
const GABRIEL_MAGALHAES_OVERRIDE_URL = process.env.GABRIEL_MAGALHAES_PHOTO_URL || null;
/** FPL element code for Gabriel Magalhaes (Arsenal) – used when API returns only "Gabriel" so we still serve the correct image. */
const GABRIEL_MAGALHAES_FPL_CODE = '226597';
/** Manual override for João Pedro (Chelsea): add client/public/joao-pedro.png or set env JOAO_PEDRO_PHOTO_URL. */
const JOAO_PEDRO_OVERRIDE_URL = process.env.JOAO_PEDRO_PHOTO_URL || null;
/** FPL element code for João Pedro (Chelsea). */
const JOAO_PEDRO_FPL_CODE = '475168';

async function loadTeamIdToName() {
  if (teamIdToName.size > 0) return;
  try {
    const data = await fplGet('/bootstrap-static/');
    const teams = data.teams || [];
    const map = new Map();
    teams.forEach((t) => {
      if (t.id != null && t.name) map.set(Number(t.id), t.name);
    });
    if (map.size > 0) teamIdToName = map;
  } catch (err) {
    console.error('Bootstrap for team names:', err.message);
  }
}

loadIndex();
loadLeagueIndex();
startFplNews();
startSquads();

// Team name search: weekly crawl of the Myanmar country league (plus every team people look up).
startTeamCrawler();
// Price-change times and 24h transfer momentum (FPL's data has no timestamps for these).
startPlayerTracker();

// Railway stops the old server with SIGTERM on each deploy: write any pending search-index changes first.
process.on('SIGTERM', () => {
  saveSearchIndex();
  process.exit(0);
});

badgeUrlCache.clear();
loadTeamIdToName().then(() => {
  console.log('Bootstrap loaded for badges: team id→name from FPL API');
}).catch(() => {});

// Railway sits behind one proxy; trust it so req.secure reflects the visitor's HTTPS connection (secure cookies).
app.set('trust proxy', 1);
// Gzip JSON, JS and CSS responses (images are already compressed and are skipped). bootstrap-static drops from ~2 MB to ~0.3 MB.
app.disable('x-powered-by');
// HTTP → HTTPS and any other host (e.g. *.up.railway.app) → CANONICAL_HOST.
app.use(redirects);
app.use(securityHeaders);
app.use(compression());
app.use(express.json({ limit: '20kb' }));
// No CORS headers: the site and its API share one origin, so other websites can't use our API (and our FPL quota) from their visitors' browsers.

/**
 * Per-IP rate limits (per minute). Generous on purpose: Myanmar mobile networks and office/campus WiFi put many
 * people behind one shared IP (CGNAT), so one "IP" can be dozens of real users. Photos are counted separately
 * because a single page can load 20–40 of them.
 */
const isImage = (req) => /^\/(player-photo|photo\/|badge\/)/.test(req.path);
const apiLimit = rateLimit({ limit: 1500, name: 'api' });
const imageLimit = rateLimit({ limit: 3000, name: 'images' });
app.use('/api', (req, res, next) => (isImage(req) ? imageLimit : apiLimit)(req, res, next));
app.use('/api/leagues-classic/:id/standings-with-chips', rateLimit({ limit: 150, name: 'league-table' }));
app.use('/api/search-by-league', rateLimit({ limit: 60, name: 'search-by-league' }));
app.use('/api/auth/telegram', rateLimit({ limit: 30, name: 'login' }));
app.use('/api/squads', rateLimit({ limit: 120, name: 'squads' }));

/** Proxy player photos; short cache so images stay current. */
app.get('/api/photo/:code', async (req, res) => {
  const code = req.params.code;
  if (!/^\d+$/.test(code)) {
    return res.status(400).send('Invalid code');
  }
  try {
    const response = await fetch(`${PL_PHOTO_BASE}/p${code}.png`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) {
      return res.status(response.status).send();
    }
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.set('Content-Type', 'image/png');
    const buf = await response.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Photo proxy error:', err.message);
    res.status(502).send();
  }
});

/** Normalize team name for TheSportsDB match (lowercase, trim). */
function normForBadgeMatch(name) {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase().trim();
}

/** Fetch TheSportsDB badge URL for a team name; cache by teamId. Uses EPL filter and name match so the correct badge is returned. */
async function getTheSportsDBBadgeUrl(teamId, teamName) {
  const cached = badgeUrlCache.get(teamId);
  if (cached) return cached;
  const searchName = TEAM_NAME_TO_SEARCH[teamName] || teamName;
  try {
    const url = `${THESPORTSDB_API}/searchteams.php?t=${encodeURIComponent(searchName)}`;
    const apiRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPL-Dashboard/1.0)' },
    });
    if (!apiRes.ok) return null;
    const data = await apiRes.json();
    const teams = data.teams;
    if (!Array.isArray(teams) || teams.length === 0) return null;
    const epl = teams.filter((t) => t.strLeague === 'English Premier League');
    const list = epl.length > 0 ? epl : teams;
    const searchNorm = normForBadgeMatch(searchName);
    const team =
      list.find((t) => normForBadgeMatch(t.strTeam) === searchNorm) ||
      list.find((t) => normForBadgeMatch(t.strTeam).includes(searchNorm) || searchNorm.includes(normForBadgeMatch(t.strTeam))) ||
      list[0];
    const badgeUrl = team.strBadge || null;
    if (badgeUrl) badgeUrlCache.set(teamId, badgeUrl);
    return badgeUrl;
  } catch (err) {
    console.error('TheSportsDB badge lookup:', err.message);
    return null;
  }
}

/** Proxy club badge (crest) images. Always use TheSportsDB by team name – use only FPL bootstrap id→name (no fallback) so badges match correctly. */
app.get('/api/badge/:teamId', async (req, res) => {
  const teamId = req.params.teamId;
  if (!/^\d+$/.test(teamId)) {
    return res.status(400).send('Invalid team id');
  }
  const id = Number(teamId);
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    await loadTeamIdToName();
    const teamName = teamIdToName.get(id) ?? (teamIdToName.size === 0 ? FALLBACK_TEAM_NAMES[id] : null);
    if (!teamName) {
      return res.status(404).send();
    }
    const badgeUrl = await getTheSportsDBBadgeUrl(id, teamName);
    if (!badgeUrl) {
      return res.status(404).send();
    }
    const imgRes = await fetch(badgeUrl, { headers: { 'User-Agent': ua } });
    if (!imgRes.ok) {
      return res.status(502).send();
    }
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    res.set('Content-Type', contentType);
    const buf = await imgRes.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Badge proxy error:', err.message);
    res.status(502).send();
  }
});

/** Normalize team name for matching (lowercase, strip "fc" etc.). */
function normalizeTeamForMatch(teamStr) {
  if (!teamStr || typeof teamStr !== 'string') return '';
  return teamStr.toLowerCase().replace(/\s*fc\s*$/i, '').trim();
}

/** Player photo: try TheSportsDB first (filter by team so e.g. Gabriel Magalhaes at Arsenal is correct), then fall back to PL CDN. */
app.get('/api/player-photo', async (req, res) => {
  const name = String(req.query.name ?? '').trim().replace(/\s+/g, '_').slice(0, 80);
  const code = req.query.code != null ? String(req.query.code).replace(/\D/g, '').slice(0, 10) : '';
  const team = String(req.query.team ?? '').trim().slice(0, 40);
  if (!name && !code) {
    return res.status(400).send('Missing name or code');
  }
  const nameLower = name.toLowerCase();
  const teamLower = team.toLowerCase();
  const nameNorm = nameLower.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const isGabrielMagalhaes =
    teamLower.includes('arsenal') &&
    nameLower.includes('gabriel') &&
    (nameNorm.includes('magalhaes') || code === GABRIEL_MAGALHAES_FPL_CODE);

  try {
    if (isGabrielMagalhaes) {
      if (GABRIEL_MAGALHAES_OVERRIDE_URL) {
        const imgRes = await fetch(GABRIEL_MAGALHAES_OVERRIDE_URL, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0)' },
        });
        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/png';
          res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
          res.set('Content-Type', contentType);
          res.send(Buffer.from(await imgRes.arrayBuffer()));
          return;
        }
      }
      const gabrielPath = path.join(clientPublic, 'gabriel-magalhaes.png');
      try {
        const buf = fs.readFileSync(gabrielPath);
        res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
        res.set('Content-Type', 'image/png');
        res.send(buf);
        return;
      } catch (_) {
        res.redirect(302, '/gabriel-magalhaes.png');
      }
      return;
    }
  } catch (err) {
    console.error('Gabriel Magalhaes photo override error:', err.message);
  }

  const isJoaoPedroChelsea =
    code === JOAO_PEDRO_FPL_CODE ||
    (teamLower.includes('chelsea') && nameNorm.includes('joao') && nameNorm.includes('pedro'));
  try {
    if (isJoaoPedroChelsea) {
      if (JOAO_PEDRO_OVERRIDE_URL) {
        const imgRes = await fetch(JOAO_PEDRO_OVERRIDE_URL, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0)' },
        });
        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/png';
          res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
          res.set('Content-Type', contentType);
          res.send(Buffer.from(await imgRes.arrayBuffer()));
          return;
        }
      }
      const joaoPath = path.join(clientPublic, 'joao-pedro.png');
      try {
        const buf = fs.readFileSync(joaoPath);
        res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
        res.set('Content-Type', 'image/png');
        res.send(buf);
        return;
      } catch (_) {
        res.redirect(302, '/joao-pedro.png');
      }
      return;
    }
  } catch (err) {
    console.error('João Pedro photo override error:', err.message);
  }

  const cacheKey = team ? `${team}:${name}` : name;
  try {
    if (name) {
      let imageUrl = playerPhotoCache.get(cacheKey);
      if (!imageUrl) {
        const apiRes = await fetch(`${THESPORTSDB_API}/searchplayers.php?p=${encodeURIComponent(name.replace(/_/g, ' '))}`);
        if (apiRes.ok) {
          const data = await apiRes.json();
          const list = data.players ?? data.player ?? [];
          const arr = Array.isArray(list) ? list : [list];
          const teamNorm = normalizeTeamForMatch(team);
          const player = teamNorm
            ? arr.find((p) => {
                const t = normalizeTeamForMatch(p?.strTeam ?? '');
                return t && (t.includes(teamNorm) || teamNorm.includes(t));
              }) ?? arr[0]
            : arr[0];
          imageUrl = player?.strCutout || player?.strThumb || null;
          if (imageUrl) {
            // Keys come from the query string, so cap the cache to stop it growing without bound.
            if (playerPhotoCache.size >= 5000) playerPhotoCache.delete(playerPhotoCache.keys().next().value);
            playerPhotoCache.set(cacheKey, imageUrl);
          }
        }
      }
      if (imageUrl) {
        const imgRes = await fetch(imageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0)' },
        });
        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/png';
          res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
          res.set('Content-Type', contentType);
          res.send(Buffer.from(await imgRes.arrayBuffer()));
          return;
        }
      }
    }
    if (code) {
      const plRes = await fetch(`${PL_PHOTO_BASE}/p${code}.png`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
      });
      if (plRes.ok) {
        res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
        res.set('Content-Type', 'image/png');
        res.send(Buffer.from(await plRes.arrayBuffer()));
        return;
      }
    }
    res.status(404).send();
  } catch (err) {
    console.error('Player photo proxy error:', err.message);
    res.status(502).send();
  }
});

/** Search by team name and optional manager name (server-side index). */
app.get('/api/search', (req, res) => {
  const team = String(req.query.team ?? '').slice(0, 60);
  const manager = String(req.query.manager ?? '').slice(0, 60);
  if (!team.trim() && !manager.trim()) {
    return res.json({ results: [], count: 0 });
  }
  const results = searchIndex(team, manager);
  res.json({ results, count: results.length });
});

/** Reload search index from disk (call after running seed script so new teams are searchable without restart). */
app.post('/api/search/reload', (req, res) => {
  // Admin only: set ADMIN_TOKEN and send it as the X-Admin-Token header.
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.get('x-admin-token') !== token) return res.status(404).json({ error: 'Not found' });
  try {
    loadIndex();
    res.json({ ok: true, count: getIndexSize() });
  } catch (err) {
    console.error('Search index reload error:', err.message);
    res.status(500).json({ ok: false, error: 'Reload failed' });
  }
});

/** Proxy league standings and index league name for search-by-league. */
app.get(['/api/leagues-classic/:id/standings/', '/api/leagues-classic/:id/standings'], async (req, res) => {
  const id = req.params.id;
  const page = req.query.page_standings ?? 1;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid league id' });
  }
  if (!/^\d+$/.test(String(page))) {
    return res.status(400).json({ error: 'Invalid page' });
  }
  try {
    const data = await fplGet(`/leagues-classic/${id}/standings/?page_standings=${page}`);
    if (data.league?.id != null && data.league?.name) {
      addLeagueToIndex(data.league.id, data.league.name);
    }
    addStandingsRows(data.standings?.results);
    res.json(data);
  } catch (err) {
    sendFplError(res, err, 'Standings proxy error');
  }
});

/** Reply with FPL's own error status when there is one (e.g. 404 for an unknown team), else 502. */
function sendFplError(res, err, label) {
  if (err instanceof FplError && err.status !== 502) {
    return res.status(err.status).json({ error: `FPL API error ${err.status}` });
  }
  console.error(`${label}:`, err.message);
  res.status(502).json({ error: 'Failed to fetch from FPL API' });
}

/** Build live map: element id -> { minutes, total_points } from event live. Supports id or element key. */
function buildLiveByElement(liveJson) {
  const map = new Map();
  const elements = liveJson?.elements ?? [];
  for (const el of elements) {
    const elementId = el.id ?? el.element;
    if (elementId != null && el.stats) {
      const mins = el.stats.minutes;
      const minutes = typeof mins === 'number' && Number.isFinite(mins) ? mins : Number(mins) || 0;
      map.set(elementId, {
        minutes,
        total_points: Number(el.stats.total_points) || 0,
      });
    }
  }
  return map;
}

/** Set of club ids with a fixture this GW that hasn't reached full time; null when fixtures are unavailable. */
function buildClubsStillPlaying(fixturesJson, gw) {
  if (!Array.isArray(fixturesJson)) return null;
  const clubs = new Set();
  for (const f of fixturesJson) {
    if (f.event === gw && !(f.finished || f.finished_provisional)) {
      clubs.add(f.team_h);
      clubs.add(f.team_a);
    }
  }
  return clubs;
}

/**
 * Compute GW points from picks + live. Mirrors computeTeamPointsSummary on the client: Bench Boost, captain → vice-captain
 * armband transfer, and FPL auto-subs (only once a starter's fixtures are over; GKP↔GKP, outfield keeps ≥3 DEF, ≥2 MID, ≥1 FWD).
 * elementById: element id -> { type, team }. clubsStillPlaying: from buildClubsStillPlaying (null = unknown, no subs applied).
 * Returns { chip, points }.
 */
function computeGwPointsFromPicks(picksJson, liveByElement, elementById, clubsStillPlaying) {
  const rawChip = picksJson?.chips?.[0]?.name ?? picksJson?.active_chip ?? null;
  const chip = rawChip != null ? String(rawChip).trim() : null;
  const picks = picksJson?.picks ?? [];
  const chipLower = chip ? chip.toLowerCase() : '';
  const isBboost = chipLower === 'bboost' || chipLower.includes('bench');

  const starting = picks.filter((p) => p.position != null && p.position <= 11).sort((a, b) => a.position - b.position);
  const bench = picks.filter((p) => p.position != null && p.position > 11).sort((a, b) => a.position - b.position);
  const getType = (pick) => elementById?.get(pick.element)?.type ?? 0;
  const getMins = (pick) => {
    const entry = liveByElement.get(pick.element);
    if (!entry) return 0;
    return typeof entry.minutes === 'number' && Number.isFinite(entry.minutes) ? entry.minutes : Number(entry.minutes) || 0;
  };
  const getRawPts = (pick) => Number(liveByElement.get(pick.element)?.total_points) || 0;
  const isGameweekOver = (pick) => {
    if (!clubsStillPlaying) return false;
    const club = elementById?.get(pick.element)?.team;
    return club != null && !clubsStillPlaying.has(club);
  };
  const didNotPlay = (pick) => getMins(pick) === 0 && isGameweekOver(pick);

  const captain = starting.find((p) => p.is_captain);
  const vice = starting.find((p) => p.is_vice_captain);
  const captainMultiplier = captain && captain.multiplier > 1 ? captain.multiplier : 2;
  const armbandId = captain && didNotPlay(captain) && vice && getMins(vice) > 0 ? vice.element : captain?.element;
  const getPts = (pick) => getRawPts(pick) * (pick.element === armbandId ? captainMultiplier : 1);

  const typeCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const s of starting) typeCounts[getType(s)] = (typeCounts[getType(s)] ?? 0) + 1;
  const formationValidAfterSwap = (outType, inType) => {
    const c = { ...typeCounts };
    c[outType] -= 1;
    c[inType] = (c[inType] ?? 0) + 1;
    return c[2] >= 3 && c[3] >= 2 && c[4] >= 1;
  };

  const usedBenchIndices = new Set();
  let startingPoints = 0;
  for (const p of starting) {
    if (isBboost || !didNotPlay(p)) {
      startingPoints += getPts(p);
      continue;
    }
    const outType = getType(p);
    const subIdx = bench.findIndex((b, i) => {
      if (usedBenchIndices.has(i) || getMins(b) === 0) return false;
      const inType = getType(b);
      if (outType === 1 || inType === 1) return outType === inType;
      return formationValidAfterSwap(outType, inType);
    });
    if (subIdx >= 0) {
      usedBenchIndices.add(subIdx);
      typeCounts[outType] -= 1;
      typeCounts[getType(bench[subIdx])] += 1;
      startingPoints += getPts(bench[subIdx]);
    }
  }

  let benchPoints = 0;
  for (let i = 0; i < bench.length; i++) {
    if (usedBenchIndices.has(i)) continue;
    benchPoints += getPts(bench[i]);
  }

  const sum = startingPoints + (isBboost ? benchPoints : 0);
  return { chip, points: sum };
}

/** How long a computed league table page is reused. Live points move every minute or so during matches. */
const LEAGUE_TABLE_TTL_MS = 90 * 1000;

/**
 * One page (50 teams) of a league table for a gameweek, with what the league table shows for each team: chip, GW
 * points (auto-subs, armband and transfer hits applied), captain, team value and per-GW points (for the Monthly
 * sort). Built from cached FPL data and itself cached for LEAGUE_TABLE_TTL_MS, so a busy league costs FPL roughly
 * one standings call per page and one picks + history call per team per cache period, however many people view it.
 */
async function buildLeagueTablePage(id, page, gw) {
  const pageData = await fplGet(`/leagues-classic/${id}/standings/?page_standings=${page}`);
  if (pageData.league?.id != null && pageData.league?.name) {
    addLeagueToIndex(pageData.league.id, pageData.league.name);
  }
  const standings = pageData.standings?.results ?? [];
  // Every team shown in a league table becomes findable by name.
  addStandingsRows(standings);
  const data = {
    league: pageData.league ?? { id: Number(id), name: `League ${id}` },
    standings: { results: [], has_next: (pageData.standings?.has_next ?? false) && standings.length > 0 },
  };
  if (standings.length === 0) return data;

  const [liveJson, bootstrap, fixturesJson] = await Promise.all([
    fplGet(`/event/${gw}/live/`).catch(() => null),
    fplGet('/bootstrap-static/').catch(() => null),
    fplGet(`/fixtures/?event=${gw}`).catch(() => null),
  ]);
  const liveByElement = buildLiveByElement(liveJson);
  // Count bonus projected from live BPS (matches under way / awaiting confirmation), same as the team pitch view.
  for (const [element, bonus] of projectedBonus(fixturesJson)) {
    const entry = liveByElement.get(element);
    if (entry) entry.total_points += bonus;
  }
  const hasLiveData = liveByElement.size > 0;
  const elementById = new Map();
  for (const el of bootstrap?.elements ?? []) {
    if (el.id != null && el.element_type != null) elementById.set(el.id, { type: el.element_type, team: el.team });
  }
  const clubsStillPlaying = buildClubsStillPlaying(fixturesJson, gw);

  // Cached FPL responses are shared, so build new row objects rather than editing them.
  data.standings.results = await Promise.all(
    standings.map(async (r) => {
      const [pickData, histData] = await Promise.all([
        fplGet(`/entry/${r.entry}/event/${gw}/picks/`).catch(() => null),
        fplGet(`/entry/${r.entry}/history/`).catch(() => null),
      ]);
      const cur = (histData?.current ?? []).find((c) => c.event === gw);
      const eventTransfersCost = cur?.event_transfers_cost != null ? Number(cur.event_transfers_cost) : 0;
      const { chip, points } = computeGwPointsFromPicks(pickData, liveByElement, elementById, clubsStillPlaying);
      const useComputed = hasLiveData && pickData?.picks?.length > 0;
      return {
        ...r,
        chip: chip ?? null,
        event_total: useComputed ? Math.max(0, points - eventTransfersCost) : r.event_total,
        captain: pickData?.picks?.find((p) => p.is_captain)?.element ?? null,
        value: typeof cur?.value === 'number' ? cur.value : null,
        history: (histData?.current ?? []).map((c) => [c.event, c.points]),
      };
    })
  );
  return data;
}

app.get('/api/leagues-classic/:id/standings-with-chips', async (req, res) => {
  const id = req.params.id;
  const gw = Number(req.query.gw) || 1;
  const page = Number(req.query.page_standings) || 1;
  if (!/^\d+$/.test(id) || !Number.isInteger(page) || page < 1 || !Number.isInteger(gw) || gw < 1 || gw > 38) {
    return res.status(400).json({ error: 'Invalid league id, page or gameweek' });
  }
  try {
    res.json(await memo(`league:${id}:${page}:${gw}`, LEAGUE_TABLE_TTL_MS, () => buildLeagueTablePage(id, page, gw)));
  } catch (err) {
    sendFplError(res, err, 'Standings-with-chips error');
  }
});

const DEFAULT_LEAGUE_IDS = [699005, 590677, 699083, 57, 150, 167, 213, 232, 254];

/** Search by League (name or ID) + Team name + Manager name (optional). Uses DEFAULT_LEAGUE_IDS when no league given. */
app.get('/api/search-by-league', async (req, res) => {
  const leagueIdRaw = String(req.query.league_id ?? '').trim();
  const leagueQuery = String(req.query.league ?? '').trim();
  const teamQuery = String(req.query.team ?? '').trim().toLowerCase();
  const managerQuery = String(req.query.manager ?? '').trim().toLowerCase();
  if (!teamQuery) {
    return res.json({ results: [], count: 0 });
  }
  /** Fetch one league's page 1 standings and filter by team + manager; add league to index from response. */
  const searchOneLeague = async (leagueId, leagueName) => {
    const data = await fplGet(`/leagues-classic/${leagueId}/standings/?page_standings=1`).catch(() => null);
    if (!data) return [];
    if (data.league?.id != null && data.league?.name) {
      addLeagueToIndex(data.league.id, data.league.name);
    }
    const name = leagueName ?? data.league?.name ?? `League ${leagueId}`;
    const entries = data.standings?.results ?? [];
    const out = [];
    for (const r of entries) {
      const matchTeam = r.entry_name && String(r.entry_name).toLowerCase().includes(teamQuery);
      const matchManager = managerQuery === '' || (r.player_name && String(r.player_name).toLowerCase().includes(managerQuery));
      if (matchTeam && matchManager) {
        out.push({ ...r, league_id: Number(leagueId), league_name: name });
      }
    }
    return out;
  };

  const results = [];
  const seenEntry = new Set();

  if (leagueIdRaw && /^\d+$/.test(leagueIdRaw)) {
    const leagueId = parseInt(leagueIdRaw, 10);
    try {
      const list = await searchOneLeague(leagueId, null);
      for (const r of list) {
        if (!seenEntry.has(r.entry)) {
          seenEntry.add(r.entry);
          results.push(r);
        }
      }
    } catch (err) {
      console.error('Search-by-league (ID) fetch error:', err.message);
    }
    return res.json({ results, count: results.length });
  }

  if (leagueQuery) {
    const matchingLeagues = searchLeaguesByName(leagueQuery);
    if (matchingLeagues.length > 0) {
      const maxLeagues = 20;
      for (let i = 0; i < Math.min(matchingLeagues.length, maxLeagues); i++) {
        const league = matchingLeagues[i];
        try {
          const list = await searchOneLeague(league.id, league.name);
          for (const r of list) {
            if (!seenEntry.has(r.entry)) {
              seenEntry.add(r.entry);
              results.push(r);
            }
          }
        } catch (err) {
          console.error('Search-by-league fetch error:', err.message);
        }
      }
      return res.json({ results, count: results.length });
    }
  }

  /* No league_id or league name, or no name match: use default league(s) */
  for (const leagueId of DEFAULT_LEAGUE_IDS) {
    try {
      const list = await searchOneLeague(leagueId, null);
      for (const r of list) {
        if (!seenEntry.has(r.entry)) {
          seenEntry.add(r.entry);
          results.push(r);
        }
      }
    } catch (err) {
      console.error('Search-by-league (default) fetch error:', err.message);
    }
  }
  res.json({ results, count: results.length });
});

/** Proxy entry/:id – fetch from FPL and add to search index so team can be found by name later. */
app.get(['/api/entry/:id', '/api/entry/:id/'], async (req, res) => {
  const id = req.params.id;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid entry id' });
  }
  try {
    const data = await fplGet(`/entry/${id}/`);
    const playerName = [data.player_first_name, data.player_last_name].filter(Boolean).join(' ');
    addToIndex(data.id, data.name, playerName);
    res.json(data);
  } catch (err) {
    sendFplError(res, err, 'Entry proxy error');
  }
});

/** Proxy YouTube playlist RSS (no API key) to avoid browser CORS. */
app.get('/api/youtube-playlist', async (req, res) => {
  const playlistId = String(req.query.playlistId || '').trim();
  if (!playlistId) return res.status(400).json({ error: 'Missing playlistId' });
  if (!/^[A-Za-z0-9_-]+$/.test(playlistId)) return res.status(400).json({ error: 'Invalid playlistId' });
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0)' },
    });
    if (!r.ok) return res.status(502).json({ error: `YouTube RSS error ${r.status}` });
    const xml = await r.text();

    // Minimal XML parsing (avoid extra deps).
    const entries = xml.split('<entry>').slice(1).map((chunk) => chunk.split('</entry>')[0] ?? '');
    const items = entries
      .map((e) => {
        const videoId = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? '').trim();
        const title = (e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim();
        const published = (e.match(/<published>([^<]+)<\/published>/)?.[1] ?? '').trim();
        const thumbnail = (e.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1] ?? '').trim();
        if (!videoId) return null;
        return { videoId, title, published, thumbnail };
      })
      .filter(Boolean);

    res.set('Cache-Control', 'public, max-age=600');
    res.json({ playlistId, items });
  } catch (err) {
    console.error('youtube-playlist error:', err.message);
    res.status(502).json({ error: 'Failed to fetch playlist' });
  }
});

/** Telegram login + Squad Planner (up to 3 squads per Telegram account; see auth.js and squads.js). */
registerAuthRoutes(app);
registerSquadRoutes(app);
/** Confirmed line-ups from ESPN, about an hour before kick-off (see lineups.js). */
registerLineupRoutes(app);

/** FPL news: player injuries/suspensions/doubts. Refreshed every 20 min by fpl-news.js. */
app.get('/api/fpl-news', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(getFplNews());
});

/** When prices changed and recent transfer momentum (see player-tracker.js). */
app.get('/api/player-tracker', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(getPlayerTracker());
});

/** Cache hit rates and memory use, for checking the FPL cache is doing its job. */
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  // your_ip shows which address rate limits count against (should be the caller's public IP, not a Railway proxy).
  res.json({ ok: true, uptime_s: Math.round(process.uptime()), your_ip: clientIp(req), fpl_cache: cacheStats() });
});

/** FPL endpoints the client uses; anything else is refused so the proxy can't be used to crawl FPL through us. */
const FPL_PROXY_ALLOW = [
  /^\/bootstrap-static\/$/,
  /^\/fixtures\/$/,
  /^\/event\/\d{1,2}\/live\/$/,
  /^\/entry\/\d{1,10}\/(history\/|event\/\d{1,2}\/picks\/|transfers\/)?$/,
  /^\/element-summary\/\d{1,4}\/$/,
  /^\/event-status\/$/,
];

/** Everything else under /api is passed through to the FPL API, via the shared cache. */
app.get('/api/*', async (req, res) => {
  const path = req.path.replace(/^\/api/, '');
  if (!FPL_PROXY_ALLOW.some((re) => re.test(path))) return res.status(404).json({ error: 'Not found' });
  const query = new URLSearchParams(
    Object.entries(req.query).filter(([k, v]) => k === 'event' && /^\d{1,2}$/.test(String(v)))
  ).toString();
  try {
    res.json(await fplGet(cacheKey(path, query)));
  } catch (err) {
    sendFplError(res, err, 'Proxy error');
  }
});

/** Serve React build in production (e.g. Railway) */
try {
  const { default: fs } = await import('fs');
  if (fs.existsSync(clientDist)) {
    // Vite's /assets files have content hashes in their names, so they can be cached forever; index.html must not be.
    app.use('/assets', express.static(path.join(clientDist, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(clientDist, { maxAge: '1h', index: false }));
    app.get('/sitemap.xml', (req, res) => {
      res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(sitemapXml(req));
    });
    // Every other page: the app shell with that page's title/description/canonical filled in (see seo.js).
    const indexHtml = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const { status, html } = renderPage(indexHtml, req);
      res.status(status).set('Cache-Control', 'no-cache').type('html').send(html);
    });
    console.log('Serving static files from', clientDist);
  }
} catch (_) {}

const server = app.listen(PORT, () => {
  console.log(`FPL proxy running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Either:\n  1. Stop the other process: lsof -ti:${PORT} | xargs kill\n  2. Or use another port: PORT=3002 npm run dev\n`);
  }
});
