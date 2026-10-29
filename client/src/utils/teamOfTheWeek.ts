import type { EventLiveResponse, FplElement, FplFixture } from '../types/fpl';
import type { LineupPlayer } from '../components/LineupPitch';
import { projectedBonus } from './bonus';

/** Formation limits by element_type (GKP 1, DEF 2, MID 3, FWD 4), as in FPL. */
const MIN_OF: Record<number, number> = { 1: 1, 2: 3, 3: 2, 4: 1 };
const MAX_OF: Record<number, number> = { 1: 1, 2: 5, 3: 5, 4: 3 };

/**
 * Team of the Week: the highest-scoring valid XI (1 GKP, 3–5 DEF, 2–5 MID, 1–3 FWD), the same rule as FPL's Dream
 * Team. Points include bonus projected from live BPS for matches FPL hasn't confirmed yet, so it works mid-gameweek.
 * Ties go to the higher BPS. Returns null until at least 11 players in a valid shape have played.
 */
export function teamOfTheWeek(
  elements: FplElement[],
  live: EventLiveResponse | undefined,
  fixtures: FplFixture[] | undefined
): { xi: LineupPlayer[]; star: LineupPlayer } | null {
  if (!live) return null;
  const byId = new Map(elements.map((e) => [e.id, e]));
  const projected = projectedBonus(fixtures);
  const players: LineupPlayer[] = [];
  for (const row of live.elements) {
    const id = (row.id ?? row.element)!;
    const e = byId.get(id);
    if (!e || !(row.stats.minutes > 0)) continue;
    const extra = projected.get(id) ?? 0;
    players.push({
      element: e,
      points: (Number(row.stats.total_points) || 0) + extra,
      bps: row.stats.bps ?? 0,
      dc: row.stats.defensive_contribution ?? 0,
      bonus: (row.stats.bonus ?? 0) + extra,
      goals: row.stats.goals_scored ?? 0,
      assists: row.stats.assists ?? 0,
      yellowCards: row.stats.yellow_cards ?? 0,
      redCards: row.stats.red_cards ?? 0,
    });
  }
  players.sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || (b.bps ?? 0) - (a.bps ?? 0));

  // Minimum of each position first (best players), then the best of the rest up to each position's maximum.
  const chosen = new Set<LineupPlayer>();
  const count: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const type of [1, 2, 3, 4]) {
    for (const p of players) {
      if (count[type] >= MIN_OF[type]) break;
      if (p.element.element_type === type) {
        chosen.add(p);
        count[type]++;
      }
    }
  }
  for (const p of players) {
    if (chosen.size >= 11) break;
    const type = p.element.element_type;
    if (!chosen.has(p) && count[type] < MAX_OF[type]) {
      chosen.add(p);
      count[type]++;
    }
  }
  if (chosen.size < 11) return null;
  const xi = players.filter((p) => chosen.has(p));
  return { xi, star: xi[0] };
}

export interface HousePick {
  kind: 'captain' | 'differential' | 'popular';
  element: FplElement;
  expected: number;
}

const num = (v: string | number | null | undefined) => Number(v) || 0;

/** How much easier or harder a fixture makes returns, by FPL difficulty (1 easiest – 5 hardest). */
const FIXTURE_FACTOR: Record<number, number> = { 1: 1.25, 2: 1.15, 3: 1, 4: 0.85, 5: 0.7 };
const HOME_FACTOR = 1.05;

/**
 * FPL House picks for the next gameweek. Each player's projection is his points per match (half recent form, half
 * season average, so one big haul doesn't decide it) scaled by each fixture's difficulty and home advantage, summed
 * over the gameweek's matches (two in a double gameweek):
 * - Captain: the best projection among midfielders and forwards (goals and assists are where big hauls come from).
 * - Differential: the best projection among players owned by under 10% (gains rank if he returns).
 * - Popular: the best projection among players owned by 20%+ (a safe choice most rivals have).
 * Only players expected to be available (no flag, or 75%+ chance) with a match that gameweek and regular minutes.
 */
export function housePicks(
  elements: FplElement[],
  nextFixtures: FplFixture[] | undefined,
  gwsPlayed: number
): HousePick[] {
  if (!nextFixtures?.length) return [];
  const minMinutes = Math.min(gwsPlayed, 6) * 45;
  const project = (e: FplElement) => {
    const perMatch = (num(e.form) + num(e.points_per_game)) / 2;
    return nextFixtures
      .filter((f) => f.team_h === e.team || f.team_a === e.team)
      .reduce((sum, f) => {
        const home = f.team_h === e.team;
        const difficulty = (home ? f.team_h_difficulty : f.team_a_difficulty) ?? 3;
        return sum + perMatch * (FIXTURE_FACTOR[difficulty] ?? 1) * (home ? HOME_FACTOR : 1);
      }, 0);
  };
  const pool = elements
    .filter((e) => e.status === 'a' || (e.chance_of_playing_next_round ?? 0) >= 75)
    .filter((e) => num(e.minutes) >= minMinutes)
    .map((e) => ({ e, expected: project(e) }))
    .filter((x) => x.expected > 0)
    .sort((a, b) => b.expected - a.expected);

  const picks: HousePick[] = [];
  const add = (kind: HousePick['kind'], test: (e: FplElement) => boolean) => {
    const x = pool.find(({ e }) => test(e) && !picks.some((p) => p.element.id === e.id));
    if (x) picks.push({ kind, element: x.e, expected: x.expected });
  };
  add('captain', (e) => e.element_type === 3 || e.element_type === 4);
  add('differential', (e) => num(e.selected_by_percent) < 10);
  add('popular', (e) => num(e.selected_by_percent) >= 20);
  return picks;
}
