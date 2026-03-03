#!/usr/bin/env node
/**
 * Find the team with the highest points in a given league for a specific gameweek.
 * Usage: node scripts/gw-top-team.js <leagueId> <gameweek>
 * Example: node scripts/gw-top-team.js 699005 28
 */

const FPL_BASE = 'https://fantasy.premierleague.com/api';

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function getLeagueStandingsPage(leagueId, page = 1) {
  const url = `${FPL_BASE}/leagues-classic/${leagueId}/standings/?page_standings=${page}`;
  return fetchJson(url);
}

async function getAllLeagueEntries(leagueId) {
  const entries = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const data = await getLeagueStandingsPage(leagueId, page);
    const results = data.standings?.results ?? [];
    entries.push(...results);
    hasNext = data.standings?.has_next ?? false;
    page++;
    if (results.length === 0) break;
  }
  return entries;
}

async function getEntryHistory(entryId) {
  const url = `${FPL_BASE}/entry/${entryId}/history/`;
  return fetchJson(url);
}

function getPointsForGameweek(history, gameweek) {
  const current = history.current ?? [];
  const event = current.find((e) => e.event === gameweek);
  return event ? event.points : null;
}

async function main() {
  const leagueId = parseInt(process.argv[2], 10) || 699005;
  const gameweek = parseInt(process.argv[3], 10) || 28;

  console.log(`Fetching league ${leagueId} standings...`);
  const entries = await getAllLeagueEntries(leagueId);
  console.log(`Found ${entries.length} teams. Fetching GW${gameweek} points...`);

  let best = { entryId: null, entryName: null, playerName: null, points: -1 };
  const BATCH = 30;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (e) => {
        const entryId = e.entry ?? e.id;
        try {
          const history = await getEntryHistory(entryId);
          const points = getPointsForGameweek(history, gameweek);
          return { entryId, entryName: e.entry_name, playerName: e.player_name, points };
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r && r.points != null && r.points > best.points) {
        best = {
          entryId: r.entryId,
          entryName: r.entryName ?? 'Unknown',
          playerName: r.playerName ?? 'Unknown',
          points: r.points,
        };
      }
    }
    if ((i + batch.length) % 150 === 0 || i + batch.length >= entries.length) {
      console.log(`  Checked ${Math.min(i + BATCH, entries.length)}/${entries.length}...`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  if (best.entryId == null) {
    console.log(`No team with GW${gameweek} data found in league ${leagueId}.`);
    return;
  }

  console.log('\n--- Highest points in GW' + gameweek + ' ---');
  console.log('Team name:', best.entryName);
  console.log('Manager:  ', best.playerName);
  console.log('Entry ID: ', best.entryId);
  console.log('Points:   ', best.points);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
