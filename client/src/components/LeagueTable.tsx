import { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { BootstrapStatic } from '../types/fpl';
import type { LeagueSortBy } from '../types/fpl';
import { getLeagueStandingsWithChips, getLeagueStandings } from '../api/fpl';
import { useFixtures } from '../hooks/useFplApi';

interface LeagueTableProps {
  leagueId: number;
  teamId: number;
  bootstrap: BootstrapStatic | undefined;
  onTeamClick?: (entryId: number) => void;
  /** Current gameweek (for fetching chip badges for all teams). */
  gameweek: number;
  /** Current user's chip this GW (used when standings-with-chips fails or for fallback). */
  currentUserChip?: string | null;
  /** Current user's overall rank in this league (shown pinned when their row isn't loaded yet). */
  userRank?: number | null;
  /** Total teams in the league, if known. */
  rankCount?: number | null;
}

interface RowData {
  rank: number;
  entry: number;
  entry_name: string;
  player_name: string;
  points: number;
  movement: string;
  isCurrentUser: boolean;
  chip?: string | null;
  /** Team value * 10 for selected GW (from entry history). */
  teamValue?: number | null;
  /** Players yet to kick off this GW (null if unknown). */
  toStart?: number | null;
}

const CHIP_LABELS: Record<string, string> = {
  bboost: 'BB',
  '3xc': 'TC',
  freehit: 'FH',
  wildcard: 'WC',
};

function formatChipLabel(chip: string): string {
  return CHIP_LABELS[chip.toLowerCase()] ?? chip;
}

function getCurrentMonthGameweekIds(bootstrap: BootstrapStatic): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const events = bootstrap.events ?? [];
  const inMonth = events
    .filter((e) => {
      const d = new Date(e.deadline_time);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    })
    .map((e) => e.id);
  if (inMonth.length > 0) return inMonth;
  const finished = events.filter((e) => e.finished);
  const lastN = finished.slice(-4).map((e) => e.id);
  return lastN.length > 0 ? lastN : events.slice(-4).map((e) => e.id);
}

