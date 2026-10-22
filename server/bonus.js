/**
 * Projected FPL bonus from live BPS, for matches that have kicked off but whose bonus FPL hasn't awarded yet.
 * Mirrors client/src/utils/bonus.ts (used for the team pitch) so league tables show the same live points.
 */
function stat(f, identifier) {
  const s = (f.stats ?? []).find((x) => x.identifier === identifier);
  return [...(s?.h ?? []), ...(s?.a ?? [])];
}

/** Highest BPS 3, 2, 1; ties share the higher award and use up the places they cover (34/32/32 → 3, 2, 2). */
export function bonusFromBps(rows) {
  const out = new Map();
  const sorted = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
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

/** element id → projected bonus points (summed over a double gameweek). */
export function projectedBonus(fixtures) {
  const out = new Map();
  for (const f of Array.isArray(fixtures) ? fixtures : []) {
    if (!f.started || stat(f, 'bonus').length > 0) continue;
    for (const [element, bonus] of bonusFromBps(stat(f, 'bps'))) out.set(element, (out.get(element) ?? 0) + bonus);
  }
  return out;
}
