import type { FplElement } from '../types/fpl';

export type Availability = { level: 'doubt' | 'out'; chance: number | null; label: string };

/**
 * FPL availability flag, or null when the player is fully available.
 * Doubtful (amber): 25–75% chance or status "d". Out (red): 0%, injured, suspended, unavailable or not eligible.
 */
export function getAvailability(
  el: Pick<FplElement, 'status' | 'chance_of_playing_next_round' | 'news'> | undefined
): Availability | null {
  if (!el) return null;
  const chance = el.chance_of_playing_next_round ?? null;
  const status = el.status ?? 'a';
  if (status === 'a' && (chance == null || chance >= 100)) return null;
  const out = chance === 0 || (chance == null && status !== 'd' && status !== 'a');
  const news = el.news?.trim();
  // FPL's news text usually already says "75% chance of playing"; only add the figure when it doesn't.
  const chanceText = chance != null && !news?.includes(`${chance}%`) ? `${chance}% chance of playing` : null;
  const label = [news, chanceText].filter(Boolean).join(' · ') || 'Availability doubt';
  return { level: out ? 'out' : 'doubt', chance, label };
}
