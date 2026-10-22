import type { FplFixture } from '../types/fpl';

/** Kicked off and the final whistle hasn't gone yet. */
export function isFixtureLive(f: FplFixture): boolean {
  if (f.finished || f.finished_provisional) return false;
  // Older payloads without `started`: a score only appears once the match is under way.
  return f.started ?? (f.team_h_score != null && f.team_a_score != null);
}

export function anyFixtureLive(fixtures: FplFixture[] | null | undefined): boolean {
  return (fixtures ?? []).some(isFixtureLive);
}
