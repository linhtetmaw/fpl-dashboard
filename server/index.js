import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fetch from 'node-fetch';
import { loadIndex, addToIndex, searchIndex } from './search-index.js';
import { loadLeagueIndex, addLeagueToIndex, searchLeaguesByName } from './league-index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

/** In production, serve the built React app from client/dist */
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const FPL_BASE = 'https://fantasy.premierleague.com/api';
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

async function loadTeamIdToName() {
  if (teamIdToName.size > 0) return;
  try {
    const res = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPL-Dashboard/1.0)' },
    });
    if (!res.ok) return;
    const data = await res.json();
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

badgeUrlCache.clear();
loadTeamIdToName().then(() => {
  console.log('Bootstrap loaded for badges: team id→name from FPL API');
}).catch(() => {});

app.use(cors());
app.use(express.json());

/** In production (e.g. Railway), redirect HTTP to HTTPS so the site is always secured. */
app.use((req, res, next) => {
  const proto = req.get('x-forwarded-proto');
  if (proto === 'http') {
    return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
  }
  next();
});

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
  const name = String(req.query.name ?? '').trim().replace(/\s+/g, '_');
  const code = req.query.code != null ? String(req.query.code).replace(/\D/g, '') : '';
  const team = String(req.query.team ?? '').trim();
  if (!name && !code) {
    return res.status(400).send('Missing name or code');
  }
  const nameLower = name.toLowerCase();
  const teamLower = team.toLowerCase();
  const isGabrielMagalhaes = nameLower.includes('gabriel') && nameLower.includes('magalhaes') && teamLower.includes('arsenal');

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
      res.redirect(302, '/gabriel-magalhaes.png');
      return;
    }
  } catch (err) {
    console.error('Gabriel Magalhaes photo override error:', err.message);
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
          if (imageUrl) playerPhotoCache.set(cacheKey, imageUrl);
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
  const team = req.query.team ?? '';
  const manager = req.query.manager ?? '';
  if (!String(team).trim()) {
    return res.json({ results: [], count: 0 });
  }
  const results = searchIndex(team, manager);
  res.json({ results, count: results.length });
});

