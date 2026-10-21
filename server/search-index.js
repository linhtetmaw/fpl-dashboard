/**
 * Team search index: FPL team id → team name + manager name, searchable by either.
 *
 * Filled by the weekly Myanmar country-league crawl (team-crawler.js) and by every team or league table people
 * look up on the site. Kept in memory as a Map and saved to DATA_DIR (the Railway volume) a few seconds after
 * changes, so it survives deploys.
 *
 * Matching is forgiving: case, accents and punctuation are ignored ("thant treasure" finds "Thant_treasure"),
 * words can come in any order ("ko team" finds "Ko's Team"), and one typo is allowed in longer words.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const INDEX_PATH = path.join(DATA_DIR, 'search-index.json');
const SAVE_DELAY_MS = 5000;
const MAX_RESULTS = 30;

/**
 * @typedef {{ entry: number, entry_name: string, player_name: string, mm_rank?: number | null, source?: 'mm' | 'seen', updated_at?: string }} IndexEntry
 * @typedef {IndexEntry & { _team: string, _manager: string, _teamWords: string[], _managerWords: string[] }} Indexed
 */

/** @type {Map<number, Indexed>} */
const index = new Map();
/** @type {{ season: string | null, last_crawl: string | null }} */
let meta = { season: null, last_crawl: null };
let saveTimer = null;

/** Lowercase, strip accents, and turn punctuation into spaces. Myanmar script is kept as-is. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9က-႟]+/g, ' ')
    .trim();
}

function prepare(e) {
  const team = normalize(e.entry_name);
  const manager = normalize(e.player_name);
  return { ...e, _team: team, _manager: manager, _teamWords: team.split(' ').filter(Boolean), _managerWords: manager.split(' ').filter(Boolean) };
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, SAVE_DELAY_MS);
  saveTimer.unref?.();
}

export function saveNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const entries = [...index.values()].map(({ entry, entry_name, player_name, mm_rank, source, updated_at }) => ({
      entry,
      entry_name,
      player_name,
      mm_rank: mm_rank ?? null,
      source: source ?? 'seen',
      updated_at,
    }));
    const tmp = `${INDEX_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ meta, entries }), 'utf8');
    fs.renameSync(tmp, INDEX_PATH);
  } catch (err) {
    console.error('Search index save error:', err.message);
  }
}

export function loadIndex() {
  index.clear();
  try {
    const data = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    meta = { season: data.meta?.season ?? null, last_crawl: data.meta?.last_crawl ?? null };
    for (const e of Array.isArray(data.entries) ? data.entries : []) {
      const id = Number(e.entry);
      if (Number.isInteger(id) && id > 0 && e.entry_name) index.set(id, prepare({ ...e, entry: id }));
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Search index load error:', err.message);
    meta = { season: null, last_crawl: null };
  }
}

/** Add or update one team. `source: 'mm'` marks teams from the Myanmar country league (ranked higher in search). */
export function upsertTeam({ entry, entry_name, player_name, mm_rank, source }, { save = true } = {}) {
  const id = Number(entry);
  const name = String(entry_name ?? '').trim();
  if (!Number.isInteger(id) || id < 1 || !name) return;
  const prev = index.get(id);
  const manager = String(player_name ?? '').trim();
  const next = {
    entry: id,
    entry_name: name,
    player_name: manager || prev?.player_name || '',
    mm_rank: mm_rank ?? prev?.mm_rank ?? null,
    source: source === 'mm' || prev?.source === 'mm' ? 'mm' : 'seen',
    updated_at: new Date().toISOString(),
  };
  if (prev && prev.entry_name === next.entry_name && prev.player_name === next.player_name && prev.mm_rank === next.mm_rank && prev.source === next.source) {
    return;
  }
  index.set(id, prepare(next));
  if (save) scheduleSave();
}

/** Kept for existing callers (entry lookups). */
export function addToIndex(entry, entry_name, player_name) {
  upsertTeam({ entry, entry_name, player_name });
}

/** Add every team from a league standings page (rows from FPL's standings.results). */
export function addStandingsRows(rows) {
  for (const r of rows ?? []) upsertTeam({ entry: r.entry, entry_name: r.entry_name, player_name: r.player_name }, { save: false });
  scheduleSave();
}

/** True when two words are equal or one letter apart (insert, delete or substitute). */
function withinOneEdit(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Does query word q match one of these words (prefix, or a single typo for longer words)? 2 = prefix, 1 = typo, 0 = no. */
function wordMatch(q, words) {
  let best = 0;
  for (const w of words) {
    if (w.startsWith(q)) return 2;
    if (q.length >= 4 && (withinOneEdit(q, w) || (w.length > q.length && withinOneEdit(q, w.slice(0, q.length))))) best = 1;
  }
  return best;
}

/** Score how well a normalised query matches one field (0 = no match). */
function scoreField(q, qWords, field, words) {
  if (!field) return 0;
  if (field === q) return 100;
  const qc = q.replace(/ /g, '');
  const fc = field.replace(/ /g, '');
  if (fc === qc) return 95;
  if (field.startsWith(q) || fc.startsWith(qc)) return 85;
  // Phrase found starting at a word ("salah fc" in "mo salah fc") beats words matched loosely.
  if (` ${field}`.includes(` ${q}`)) return 70;
  const m = qWords.map((w) => wordMatch(w, words));
  if (m.every((x) => x === 2)) return 60;
  // Phrase found mid-word ("ko team" inside "ako team") ranks below whole-word matches.
  if (field.includes(q) || fc.includes(qc)) return 50;
  if (m.every((x) => x > 0)) return 40;
  return 0;
}

/**
 * Search by team name and/or manager name. `query` matches either field (or words split across both);
 * the optional `managerQuery` narrows results to that manager.
 */
export function searchIndex(query, managerQuery) {
  const q = normalize(query);
  const mq = normalize(managerQuery);
  if (!q && !mq) return [];
  const qWords = q.split(' ').filter(Boolean);
  const mWords = mq.split(' ').filter(Boolean);

  const scored = [];
  for (const e of index.values()) {
    if (mq && scoreField(mq, mWords, e._manager, e._managerWords) === 0) continue;
    let score = 0;
    if (q) {
      score = Math.max(scoreField(q, qWords, e._team, e._teamWords), scoreField(q, qWords, e._manager, e._managerWords) * 0.9);
      // Words split across team and manager, e.g. "salah aung" for team "Salah FC" by "Aung Aung".
      if (score === 0 && qWords.length > 1) {
        const all = [...e._teamWords, ...e._managerWords];
        if (qWords.every((w) => wordMatch(w, all) === 2)) score = 50;
      }
      if (score === 0) continue;
    } else {
      score = 50;
    }
    if (e.source === 'mm') score += 5;
    scored.push({ e, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.e.mm_rank ?? Infinity) - (b.e.mm_rank ?? Infinity) ||
      a.e.entry_name.length - b.e.entry_name.length
  );
  return scored.slice(0, MAX_RESULTS).map(({ e }) => ({
    entry: e.entry,
    entry_name: e.entry_name,
    player_name: e.player_name,
    mm_rank: e.mm_rank ?? null,
  }));
}

export function getIndexSize() {
  return index.size;
}

export function getIndexMeta() {
  return { ...meta };
}

export function setIndexMeta(patch) {
  meta = { ...meta, ...patch };
  scheduleSave();
}

/** Drop everything (new season: last season's team ids point to other teams). */
export function clearIndex() {
  index.clear();
  scheduleSave();
}
