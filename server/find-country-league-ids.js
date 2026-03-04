#!/usr/bin/env node
/**
 * One-off script: fetch league names for IDs 1–300 to find country league IDs.
 * FPL API: GET .../leagues-classic/{id}/standings/?page_standings=1 returns league.name.
 */

import fetch from 'node-fetch';

const TARGET_COUNTRIES = ['Cambodia', 'Thailand', 'Malaysia', 'Vietnam', 'Singapore'];
const MAX_ID = 300;
const DELAY_MS = 100;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getLeagueName(id) {
  const url = `https://fantasy.premierleague.com/api/leagues-classic/${id}/standings/?page_standings=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FPLDashboard/1.0)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.league?.name ?? null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('Looking for country league IDs (1–' + MAX_ID + ')...\n');
  const found = [];
  for (let id = 1; id <= MAX_ID; id++) {
    const name = await getLeagueName(id);
    if (name) {
      const match = TARGET_COUNTRIES.find((c) => name.toLowerCase() === c.toLowerCase());
      if (match) {
        found.push({ id, name });
        console.log('Found: ' + id + ' = ' + name);
      }
    }
    await sleep(DELAY_MS);
  }
  console.log('\n--- Result ---');
  if (found.length === 0) {
    console.log('No matching countries in range 1–' + MAX_ID + '. Try increasing MAX_ID.');
  } else {
    found.forEach(({ id, name }) => console.log(id + ' = ' + name));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
