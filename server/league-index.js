import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, 'data', 'league-index.json');

/** @type {{ id: number; name: string }[]} */
let leagues = [];

function ensureDataDir() {
  const dir = path.dirname(INDEX_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadLeagueIndex() {
  try {
    ensureDataDir();
    const raw = fs.readFileSync(INDEX_PATH, 'utf8');
    const data = JSON.parse(raw);
    leagues = Array.isArray(data.leagues) ? data.leagues : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('League index load error:', err.message);
    leagues = [];
  }
}

function saveLeagueIndex() {
  try {
    ensureDataDir();
    fs.writeFileSync(INDEX_PATH, JSON.stringify({ leagues }, null, 0), 'utf8');
  } catch (err) {
    console.error('League index save error:', err.message);
  }
}

export function addLeagueToIndex(id, name) {
  const numId = Number(id);
  const n = String(name ?? '').trim();
  if (!Number.isInteger(numId) || numId < 1 || !n) return;
  const existing = leagues.find((l) => l.id === numId);
  if (existing) {
    existing.name = n;
  } else {
    leagues.push({ id: numId, name: n });
  }
  saveLeagueIndex();
}

/**
 * Find leagues whose name contains the query (case-insensitive).
 * @param {string} leagueQuery
 * @returns {{ id: number; name: string }[]}
 */
export function searchLeaguesByName(leagueQuery) {
  const q = (leagueQuery ?? '').trim().toLowerCase();
  if (!q) return [];
  return leagues.filter((l) => l.name.toLowerCase().includes(q));
}

export function getLeagueIndexSize() {
  return leagues.length;
}
