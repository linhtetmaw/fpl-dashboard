/**
 * Weekly crawl of the Myanmar FPL country league (league 167, ~13k managers) into the team search index, so
 * people can find their team by name. Weekly keeps renamed teams and new managers current; at the start of a new
 * FPL season the index is wiped first, because every team gets a new id.
 *
 * Cost: one standings page (50 teams) per request, ~260 requests per crawl, paced at PAGE_DELAY_MS.
 */
import { fplGet } from './fpl-api.js';
import { upsertTeam, getIndexMeta, setIndexMeta, clearIndex, saveNow, getIndexSize } from './search-index.js';

const MYANMAR_LEAGUE_ID = 167;
const CRAWL_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const PAGE_DELAY_MS = 400;
const MAX_PAGES = 2000; // safety stop (100k managers)

let crawling = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** "2026/27" from the first gameweek's deadline. */
async function currentSeason() {
  const bootstrap = await fplGet('/bootstrap-static/');
  const first = bootstrap.events?.[0]?.deadline_time;
  const year = first ? new Date(first).getUTCFullYear() : new Date().getUTCFullYear();
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

export async function crawlMyanmarLeague() {
  if (crawling) return;
  crawling = true;
  const started = Date.now();
  try {
    const season = await currentSeason();
    if (getIndexMeta().season !== season) {
      if (getIndexSize() > 0) console.log(`Search index: new season ${season}, clearing last season's teams.`);
      clearIndex();
      setIndexMeta({ season, last_crawl: null });
    }

    let page = 1;
    let teams = 0;
    for (; page <= MAX_PAGES; page++) {
      // Short cache TTL: a crawl wants fresh names, and these pages are only read here.
      const data = await fplGet(`/leagues-classic/${MYANMAR_LEAGUE_ID}/standings/?page_standings=${page}`, { ttl: 60 * 1000 });
      const rows = data.standings?.results ?? [];
      for (const r of rows) {
        upsertTeam({ entry: r.entry, entry_name: r.entry_name, player_name: r.player_name, mm_rank: r.rank, source: 'mm' }, { save: false });
      }
      teams += rows.length;
      if (!data.standings?.has_next || rows.length === 0) break;
      await sleep(PAGE_DELAY_MS);
    }
    setIndexMeta({ last_crawl: new Date().toISOString() });
    saveNow();
    console.log(`Search index: crawled Myanmar league, ${teams} teams over ${page} pages in ${Math.round((Date.now() - started) / 1000)}s (index size ${getIndexSize()}).`);
  } catch (err) {
    // Keep what we have; the next check retries.
    saveNow();
    console.error('Myanmar league crawl failed:', err.message);
  } finally {
    crawling = false;
  }
}

function crawlIfDue() {
  const last = getIndexMeta().last_crawl;
  if (!last || Date.now() - new Date(last).getTime() >= CRAWL_EVERY_MS) crawlMyanmarLeague();
}

/** Crawl shortly after startup if a week has passed (or never crawled), then re-check every few hours. */
export function startTeamCrawler() {
  setTimeout(crawlIfDue, 30 * 1000).unref();
  setInterval(crawlIfDue, CHECK_EVERY_MS).unref();
}
