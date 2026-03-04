#!/usr/bin/env node
/**
 * Seed the search index by fetching league standings from FPL API.
 * Run once (or periodically) to have many teams searchable by name without needing team ID.
 *
 * Usage:
 *   node seed-search-index.js [maxPages]       Overall league, top only (default 2000 pages = 100k teams)
 *   node seed-search-index.js stratified        Overall league, sample from several rank ranges
 *   node seed-search-index.js league <id>       Fetch ALL pages of a specific league (e.g. 167 = Myanmar)
 *   node seed-search-index.js asean             Fetch ALL pages of ASEAN country leagues (Myanmar, Cambodia, Thailand, Singapore, Malaysia, Vietnam)
 *
 * To find a country league ID: go to fantasy.premierleague.com → Leagues → select country → league ID is in the URL (e.g. .../leagues/167/standings/c).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, 'data', 'search-index.json');
const OVERALL_LEAGUE_ID = 314;
const BATCH_SIZE = 10;

/** FPL country league IDs for ASEAN. Resolved via FPL API (leagues-classic/{id}/standings). */
const ASEAN_LEAGUE_IDS = [
  { id: 57, name: 'Cambodia' },
  { id: 150, name: 'Malaysia' },
  { id: 167, name: 'Myanmar' },
  { id: 213, name: 'Singapore' },
  { id: 232, name: 'Thailand' },
  { id: 254, name: 'Vietnam' },
];

const arg = process.argv[2];
const arg2 = process.argv[3];
const isStratified = String(arg || '').toLowerCase() === 'stratified';
const isLeagueMode = String(arg || '').toLowerCase() === 'league' && arg2;
const isAseanMode = String(arg || '').toLowerCase() === 'asean';
const leagueIdToSeed = isLeagueMode ? parseInt(arg2, 10) : null;
const maxPages = isStratified
  ? 0
  : Math.min(parseInt(arg || '2000', 10) || 2000, 5000);

/** Page ranges for stratified seed: top, ~500k rank, ~2.5M rank, ~5M rank (50 per page). */
const STRATIFIED_RANGES = [
  { start: 1, end: 500, label: 'top (1–25k)' },
  { start: 10000, end: 10200, label: '~500k rank' },
  { start: 50000, end: 50200, label: '~2.5M rank' },
  { start: 100000, end: 100100, label: '~5M rank' },
];

function ensureDataDir() {
  const dir = path.dirname(INDEX_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadExisting() {
  try {
    const raw = fs.readFileSync(INDEX_PATH, 'utf8');
    const data = JSON.parse(raw);
    return new Map((data.entries || []).map((e) => [e.entry, e]));
  } catch {
    return new Map();
  }
}

function saveIndex(entries) {
  ensureDataDir();
  const list = Array.from(entries.values());
  fs.writeFileSync(INDEX_PATH, JSON.stringify({ entries: list }, null, 0), 'utf8');
  console.log('Saved', list.length, 'teams to', INDEX_PATH);
}

async function fetchPage(leagueId, page) {
  const url = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?page_standings=${page}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { page, results: data.standings?.results ?? [], has_next: data.standings?.has_next ?? false };
}

function getPagesToFetch() {
  if (isLeagueMode) return null;
  if (isStratified) {
    const pages = [];
    for (const range of STRATIFIED_RANGES) {
      for (let p = range.start; p <= range.end; p++) pages.push(p);
    }
    return pages;
  }
  return Array.from({ length: maxPages }, (_, i) => i + 1);
}

/** Seed one league (all pages) into the map. Returns total teams added from this league. */
async function seedOneLeague(map, leagueId, leagueName) {
  let page = 1;
  let totalFetched = 0;
  const maxPagesCap = 200;
  while (page <= maxPagesCap) {
    const { results: entries, has_next } = await fetchPage(leagueId, page);
    for (const r of entries) {
      map.set(r.entry, { entry: r.entry, entry_name: r.entry_name, player_name: r.player_name || '' });
    }
    totalFetched += entries.length;
    console.log('  Page ' + page + ': +' + entries.length + ' teams | Index size: ' + map.size);
    saveIndex(map);
    if (!has_next || entries.length < 50) break;
    page++;
  }
  return totalFetched;
}

async function main() {
  const map = loadExisting();
  console.log('Existing entries:', map.size);

  if (isAseanMode) {
    console.log('Seeding search index: ASEAN leagues (all pages each)');
    for (const { id, name } of ASEAN_LEAGUE_IDS) {
      console.log('League ' + id + ' (' + name + ')');
      const n = await seedOneLeague(map, id, name);
      console.log('  Fetched ' + n + ' teams from ' + name + '.');
    }
    console.log('Done. Index size:', map.size);
    return;
  }

  if (isLeagueMode && leagueIdToSeed) {
    console.log('Seeding search index: league ' + leagueIdToSeed + ' (all pages)');
    const totalFetched = await seedOneLeague(map, leagueIdToSeed, null);
    console.log('Done. Fetched ' + totalFetched + ' teams from league ' + leagueIdToSeed + '. Index size:', map.size);
    return;
  }

  const pagesToFetch = getPagesToFetch();
  console.log(
    isStratified
      ? 'Seeding search index: stratified (top + mid + lower ranks), ' + pagesToFetch.length + ' pages'
      : 'Seeding search index: Overall league, up to ' + maxPages + ' pages (~' + maxPages * 50 + ' teams)'
  );

  for (let i = 0; i < pagesToFetch.length; i += BATCH_SIZE) {
    const batch = pagesToFetch.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((p) => fetchPage(OVERALL_LEAGUE_ID, p)));
    for (const { results: entries } of results) {
      for (const r of entries) {
        map.set(r.entry, { entry: r.entry, entry_name: r.entry_name, player_name: r.player_name || '' });
      }
    }
    if ((i + batch.length) % 200 < BATCH_SIZE || i + batch.length >= pagesToFetch.length) {
      console.log('Fetched ' + (i + batch.length) + '/' + pagesToFetch.length + ' pages | Total in index:', map.size);
    }
    saveIndex(map);
  }

  console.log('Done. Index size:', map.size);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
