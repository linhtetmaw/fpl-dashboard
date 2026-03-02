#!/usr/bin/env node
/**
 * Seed the search index by fetching Overall league standings from FPL API.
 * Run once (or periodically) to have many teams searchable by name without needing team ID.
 *
 * Usage:
 *   node seed-search-index.js [maxPages]   Top of league only (default 2000 pages = 100k teams)
 *   node seed-search-index.js stratified   Sample from several rank ranges (~50k teams from top/mid/lower)
 *
 * FPL has millions of managers; most ranks are in the millions. "stratified" pulls from
 * high page numbers too so some mid/lower-ranked teams get into the index.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, 'data', 'search-index.json');
const OVERALL_LEAGUE_ID = 314;
const BATCH_SIZE = 10;

const arg = process.argv[2];
const isStratified = String(arg || '').toLowerCase() === 'stratified';
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

async function fetchPage(page) {
  const url = `https://fantasy.premierleague.com/api/leagues-classic/${OVERALL_LEAGUE_ID}/standings/?page_standings=${page}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { page, results: data.standings?.results ?? [] };
}

function getPagesToFetch() {
  if (isStratified) {
    const pages = [];
    for (const range of STRATIFIED_RANGES) {
      for (let p = range.start; p <= range.end; p++) pages.push(p);
    }
    return pages;
  }
  return Array.from({ length: maxPages }, (_, i) => i + 1);
}

async function main() {
  const pagesToFetch = getPagesToFetch();
  console.log(
    isStratified
      ? 'Seeding search index: stratified (top + mid + lower ranks), ' + pagesToFetch.length + ' pages'
      : 'Seeding search index: Overall league, up to ' + maxPages + ' pages (~' + maxPages * 50 + ' teams)'
  );
  const map = loadExisting();
  console.log('Existing entries:', map.size);

  let done = 0;
  for (let i = 0; i < pagesToFetch.length; i += BATCH_SIZE) {
    const batch = pagesToFetch.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((p) => fetchPage(p)));
    for (const { page, results: entries } of results) {
      for (const r of entries) {
        map.set(r.entry, { entry: r.entry, entry_name: r.entry_name, player_name: r.player_name || '' });
      }
      done += entries.length;
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