/** Proxy league standings and index league name for search-by-league. */
app.get(['/api/leagues-classic/:id/standings/', '/api/leagues-classic/:id/standings'], async (req, res) => {
  const id = req.params.id;
  const page = req.query.page_standings ?? 1;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid league id' });
  }
  const url = `${FPL_BASE}/leagues-classic/${id}/standings/?page_standings=${page}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0; +https://fantasy.premierleague.com)',
      },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `FPL API error ${response.status}` });
    }
    const data = await response.json();
    if (data.league?.id != null && data.league?.name) {
      addLeagueToIndex(data.league.id, data.league.name);
    }
    res.json(data);
  } catch (err) {
    console.error('Standings proxy error:', err.message);
    res.status(502).json({ error: 'Failed to fetch from FPL API' });
  }
});

/** Build live points map: element id -> total_points from event live. */
function buildLiveByElement(liveJson) {
  const map = new Map();
  const elements = liveJson?.elements ?? [];
  for (const el of elements) {
    if (el.id != null && el.stats?.total_points != null) {
      map.set(el.id, el.stats.total_points);
    }
  }
  return map;
}

/** Compute GW points from picks + live (includes chip: BB adds bench). Returns { chip, points }. */
function computeGwPointsFromPicks(picksJson, liveByElement) {
  const rawChip = picksJson?.chips?.[0]?.name ?? picksJson?.active_chip ?? null;
  const chip = rawChip != null ? String(rawChip).trim() : null;
  const picks = picksJson?.picks ?? [];
  const chipLower = chip ? chip.toLowerCase() : '';
  const isBboost = chipLower === 'bboost' || chipLower.includes('bench');
  let sum = 0;
  for (const pick of picks) {
    const pts = (liveByElement.get(pick.element) ?? 0) * (pick.multiplier ?? 1);
    if (isBboost || (pick.position != null && pick.position <= 11)) {
      sum += pts;
    }
  }
  return { chip, points: sum };
}

/** Max standings pages to fetch (safety cap; 50 teams per page). Fetches until has_next is false so all league members appear. */
const STANDINGS_MAX_PAGES = 100;

/** League standings with chip badge and correct event_total (chip + transfer deduction). Fetches all pages so every team in the league is visible. */
app.get('/api/leagues-classic/:id/standings-with-chips', async (req, res) => {
  const id = req.params.id;
  const gw = Number(req.query.gw) || 1;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid league id' });
  }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0; +https://fantasy.premierleague.com)',
  };
  try {
    const results = [];
    let leagueInfo = null;
    let hasNext = true;
    for (let page = 1; hasNext && page <= STANDINGS_MAX_PAGES; page++) {
      const standRes = await fetch(
        `${FPL_BASE}/leagues-classic/${id}/standings/?page_standings=${page}`,
        { headers }
      );
      if (!standRes.ok) {
        return res.status(standRes.status).json({ error: `FPL API error ${standRes.status}` });
      }
      const pageData = await standRes.json();
      if (pageData.league?.id != null && pageData.league?.name) {
        addLeagueToIndex(pageData.league.id, pageData.league.name);
        leagueInfo = pageData.league;
      }
      const pageResults = pageData.standings?.results ?? [];
      results.push(...pageResults);
      hasNext = (pageData.standings?.has_next ?? false) && pageResults.length === 50;
      if (pageResults.length === 0) break;
    }
    const data = {
      league: leagueInfo ?? { id: Number(id), name: `League ${id}` },
      standings: { results, has_next: hasNext },
    };
    if (results.length === 0) {
      return res.json(data);
    }

    const liveRes = await fetch(`${FPL_BASE}/event/${gw}/live/`, { headers });
    const liveJson = liveRes.ok ? await liveRes.json() : null;
    const liveByElement = buildLiveByElement(liveJson);
    const hasLiveData = liveByElement.size > 0;

    const CONCURRENCY = 10;
    for (let i = 0; i < results.length; i += CONCURRENCY) {
      const batch = results.slice(i, i + CONCURRENCY);
      const picksAndHistory = await Promise.all(
        batch.map(async (r) => {
          try {
            const [pickRes, histRes] = await Promise.all([
              fetch(`${FPL_BASE}/entry/${r.entry}/event/${gw}/picks/`, { headers }),
              fetch(`${FPL_BASE}/entry/${r.entry}/history/`, { headers }),
            ]);
            const pickData = pickRes.ok ? await pickRes.json() : null;
            const histData = histRes.ok ? await histRes.json() : null;
            const cur = (histData?.current ?? []).find((c) => c.event === gw);
            const eventTransfersCost = cur?.event_transfers_cost != null ? Number(cur.event_transfers_cost) : 0;
            const { chip, points } = computeGwPointsFromPicks(pickData, liveByElement);
            const eventTotal = Math.max(0, points - eventTransfersCost);
            const useComputed = hasLiveData && pickData?.picks?.length > 0;
            return { chip, event_total: useComputed ? eventTotal : r.event_total };
          } catch (_) {
            return { chip: null, event_total: r.event_total };
          }
        })
      );
      batch.forEach((r, j) => {
        r.chip = picksAndHistory[j].chip ?? null;
        r.event_total = picksAndHistory[j].event_total;
      });
    }
    res.json(data);
  } catch (err) {
    console.error('Standings-with-chips error:', err.message);
    res.status(502).json({ error: 'Failed to fetch standings' });
  }
});

/** Default league IDs to search when no league_id or league name is provided. Add more IDs as needed. */
const DEFAULT_LEAGUE_IDS = [699005, 590677, 699083, 167];

/** Search by League (name or ID) + Team name + Manager name (optional). Uses DEFAULT_LEAGUE_IDS when no league given. */
app.get('/api/search-by-league', async (req, res) => {
  const leagueIdRaw = String(req.query.league_id ?? '').trim();
  const leagueQuery = String(req.query.league ?? '').trim();
  const teamQuery = String(req.query.team ?? '').trim().toLowerCase();
  const managerQuery = String(req.query.manager ?? '').trim().toLowerCase();
  if (!teamQuery) {
    return res.json({ results: [], count: 0 });
  }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0; +https://fantasy.premierleague.com)',
  };

  /** Fetch one league's page 1 standings and filter by team + manager; add league to index from response. */
  const searchOneLeague = async (leagueId, leagueName) => {
    const url = `${FPL_BASE}/leagues-classic/${leagueId}/standings/?page_standings=1`;
    const response = await fetch(url, { headers });
    if (!response.ok) return [];
    const data = await response.json();
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
  const url = `${FPL_BASE}/entry/${id}/`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0; +https://fantasy.premierleague.com)',
      },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `FPL API error ${response.status}` });
    }
    const data = await response.json();
    const playerName = [data.player_first_name, data.player_last_name].filter(Boolean).join(' ');
    addToIndex(data.id, data.name, playerName);
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Failed to fetch from FPL API' });
  }
});

app.get('/api/*', async (req, res) => {
  const path = req.path.replace(/^\/api/, '');
  const url = `${FPL_BASE}${path}`;
  const query = new URLSearchParams(req.query).toString();
  const fullUrl = query ? `${url}?${query}` : url;

  try {
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0; +https://fantasy.premierleague.com)',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `FPL API error ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Failed to fetch from FPL API' });
  }
});

/** Serve React build in production (e.g. Railway) */
try {
  const { default: fs } = await import('fs');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
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
