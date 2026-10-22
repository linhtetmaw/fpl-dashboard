import type { FplFixture } from '../types/fpl';

/** Same logic on the server for league tables: server/bonus.js. */

/** Defensive contribution needed for +2: defenders 10, midfielders/forwards 12 (goalkeepers can't earn it). */
export const DC_THRESHOLD: Record<number, number | undefined> = { 2: 10, 3: 12, 4: 12 };

export function fixtureStat(f: FplFixture, identifier: string) {
  const s = f.stats?.find((x) => x.identifier === identifier);
  return [...(s?.h ?? []), ...(s?.a ?? [])];
}

/** FPL has awarded this match's bonus (it's then already part of players' points). */
export function bonusAwarded(f: FplFixture): boolean {
  return fixtureStat(f, 'bonus').length > 0;
}

/**
 * FPL bonus from BPS: highest 3, 2, 1. Tied players share the higher award and use up the places they cover,
 * e.g. 34/32/32 → 3, 2, 2 (no 1) and 71/36/31/31 → 3, 2, 1, 1.
 */
export function bonusFromBps(rows: { element: number; value: number }[]): Map<number, number> {
  const out = new Map<number, number>();
  const sorted = [...rows].filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  let place = 0;
  let i = 0;
  while (i < sorted.length && place < 3) {
    const group = sorted.filter((r) => r.value === sorted[i].value);
    for (const r of group) out.set(r.element, 3 - place);
    place += group.length;
    i += group.length;
  }
  return out;
}

/** Projected bonus per player for matches that have kicked off but whose bonus FPL hasn't awarded yet. */
export function projectedBonus(fixtures: FplFixture[] | null | undefined): Map<number, number> {
  const out = new Map<number, number>();
  for (const f of fixtures ?? []) {
    if (!f.started || bonusAwarded(f)) continue;
    for (const [element, bonus] of bonusFromBps(fixtureStat(f, 'bps'))) {
      out.set(element, (out.get(element) ?? 0) + bonus);
    }
  }
  return out;
}
