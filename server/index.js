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
// Club badges (crests) – optional fallback
const PL_BADGE_BASE = 'https://resources.premierleague.com/premierleague/badges';
// TheSportsDB free API – often more up-to-date player photos than PL CDN (free key 123, 30 req/min)
const THESPORTSDB_API = 'https://www.thesportsdb.com/api/v1/json/123';

/** In-memory cache: player query -> image URL (from TheSportsDB) to avoid repeated API calls. */
const playerPhotoCache = new Map();

loadIndex();
loadLeagueIndex();

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

/** Proxy club badge (crest) images; use for pitch view as up-to-date team identity. */
app.get('/api/badge/:teamId', async (req, res) => {
  const teamId = req.params.teamId;
  if (!/^\d+$/.test(teamId)) {
    return res.status(400).send('Invalid team id');
  }
  try {
    const response = await fetch(`${PL_BADGE_BASE}/t${teamId}.png`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) {
      return res.status(response.status).send();
    }
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.set('Content-Type', 'image/png');
    const buf = await response.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Badge proxy error:', err.message);
    res.status(502).send();
  }
});

/** Player photo: try TheSportsDB first (often more up-to-date), then fall back to PL CDN. Query: name (e.g. Bukayo_Saka), optional code (FPL element code for PL fallback). */
app.get('/api/player-photo', async (req, res) => {
  const name = String(req.query.name ?? '').trim().replace(/\s+/g, '_');
  const code = req.query.code != null ? String(req.query.code).replace(/\D/g, '') : '';
  if (!name && !code) {
    return res.status(400).send('Missing name or code');
  }
  try {
    if (name) {
      let imageUrl = playerPhotoCache.get(name);
      if (!imageUrl) {
        const apiRes = await fetch(`${THESPORTSDB_API}/searchplayers.php?p=${encodeURIComponent(name)}`);
        if (apiRes.ok) {
          const data = await apiRes.json();
          const player = data.players?.[0] ?? data.player?.[0];
          imageUrl = player?.strCutout || player?.strThumb || null;
          if (imageUrl) playerPhotoCache.set(name, imageUrl);
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

app.listen(PORT, () => {
  console.log(`FPL proxy running at http://localhost:${PORT}`);
});
