/**
 * FPL news: player availability updates (injuries, suspensions, doubts), taken from the official FPL
 * bootstrap-static data and refreshed every REFRESH_MS, so the Player News page stays current without each
 * visitor downloading the full bootstrap payload.
 */
import { fplGet } from './fpl-api.js';

const REFRESH_MS = 20 * 60 * 1000;

/** @type {{ updated_at: string | null, players: object[] }} */
let latest = { updated_at: null, players: [] };
let refreshing = false;

export async function refreshFplNews() {
  if (refreshing) return;
  refreshing = true;
  try {
    const data = await fplGet('/bootstrap-static/');
    const players = (data.elements ?? [])
      .filter((e) => (e.news && String(e.news).trim()) || (e.status && e.status !== 'a'))
      .map((e) => ({
        id: e.id,
        web_name: e.web_name,
        first_name: e.first_name,
        second_name: e.second_name,
        code: e.code,
        team: e.team,
        element_type: e.element_type,
        status: e.status,
        chance_of_playing_next_round: e.chance_of_playing_next_round,
        news_en: String(e.news ?? '').trim(),
        news_added: e.news_added ?? null,
        selected_by_percent: e.selected_by_percent,
      }))
      .sort((a, b) => String(b.news_added ?? '').localeCompare(String(a.news_added ?? '')));
    latest = { updated_at: new Date().toISOString(), players };
  } catch (err) {
    console.error('FPL news refresh error:', err.message);
  } finally {
    refreshing = false;
  }
}

/** Player news, newest first. */
export function getFplNews() {
  return latest;
}

export function startFplNews() {
  refreshFplNews();
  setInterval(refreshFplNews, REFRESH_MS).unref();
}
