import type { FplElement, SquadPick } from '../types/fpl';

/** Squad Planner rules (mirrors server/squads.js, which has the final say on save). */
export const BUDGET = 1000; // £100.0m in tenths
export const QUOTA: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 };
export const MAX_PER_CLUB = 3;
export const POSITION_SHORT: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
export const POSITION_PLURAL: Record<number, string> = { 1: 'Goalkeepers', 2: 'Defenders', 3: 'Midfielders', 4: 'Forwards' };
const MIN_START: Record<number, number> = { 1: 1, 2: 3, 3: 2, 4: 1 };
const MAX_START: Record<number, number> = { 1: 1, 2: 5, 3: 5, 4: 3 };

/** Working copy of a squad while it's being built. Element ids only; types and prices come from bootstrap. */
export interface SquadDraft {
  name: string;
  /** Every player in the squad (up to 15), in the order they were added. */
  players: number[];
  /** Starting XI (subset of players). */
  starters: number[];
  /** Outfield substitutes in bench order (the spare goalkeeper is implied). */
  bench: number[];
  captain: number | null;
  vice: number | null;
}

export const EMPTY_DRAFT: SquadDraft = { name: 'My Squad', players: [], starters: [], bench: [], captain: null, vice: null };

type TypeOf = (id: number) => number;

export function typeLookup(elements: FplElement[]): TypeOf {
  const map = new Map(elements.map((e) => [e.id, e.element_type]));
  return (id) => map.get(id) ?? 0;
}

function countTypes(ids: number[], typeOf: TypeOf): Record<number, number> {
  const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const id of ids) c[typeOf(id)] = (c[typeOf(id)] ?? 0) + 1;
  return c;
}

/** Whether a starting XI made of these counts can still be completed into a legal formation. */
function startersFeasible(c: Record<number, number>): boolean {
  const total = c[1] + c[2] + c[3] + c[4];
  if (total > 11) return false;
  if ([1, 2, 3, 4].some((t) => c[t] > MAX_START[t])) return false;
  const stillNeeded = [1, 2, 3, 4].reduce((n, t) => n + Math.max(0, MIN_START[t] - c[t]), 0);
  return stillNeeded <= 11 - total;
}

export function isValidXI(starters: number[], typeOf: TypeOf): boolean {
  const c = countTypes(starters, typeOf);
  return starters.length === 11 && c[1] === 1 && c[2] >= 3 && c[3] >= 2 && c[4] >= 1;
}

export function addPlayer(draft: SquadDraft, id: number, typeOf: TypeOf): SquadDraft {
  if (draft.players.includes(id)) return draft;
  const type = typeOf(id);
  const next = { ...draft, players: [...draft.players, id] };
  const counts = countTypes(draft.starters, typeOf);
  counts[type] += 1;
  if (startersFeasible(counts)) next.starters = [...draft.starters, id];
  else if (type !== 1) next.bench = [...draft.bench, id];
  return next;
}

export function removePlayer(draft: SquadDraft, id: number): SquadDraft {
  return {
    ...draft,
    players: draft.players.filter((p) => p !== id),
    starters: draft.starters.filter((p) => p !== id),
    bench: draft.bench.filter((p) => p !== id),
    captain: draft.captain === id ? null : draft.captain,
    vice: draft.vice === id ? null : draft.vice,
  };
}

/** Swap one player for another of the same position, keeping their place in the XI or on the bench. */
export function replacePlayer(draft: SquadDraft, outId: number, inId: number): SquadDraft {
  const swap = (list: number[]) => list.map((p) => (p === outId ? inId : p));
  return {
    ...draft,
    players: swap(draft.players),
    starters: swap(draft.starters),
    bench: swap(draft.bench),
    captain: draft.captain === outId ? null : draft.captain,
    vice: draft.vice === outId ? null : draft.vice,
  };
}

/** Whether `a` and `b` can swap places (starter ↔ substitute, or two substitutes reordering the bench). */
export function canSwap(draft: SquadDraft, a: number, b: number, typeOf: TypeOf): boolean {
  if (a === b) return false;
  const aStarts = draft.starters.includes(a);
  const bStarts = draft.starters.includes(b);
  if (aStarts === bStarts) return !aStarts && draft.bench.includes(a) && draft.bench.includes(b);
  if (typeOf(a) === 1 || typeOf(b) === 1) return typeOf(a) === typeOf(b);
  const [out, inn] = aStarts ? [a, b] : [b, a];
  const after = draft.starters.map((p) => (p === out ? inn : p));
  return draft.starters.length < 11 ? startersFeasible(countTypes(after, typeOf)) : isValidXI(after, typeOf);
}

