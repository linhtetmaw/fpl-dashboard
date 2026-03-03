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
    if (el.id != null && el.stats) liveByElement[el.id] = el.stats;
  });

  const chip = picks.chips?.[0]?.name ?? picks.active_chip ?? null;
  const players: PlayerPoints[] = [];
  let total_points = 0;
  let starting_points = 0;
  let bench_points = 0;

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
    const team_name = meta ? teams[meta.team] ?? 'Unknown' : 'Unknown';
    const web_name = meta?.web_name ?? `#${pick.element}`;
    const is_on_bench = pick.position > 11;
    const total_effective = stats.total_points * (pick.multiplier || 1);

    total_points += total_effective;
    if (is_on_bench) bench_points += total_effective;
    else starting_points += total_effective;

    players.push({
      element_id: pick.element,
      web_name,
      team_name,
      position: pick.position,
      element_type: elements[pick.element]?.element_type ?? 0,
      is_captain: pick.is_captain ?? false,
      is_vice_captain: pick.is_vice_captain ?? false,
      is_on_bench,
      minutes: stats.minutes,
      goals_scored: stats.goals_scored,
      assists: stats.assists,
      clean_sheets: stats.clean_sheets,
      bonus: stats.bonus,
      total_points_raw: stats.total_points,
      multiplier: pick.multiplier ?? 1,
      total_points_effective: total_effective,
    });
  }

  return {
    team_id: teamId,
    team_name: entryName,
    gameweek,
    chip,
    total_points,
    starting_points,
    bench_points,
    players,
  };
}

export function getCurrentEvent(bootstrap: BootstrapStatic | undefined): number | null {
  if (!bootstrap?.events?.length) return null;
  const current = bootstrap.events.find((e) => e.is_current);
  if (current) return current.id;
  const next = bootstrap.events.find((e) => e.is_next);
  return next?.id ?? bootstrap.events[0]?.id ?? null;
}

