import { useQuery } from '@tanstack/react-query';
import type {
  BootstrapStatic,
  PicksResponse,
  EventLiveResponse,
  TeamPointsSummary,
  PlayerPoints,
} from '../types/fpl';
import {
  getBootstrapStatic,
  getEntry,
  getTeamPicks,
  getEventLive,
  getEntryHistory,
  getLeagueStandings,
  getFixtures,
  getElementSummary,
} from '../api/fpl';

const BOOTSTRAP_QUERY_KEY = ['fpl', 'bootstrap-static'] as const;
const ENTRY_QUERY_KEY = ['fpl', 'entry'] as const;
const PICKS_QUERY_KEY = ['fpl', 'picks'] as const;
const LIVE_QUERY_KEY = ['fpl', 'live'] as const;
const HISTORY_QUERY_KEY = ['fpl', 'history'] as const;
const STANDINGS_QUERY_KEY = ['fpl', 'standings'] as const;

/** Bootstrap (players, teams, events, transfer counts) cached 24h; refresh follows this cycle. */
export function useBootstrapStatic() {
  return useQuery({
    queryKey: BOOTSTRAP_QUERY_KEY,
    queryFn: getBootstrapStatic,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useEntry(teamId: number | null) {
  return useQuery({
    queryKey: [...ENTRY_QUERY_KEY, teamId],
    queryFn: () => getEntry(teamId!),
    enabled: teamId != null && teamId > 0,
  });
}

export function useTeamPicks(teamId: number | null, gameweek: number | null) {
  return useQuery({
    queryKey: [...PICKS_QUERY_KEY, teamId, gameweek],
    queryFn: () => getTeamPicks(teamId!, gameweek!),
    enabled: teamId != null && gameweek != null && teamId > 0,
  });
}

export function useEventLive(gameweek: number | null) {
  return useQuery({
    queryKey: [...LIVE_QUERY_KEY, gameweek],
    queryFn: () => getEventLive(gameweek!),
    enabled: gameweek != null && gameweek > 0,
  });
}

export function useEntryHistory(teamId: number | null) {
  return useQuery({
    queryKey: [...HISTORY_QUERY_KEY, teamId],
    queryFn: () => getEntryHistory(teamId!),
    enabled: teamId != null && teamId > 0,
  });
}

export function useLeagueStandings(leagueId: number | null, page: number) {
  return useQuery({
    queryKey: [...STANDINGS_QUERY_KEY, leagueId, page],
    queryFn: () => getLeagueStandings(leagueId!, page),
    enabled: leagueId != null && leagueId > 0,
  });
}

const FIXTURES_QUERY_KEY = ['fpl', 'fixtures'] as const;

export function useFixtures(gameweek: number | null) {
  return useQuery({
    queryKey: [...FIXTURES_QUERY_KEY, gameweek],
    queryFn: () => getFixtures(gameweek ?? undefined),
    enabled: gameweek != null && gameweek > 0,
    staleTime: 2 * 60 * 1000,
  });
}

/** All fixtures (no event filter); for FDR table. */
export function useAllFixtures() {
  return useQuery({
    queryKey: [...FIXTURES_QUERY_KEY, 'all'],
    queryFn: () => getFixtures(),
    staleTime: 2 * 60 * 1000,
  });
}

const ELEMENT_SUMMARY_QUERY_KEY = ['fpl', 'element-summary'] as const;

export function useElementSummary(elementId: number | null) {
  return useQuery({
    queryKey: [...ELEMENT_SUMMARY_QUERY_KEY, elementId],
    queryFn: () => getElementSummary(elementId!),
    enabled: elementId != null && elementId > 0,
    staleTime: 2 * 60 * 1000,
  });
}

export function computeTeamPointsSummary(
  teamId: number,
  gameweek: number,
  bootstrap: BootstrapStatic,
  picks: PicksResponse,
  live: EventLiveResponse,
  entryName: string | null
): TeamPointsSummary {
  const elements: Record<number, { web_name: string; team: number; element_type: number }> = {};
  bootstrap.elements.forEach((e) => {
    elements[e.id] = { web_name: e.web_name, team: e.team, element_type: e.element_type };
  });
  const teams: Record<number, string> = {};
  bootstrap.teams.forEach((t) => {
    teams[t.id] = t.name;
  });

  const liveByElement: Record<number, EventLiveResponse['elements'][0]['stats']> = {};
  live.elements.forEach((el) => {
    const elementId = el.id ?? (el as { element?: number }).element;
    if (elementId != null && el.stats) liveByElement[elementId] = el.stats;
  });

  const chip = picks.chips?.[0]?.name ?? picks.active_chip ?? null;
  const players: PlayerPoints[] = [];

  for (const pick of picks.picks) {
    const meta = elements[pick.element];
    const stats = liveByElement[pick.element] ?? {
      minutes: 0,
      goals_scored: 0,
      assists: 0,
      clean_sheets: 0,
      bonus: 0,
      total_points: 0,
    };
    const rawMinutes = stats.minutes;
    const minutes = typeof rawMinutes === 'number' && Number.isFinite(rawMinutes) ? rawMinutes : Number(rawMinutes) || 0;
    const team_name = meta ? teams[meta.team] ?? 'Unknown' : 'Unknown';
    const web_name = meta?.web_name ?? `#${pick.element}`;
    const is_on_bench = pick.position > 11;
    const total_effective = (Number(stats.total_points) || 0) * (pick.multiplier || 1);

    players.push({
      element_id: pick.element,
      web_name,
      team_name,
      position: pick.position,
      element_type: elements[pick.element]?.element_type ?? 0,
      is_captain: pick.is_captain ?? false,
      is_vice_captain: pick.is_vice_captain ?? false,
      is_on_bench,
      minutes,
      goals_scored: stats.goals_scored,
      assists: stats.assists,
      clean_sheets: stats.clean_sheets,
      bonus: stats.bonus,
      total_points_raw: stats.total_points,
      multiplier: pick.multiplier ?? 1,
      total_points_effective: total_effective,
    });
  }

  const starting = players.filter((p) => !p.is_on_bench).sort((a, b) => a.position - b.position);
  const bench = players.filter((p) => p.is_on_bench).sort((a, b) => a.position - b.position);
  const getMins = (p: PlayerPoints) => (typeof p.minutes === 'number' && Number.isFinite(p.minutes) ? p.minutes : Number(p.minutes) || 0);

  // FPL rule: a bench player can only substitute for a non-playing starter of the same position (GKP→GKP, DEF→DEF, MID→MID, FWD→FWD).
  // Find first bench player (in bench order) with matching element_type; each bench player used at most once.
  const usedBenchIndices = new Set<number>();
  const findBenchSub = (elementType: number): number => {
    for (let i = 0; i < bench.length; i++) {
      if (!usedBenchIndices.has(i) && bench[i].element_type === elementType) return i;
    }
    return -1;
  };

  let starting_points = 0;
  const effectivePitchPlayers: PlayerPoints[] = [];
  const replacedStarters: PlayerPoints[] = [];
  for (const starter of starting) {
    if (getMins(starter) > 0) {
      effectivePitchPlayers.push(starter);
      starting_points += starter.total_points_effective;
    } else {
      const subIdx = findBenchSub(starter.element_type);
      if (subIdx >= 0) {
        usedBenchIndices.add(subIdx);
        const sub = bench[subIdx];
        effectivePitchPlayers.push({
          ...sub,
          position: starter.position,
          element_type: starter.element_type,
          is_on_bench: false,
          is_substitute: true,
        });
        starting_points += sub.total_points_effective;
        replacedStarters.push(starter);
      } else {
        effectivePitchPlayers.push(starter);
      }
    }
  }

  let bench_points = 0;
  const effectiveBench: PlayerPoints[] = [];
  for (let i = 0; i < bench.length; i++) {
    if (usedBenchIndices.has(i)) continue;
    effectiveBench.push(bench[i]);
    bench_points += bench[i].total_points_effective;
  }

  const isBenchBoost = chip != null && /bench\s*boost|bboost/i.test(String(chip));
  const total_points = starting_points + (isBenchBoost ? bench_points : 0);

  return {
    team_id: teamId,
    team_name: entryName,
    gameweek,
    chip,
    total_points,
    starting_points,
    bench_points,
    players,
    effectivePitchPlayers,
    effectiveBench,
    replacedStarters,
  };
}

export function getCurrentEvent(bootstrap: BootstrapStatic | undefined): number | null {
  if (!bootstrap?.events?.length) return null;
  const current = bootstrap.events.find((e) => e.is_current);
  if (current) return current.id;
  const next = bootstrap.events.find((e) => e.is_next);
  return next?.id ?? bootstrap.events[0]?.id ?? null;
}