export function swapPlayers(draft: SquadDraft, a: number, b: number): SquadDraft {
  const swap = (list: number[]) => list.map((p) => (p === a ? b : p === b ? a : p));
  const next = { ...draft, starters: swap(draft.starters), bench: swap(draft.bench) };
  // A starter moving to the bench loses the armband.
  if (next.captain != null && !next.starters.includes(next.captain)) next.captain = null;
  if (next.vice != null && !next.starters.includes(next.vice)) next.vice = null;
  return next;
}

export function setArmband(draft: SquadDraft, id: number, role: 'captain' | 'vice'): SquadDraft {
  if (role === 'captain') return { ...draft, captain: id, vice: draft.vice === id ? draft.captain : draft.vice };
  return { ...draft, vice: id, captain: draft.captain === id ? draft.vice : draft.captain };
}

/** Give a full squad a captain and vice if missing: the two most expensive starters. */
export function ensureArmband(draft: SquadDraft, priceOf: (id: number) => number): SquadDraft {
  if (draft.players.length !== 15 || (draft.captain != null && draft.vice != null)) return draft;
  const ranked = [...draft.starters].sort((x, y) => priceOf(y) - priceOf(x));
  const captain = draft.captain ?? ranked.find((id) => id !== draft.vice) ?? null;
  const vice = draft.vice ?? ranked.find((id) => id !== captain) ?? null;
  return { ...draft, captain, vice };
}

/** FPL-style picks: XI by position (GKP→FWD) in slots 1–11, spare goalkeeper 12, bench order 13–15. */
export function draftToPicks(draft: SquadDraft, typeOf: TypeOf): Omit<SquadPick, 'purchase_price'>[] {
  const xi = [...draft.starters].sort((a, b) => typeOf(a) - typeOf(b));
  const benchGk = draft.players.find((id) => typeOf(id) === 1 && !draft.starters.includes(id));
  const order = [...xi, ...(benchGk != null ? [benchGk] : []), ...draft.bench];
  return order.map((element, i) => ({
    element,
    position: i + 1,
    is_captain: draft.captain === element,
    is_vice_captain: draft.vice === element,
  }));
}

export function picksToDraft(name: string, picks: SquadPick[]): SquadDraft {
  const sorted = [...picks].sort((a, b) => a.position - b.position);
  return {
    name,
    players: sorted.map((p) => p.element),
    starters: sorted.filter((p) => p.position <= 11).map((p) => p.element),
    bench: sorted.filter((p) => p.position >= 13).map((p) => p.element),
    captain: sorted.find((p) => p.is_captain)?.element ?? null,
    vice: sorted.find((p) => p.is_vice_captain)?.element ?? null,
  };
}

/** What still blocks saving, in the order a user would fix it. Empty when the squad is ready. */
export function squadProblems(
  draft: SquadDraft,
  elementsById: Map<number, FplElement>,
  priceOf: (id: number) => number
): string[] {
  const problems: string[] = [];
  const typeOf = (id: number) => elementsById.get(id)?.element_type ?? 0;
  const counts = countTypes(draft.players, typeOf);
  const missing = [1, 2, 3, 4]
    .filter((t) => counts[t] < QUOTA[t])
    .map((t) => `${QUOTA[t] - counts[t]} ${POSITION_SHORT[t]}`);
  if (missing.length) problems.push(`Add ${missing.join(', ')}`);
  const spent = draft.players.reduce((n, id) => n + priceOf(id), 0);
  if (spent > BUDGET) problems.push(`Over budget by £${((spent - BUDGET) / 10).toFixed(1)}m`);
  const clubs = new Map<number, number>();
  for (const id of draft.players) {
    const team = elementsById.get(id)?.team;
    if (team != null) clubs.set(team, (clubs.get(team) ?? 0) + 1);
  }
  if ([...clubs.values()].some((n) => n > MAX_PER_CLUB)) problems.push('Max 3 players per club');
  if (draft.players.length === 15 && !isValidXI(draft.starters, typeOf)) problems.push('Fix your starting XI');
  if (draft.players.length === 15 && (draft.captain == null || draft.vice == null)) problems.push('Pick a captain and vice-captain');
  return problems;
}
