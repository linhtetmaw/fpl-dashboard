import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, 'data', 'search-index.json');

/** @type {{ entry: number; entry_name: string; player_name: string }[]} */
let index = [];

function ensureDataDir() {
  const dir = path.dirname(INDEX_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadIndex() {
  try {
    ensureDataDir();
    const raw = fs.readFileSync(INDEX_PATH, 'utf8');
    const data = JSON.parse(raw);
    index = Array.isArray(data.entries) ? data.entries : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Search index load error:', err.message);
    index = [];
  }
}

function saveIndex() {
  try {
    ensureDataDir();
    fs.writeFileSync(INDEX_PATH, JSON.stringify({ entries: index }, null, 0), 'utf8');
  } catch (err) {
    console.error('Search index save error:', err.message);
  }
}

export function addToIndex(entry, entry_name, player_name) {
  if (!entry || !entry_name) return;
  const id = Number(entry);
  if (!Number.isInteger(id) || id < 1) return;
  const name = String(entry_name).trim();
  const manager = String(player_name ?? '').trim();
  const existing = index.find((r) => r.entry === id);
  if (existing) {
    existing.entry_name = name;
    existing.player_name = manager;
  } else {
    index.push({ entry: id, entry_name: name, player_name: manager });
  }
  saveIndex();
}

export function searchIndex(teamQuery, managerQuery) {
  const team = (teamQuery ?? '').trim().toLowerCase();
  const manager = (managerQuery ?? '').trim().toLowerCase();
  if (!team) return [];
  return index.filter((r) => {
    const matchTeam = r.entry_name.toLowerCase().includes(team);
    const matchManager = manager === '' || r.player_name.toLowerCase().includes(manager);
    return matchTeam && matchManager;
  });
}

export function getIndexSize() {
  return index.length;
}
