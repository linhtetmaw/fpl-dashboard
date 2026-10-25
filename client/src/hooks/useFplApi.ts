import { useQuery } from '@tanstack/react-query';
import type {
  BootstrapStatic,
  PicksResponse,
  EventLiveResponse,
  FplFixture,
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
  getTransferSuggestions,
} from '../api/fpl';
import { anyFixtureLive } from '../utils/fixtureStatus';
import { projectedBonus } from '../utils/bonus';

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

/** Live points for a gameweek. Pass `matchesInPlay` to re-fetch every minute while games are being played. */
export function useEventLive(gameweek: number | null, matchesInPlay = false) {
  return useQuery({
    queryKey: [...LIVE_QUERY_KEY, gameweek],
    queryFn: () => getEventLive(gameweek!),
    enabled: gameweek != null && gameweek > 0,
    refetchInterval: matchesInPlay ? 60 * 1000 : false,
  });
}

/** Algorithmic transfer suggestions for the upcoming gameweek (server caches for 10 minutes). Only fetched once
 * `requested` is true (the user pressed "Analyse my team"). */
export function useTransferSuggestions(teamId: number | null, requested = true) {
  return useQuery({
    queryKey: ['fpl', 'transfer-suggestions', teamId],
    queryFn: () => getTransferSuggestions(teamId!),
    enabled: requested && teamId != null && teamId > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
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
    // Keep scores, minutes and "in play" badges current while a match is on (the server refreshes from FPL every
    // 30 seconds during a gameweek).
    refetchInterval: (query) => (anyFixtureLive(query.state.data) ? 30 * 1000 : false),
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
  /** Fixtures for this gameweek; null if unavailable (then no auto-subs or armband changes are applied). */
  fixtures: FplFixture[] | null,
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

  // Bonus for matches under way (or awaiting FPL's confirmation) is projected from live BPS and counted now;
  // it can still change, e.g. if another player in that match overtakes on BPS.
  const bonusProjected = projectedBonus(fixtures?.filter((f) => f.event === gameweek));

  const chip = picks.chips?.[0]?.name ?? picks.active_chip ?? null;
  const isBenchBoost = chip != null && /bench\s*boost|bboost/i.test(String(chip));
  const players: PlayerPoints[] = [];

  // Clubs with a fixture this GW that hasn't reached full time. Without fixtures we can't tell, so treat every club as pending (no auto-subs).
  const clubsStillPlaying = new Set<number>();
  if (fixtures) {
    for (const f of fixtures) {
      if (f.event === gameweek && !(f.finished || f.finished_provisional)) {
        clubsStillPlaying.add(f.team_h);
        clubsStillPlaying.add(f.team_a);
      }
    }
  }
  const isGameweekOver = (elementId: number) => {
    if (!fixtures) return false;
    const club = elements[elementId]?.team;
    return club != null && !clubsStillPlaying.has(club);
  };

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
    const projected_bonus = bonusProjected.get(pick.element) ?? 0;
    const rawPoints = (Number(stats.total_points) || 0) + projected_bonus;
    const total_effective = rawPoints * (pick.multiplier || 1);

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
      total_points_raw: rawPoints,
      multiplier: pick.multiplier ?? 1,
      total_points_effective: total_effective,
      projected_bonus,
      defensive_contribution: stats.defensive_contribution ?? 0,
      yellow_cards: stats.yellow_cards ?? 0,
      red_cards: stats.red_cards ?? 0,
    });
  }

  const getMins = (p: PlayerPoints) => (typeof p.minutes === 'number' && Number.isFinite(p.minutes) ? p.minutes : Number(p.minutes) || 0);
  // A player only counts as "did not play" once all of their club's fixtures this GW are over (blank GW counts as over).
  const didNotPlay = (p: PlayerPoints) => getMins(p) === 0 && isGameweekOver(p.element_id);

  // Armband: if the captain did not play, the vice-captain (if they played) gets the captain's multiplier (x2, or x3 with Triple Captain).
  const captain = players.find((p) => p.is_captain && !p.is_on_bench);
  const vice = players.find((p) => p.is_vice_captain && !p.is_on_bench);
  const captainMultiplier = captain && captain.multiplier > 1 ? captain.multiplier : 2;
  const armbandId =
    captain && didNotPlay(captain) && vice && getMins(vice) > 0 ? vice.element_id : captain?.element_id;
  // Picks API gives bench players multiplier 0; score everyone at 1x (bench points are shown raw) except the armband holder.
  for (const p of players) {
    p.multiplier = p.element_id === armbandId ? captainMultiplier : 1;
    p.total_points_effective = (Number(p.total_points_raw) || 0) * p.multiplier;
  }

  const starting = players.filter((p) => !p.is_on_bench).sort((a, b) => a.position - b.position);
  const bench = players.filter((p) => p.is_on_bench).sort((a, b) => a.position - b.position);

  // FPL auto-sub rules: starters are processed in pitch order; each takes the first bench player (in bench order) who
  // played. GKP only swaps with GKP. Outfield swaps are allowed across positions as long as the XI keeps at least 3 DEF,
  // 2 MID and 1 FWD. A bench player whose match hasn't been played yet keeps their place in the queue (shown as the
  // sub until it's over); the next one is only reached if they end up not playing. No auto-subs with Bench Boost.
  const typeCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const s of starting) typeCounts[s.element_type] = (typeCounts[s.element_type] ?? 0) + 1;
  const formationValidAfterSwap = (outType: number, inType: number) => {
    const c = { ...typeCounts };
    c[outType] -= 1;
    c[inType] = (c[inType] ?? 0) + 1;
    return c[2] >= 3 && c[3] >= 2 && c[4] >= 1;
  };
  const usedBenchIndices = new Set<number>();
  const subFor = new Map<number, PlayerPoints>();
  if (!isBenchBoost) {
    for (const starter of starting) {
      if (!didNotPlay(starter)) continue;
      const subIdx = bench.findIndex((b, i) => {
        if (usedBenchIndices.has(i) || didNotPlay(b)) return false;
        if (starter.element_type === 1 || b.element_type === 1) return starter.element_type === b.element_type;
        return formationValidAfterSwap(starter.element_type, b.element_type);
      });
      if (subIdx < 0) continue;
      usedBenchIndices.add(subIdx);
      typeCounts[starter.element_type] -= 1;
      typeCounts[bench[subIdx].element_type] += 1;
      subFor.set(starter.element_id, bench[subIdx]);
    }
  }

  let starting_points = 0;
  const effectivePitchPlayers: PlayerPoints[] = [];
  const replacedStarters: PlayerPoints[] = [];
  for (const starter of starting) {
    const sub = subFor.get(starter.element_id);
    if (sub) {
      effectivePitchPlayers.push({ ...sub, position: starter.position, is_on_bench: false, is_substitute: true });
      starting_points += sub.total_points_effective;
      // The starter goes to the bench slot the sub came from (the goalkeeper stays first, as in FPL).
      replacedStarters.push({ ...starter, position: sub.position });
    } else {
      effectivePitchPlayers.push(starter);
      starting_points += starter.total_points_effective;
    }
  }

  let bench_points = 0;
  const effectiveBench: PlayerPoints[] = [];
  for (let i = 0; i < bench.length; i++) {
    if (usedBenchIndices.has(i)) continue;
    effectiveBench.push(bench[i]);
    bench_points += bench[i].total_points_effective;
  }

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