export default function LeagueTable({ leagueId, teamId, bootstrap, onTeamClick, gameweek, currentUserChip, userRank, rankCount }: LeagueTableProps) {
  /** Default to Current GW so the top row is highest scorer in the selected gameweek, not overall. */
  const [sortBy, setSortBy] = useState<LeagueSortBy>('event_total');

  // Standings load 50 teams per page; big leagues (thousands of teams) load more only on request.
  const {
    data: standingsData,
    isLoading: standingsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['fpl', 'standings-with-chips', leagueId, gameweek],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      try {
        return await getLeagueStandingsWithChips(leagueId, pageParam, gameweek);
      } catch {
        return await getLeagueStandings(leagueId, pageParam);
      }
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.standings?.has_next ? allPages.length + 1 : undefined,
    enabled: leagueId > 0 && gameweek > 0,
  });

  const results = useMemo(
    () => standingsData?.pages.flatMap((p) => p.standings?.results ?? []) ?? [],
    [standingsData]
  );
  const userLoaded = results.some((r) => r.entry === teamId);

  const gwFinished = bootstrap?.events?.find((e) => e.id === gameweek)?.finished ?? false;
  // The gameweek's first match has kicked off (shares the fixtures query the rest of the page uses).
  const { data: gwFixtures } = useFixtures(gameweek);
  const gwStarted = gwFinished || (gwFixtures ?? []).some((f) => f.started);
  // "To start" only matters while the gameweek is on (and needs the league table's live data).
  const showToStart = !gwFinished && results.some((r) => r.to_start != null);
  /** Top gameweek score: live from the first kick-off (the leader so far), final once the gameweek is over. Nobody
   * until someone has scored, so a 0–0 start doesn't make everyone a winner. */
  const gwWinnerEntries = useMemo(() => {
    if (!gwStarted || results.length === 0) return new Set<number>();
    const maxPoints = Math.max(...results.map((r) => r.event_total ?? 0));
    if (maxPoints <= 0) return new Set<number>();
    return new Set(results.filter((r) => (r.event_total ?? 0) === maxPoints).map((r) => r.entry));
  }, [gwStarted, results]);
  /** Lowest gameweek score, live like the winner, but only when every team in the league is loaded (big leagues
   * load 50 at a time, so the last team on page 1 isn't necessarily the league's last), and not while all are level. */
  const gwLastEntries = useMemo(() => {
    if (!gwStarted || hasNextPage || results.length < 2) return new Set<number>();
    const points = results.map((r) => r.event_total ?? 0);
    const minPoints = Math.min(...points);
    if (minPoints === Math.max(...points)) return new Set<number>();
    return new Set(results.filter((r) => (r.event_total ?? 0) === minPoints).map((r) => r.entry));
  }, [gwStarted, hasNextPage, results]);

  // Captain, team value and per-GW points come with each row from the server (standings-with-chips), so the
  // table needs no extra request per team.
  const captainByEntry = useMemo(() => {
    const map = new Map<number, string>();
    if (!bootstrap?.elements?.length) return map;
    const nameById = new Map(bootstrap.elements.map((e) => [e.id, e.web_name ?? '']));
    for (const r of results) {
      const name = r.captain != null ? nameById.get(r.captain) : undefined;
      if (name) map.set(r.entry, name);
    }
    return map;
  }, [bootstrap?.elements, results]);

  const monthlyByEntry = useMemo(() => {
    if (sortBy !== 'monthly' || !bootstrap) return new Map<number, number>();
    const gwIds = new Set(getCurrentMonthGameweekIds(bootstrap));
    const map = new Map<number, number>();
    for (const r of results) {
      if (!r.history) continue;
      map.set(r.entry, r.history.reduce((acc, [event, points]) => acc + (gwIds.has(event) ? points : 0), 0));
    }
    return map;
  }, [sortBy, bootstrap, results]);

  const valueByEntry = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of results) if (typeof r.value === 'number') map.set(r.entry, r.value);
    return map;
  }, [results]);

  const rows: RowData[] = useMemo(() => {
    const base: RowData[] = results.map((r) => ({
      rank: r.rank,
      entry: r.entry,
      entry_name: r.entry_name,
      player_name: r.player_name,
      points: sortBy === 'event_total'
        ? r.event_total
        : sortBy === 'monthly'
          ? (monthlyByEntry.get(r.entry) ?? 0)
          : r.total,
      movement: r.movement ?? '—',
      isCurrentUser: r.entry === teamId,
      chip: r.chip ?? (r.entry === teamId ? currentUserChip ?? null : null),
      teamValue: valueByEntry.get(r.entry) ?? null,
      toStart: r.to_start ?? null,
    }));

    if (sortBy === 'event_total' || sortBy === 'monthly') {
      return [...base].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));
    }
    if (sortBy === 'team_value') {
      return [...base].sort((a, b) => (b.teamValue ?? 0) - (a.teamValue ?? 0));
    }
    return base;
  }, [results, sortBy, monthlyByEntry, valueByEntry, teamId, currentUserChip]);


  const renderRow = (row: RowData, position: number) => {
    const move = (row.movement ?? '').toString().toLowerCase();
    const moveNum = parseInt(row.movement as string, 10);
    const isUp = move === 'up' || move === 'u' || (Number.isInteger(moveNum) && moveNum > 0);
    const isDown = move === 'down' || move === 'd' || (Number.isInteger(moveNum) && moveNum < 0);
    return (
      <tr
        key={row.entry}
        onClick={() => onTeamClick?.(row.entry)}
        className={`border-b border-fpl-border/60 transition-colors ${
          row.isCurrentUser ? 'bg-fpl-brand/10 shadow-[inset_3px_0_0_0_#00FF85]' : ''
        } ${onTeamClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
      >
        <td className="px-2 sm:px-3 py-2 text-slate-400 font-medium tabular-nums">
          <span className="inline-flex items-center gap-0.5">
            {position.toLocaleString()}
            {isUp && <span className="text-emerald-400 text-[10px]" title="Rank up">▲</span>}
            {isDown && <span className="text-red-400 text-[10px]" title="Rank down">▼</span>}
          </span>
        </td>
        <td className="px-2 py-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-semibold text-slate-100 truncate block max-w-[140px] md:max-w-none md:overflow-visible md:whitespace-normal">
              {row.entry_name}
            </span>
            {gwWinnerEntries.has(row.entry) && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/40 shrink-0">
                Winner
              </span>
            )}
            {gwLastEntries.has(row.entry) && !gwWinnerEntries.has(row.entry) && (
              <span
                className="inline-flex items-center shrink-0 text-sm leading-none"
                role="img"
                aria-label="Lowest score this gameweek"
                title="Lowest score this gameweek"
              >
                💩
              </span>
            )}
            {row.chip && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase bg-fpl-brand/15 text-fpl-brand ring-1 ring-inset ring-fpl-brand/40 shrink-0">
                {formatChipLabel(row.chip)}
              </span>
            )}
          </div>
          <div className="text-slate-500 text-[11px] mt-0.5 truncate max-w-[140px] md:max-w-none md:overflow-visible md:whitespace-normal">
            {row.player_name}
            {captainByEntry.get(row.entry) ? <> · <span className="text-slate-400">C: {captainByEntry.get(row.entry)}</span></> : null}
          </div>
        </td>
        {showToStart && (
          <td
            className={`px-1 py-2 text-center tabular-nums ${row.toStart ? 'font-semibold text-slate-200' : 'text-slate-600'}`}
            title={row.toStart != null ? `${row.toStart} player${row.toStart === 1 ? '' : 's'} yet to kick off` : undefined}
          >
            {row.toStart ?? '—'}
          </td>
        )}
        <td className="px-2 py-2 text-right font-display font-bold text-white tabular-nums">{row.points}</td>
        <td className="px-2 sm:px-3 py-2 text-right text-slate-400 tabular-nums">
          {row.teamValue != null ? (row.teamValue / 10).toFixed(1) : '—'}
        </td>
      </tr>
    );
  };

  return (
    <div className="card overflow-hidden h-full flex flex-col min-h-0">
      <div className="shrink-0 p-3 border-b border-fpl-border flex flex-wrap items-center justify-between gap-2">
        <div className="segmented" role="group" aria-label="Sort standings by">
        {(['total', 'event_total', 'monthly', 'team_value'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortBy(key)}
            data-active={sortBy === key}
            aria-pressed={sortBy === key}
            className="!text-xs !px-2.5"
          >
            {key === 'total' ? 'Overall' : key === 'event_total' ? 'Current GW' : key === 'monthly' ? 'Monthly' : 'Team value'}
          </button>
        ))}
        </div>
        {onTeamClick && (
          <span className="text-slate-500 text-[11px]">Tap a row to view that team</span>
        )}
      </div>

      {standingsLoading && (
        <div className="p-3 space-y-2" aria-label="Loading standings">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-10 rounded-lg bg-fpl-raised animate-pulse" />
          ))}
        </div>
      )}

      {!standingsLoading && rows.length === 0 && (
        <div className="p-4 text-slate-400 text-center text-xs">No standings data.</div>
      )}

      {!standingsLoading && rows.length > 0 && (
        <div className="league-table-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto pb-2 md:pb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="sticky top-0 z-10 bg-fpl-raised border-b border-fpl-border text-left">
                <th className="eyebrow px-2 sm:px-3 py-2.5 w-10 sm:w-12">#</th>
                <th className="eyebrow px-2 py-2.5">Team</th>
                {showToStart && (
                  <th className="eyebrow px-1 py-2.5 text-center w-12 leading-tight" title="Players yet to kick off this gameweek">
                    To start
                  </th>
                )}
                <th className="eyebrow px-2 py-2.5 text-right w-14">Pts</th>
                <th className="eyebrow px-2 sm:px-3 py-2.5 text-right w-14 sm:w-16">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => renderRow(row, idx + 1))}
            </tbody>
          </table>
          {!userLoaded && userRank != null && (
            <button
              type="button"
              onClick={() => onTeamClick?.(teamId)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs bg-fpl-brand/10 shadow-[inset_3px_0_0_0_#00FF85] border-b border-fpl-border/60"
            >
              <span className="text-slate-300">Your team</span>
              <span className="font-display font-bold text-white tabular-nums">#{userRank.toLocaleString()}</span>
            </button>
          )}
          <div className="px-3 pt-3 flex flex-col items-center gap-2 text-slate-500 text-[11px]">
            <span>
              Showing top {results.length.toLocaleString()}
              {rankCount != null && rankCount > results.length ? ` of ${rankCount.toLocaleString()}` : ''} teams
            </span>
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-3 py-1.5 rounded-lg border border-fpl-border text-slate-200 hover:bg-white/[0.04] disabled:opacity-60"
              >
                {isFetchingNextPage ? 'Loading…' : 'Load 50 more'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
