import { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import type { BootstrapStatic } from '../types/fpl';
import type { LeagueSortBy } from '../types/fpl';
import { getLeagueStandingsWithChips, getLeagueStandings, getEntryHistory } from '../api/fpl';

interface LeagueTableProps {
  leagueId: number;
  teamId: number;
  bootstrap: BootstrapStatic | undefined;
  onTeamClick?: (entryId: number) => void;
  /** Current gameweek (for fetching chip badges for all teams). */
  gameweek: number;
  /** Current user's chip this GW (used when standings-with-chips fails or for fallback). */
  currentUserChip?: string | null;
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

export default function LeagueTable({ leagueId, teamId, bootstrap, onTeamClick, gameweek, currentUserChip }: LeagueTableProps) {
  const [sortBy, setSortBy] = useState<LeagueSortBy>('total');

  const { data: standingsData, isLoading: standingsLoading } = useQuery({
    queryKey: ['fpl', 'standings-with-chips', leagueId, 1, gameweek],
    queryFn: async () => {
      try {
        return await getLeagueStandingsWithChips(leagueId, 1, gameweek);
      } catch {
        return await getLeagueStandings(leagueId, 1);
      }
    },
    enabled: leagueId > 0 && gameweek > 0,
  });

  const results = standingsData?.standings?.results ?? [];
  const entryIds = results.map((r) => r.entry);

  const historyQueries = useQueries({
    queries:
      entryIds.length > 0
        ? entryIds.slice(0, 50).map((entryId) => ({
            queryKey: ['fpl', 'history', entryId],
            queryFn: () => getEntryHistory(entryId),
            staleTime: 60 * 1000,
          }))
        : [],
  });

  const monthlyByEntry = useMemo(() => {
    if (sortBy !== 'monthly' || !bootstrap) return new Map<number, number>();
    const gwIds = getCurrentMonthGameweekIds(bootstrap);
    const map = new Map<number, number>();
    entryIds.slice(0, 50).forEach((entryId, i) => {
      const res = historyQueries[i]?.data;
      if (!res?.current) return;
      const sum = res.current
        .filter((c) => gwIds.includes(c.event))
        .reduce((acc, c) => acc + c.points, 0);
      map.set(entryId, sum);
    });
    return map;
  }, [sortBy, bootstrap, entryIds, historyQueries]);

  const valueByEntry = useMemo(() => {
    const map = new Map<number, number>();
    entryIds.slice(0, 50).forEach((entryId, i) => {
      const res = historyQueries[i]?.data;
      const cur = res?.current?.find((c) => c.event === gameweek);
      if (cur != null && typeof cur.value === 'number') map.set(entryId, cur.value);
    });
    return map;
  }, [gameweek, entryIds, historyQueries]);

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
    }));

    if (sortBy === 'event_total' || sortBy === 'monthly') {
      return [...base].sort((a, b) => b.points - a.points);
    }
    if (sortBy === 'team_value') {
      return [...base].sort((a, b) => (b.teamValue ?? 0) - (a.teamValue ?? 0));
    }
    return base;
  }, [results, sortBy, monthlyByEntry, valueByEntry, teamId, currentUserChip]);

  const isLoadingMonthly = sortBy === 'monthly' && historyQueries.some((q) => q.isLoading);
  const isLoadingValue = sortBy === 'team_value' && historyQueries.some((q) => q.isLoading);

  return (
    <div className="rounded-xl border border-fpl-border bg-fpl-card overflow-hidden h-full flex flex-col min-h-0">
      <div className="shrink-0 p-4 border-b border-fpl-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 text-sm">Sort by</span>
        {(['total', 'event_total', 'monthly', 'team_value'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortBy === key
                ? 'bg-fpl-accent text-white'
                : 'bg-fpl-dark/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {key === 'total' ? 'Overall' : key === 'event_total' ? 'Current GW' : key === 'monthly' ? 'Monthly' : 'Team value'}
          </button>
        ))}
        </div>
        {onTeamClick && (
          <span className="text-slate-500 text-xs">Click a row to view that team</span>
        )}
      </div>

      {standingsLoading && (
        <div className="p-8 text-slate-400 text-center">Loading standings…</div>
      )}

      {!standingsLoading && rows.length === 0 && (
        <div className="p-8 text-slate-400 text-center">No standings data.</div>
      )}

      {!standingsLoading && rows.length > 0 && (
        <div className="league-table-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto pb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-fpl-dark/60 border-b border-fpl-border text-slate-400 text-left">
                <th className="px-4 py-3 font-medium w-16">#</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium text-right">Points</th>
                <th className="px-4 py-3 font-medium text-right w-20">Team value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const move = (row.movement ?? '').toString().toLowerCase();
                const moveNum = parseInt(row.movement as string, 10);
                const isUp = move === 'up' || move === 'u' || (Number.isInteger(moveNum) && moveNum > 0);
                const isDown = move === 'down' || move === 'd' || (Number.isInteger(moveNum) && moveNum < 0);
                return (
                  <tr
                    key={row.entry}
                    onClick={() => onTeamClick?.(row.entry)}
                    className={`border-b border-fpl-border/70 ${
                      row.isCurrentUser ? 'bg-fpl-accent/20' : idx % 2 === 1 ? 'bg-fpl-dark/20' : ''
                    } ${onTeamClick ? 'cursor-pointer hover:bg-fpl-accent/10' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-slate-400 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {idx + 1}
                        {isUp && <span className="text-emerald-400" title="Rank up">▲</span>}
                        {isDown && <span className="text-red-400" title="Rank down">▼</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-slate-200">{row.entry_name}</span>
                        {row.chip && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-fpl-accent/30 text-fpl-accent border border-fpl-accent/50">
                            {formatChipLabel(row.chip)}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">{row.player_name}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-white">{row.points}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300 text-sm">
                      {row.teamValue != null ? (row.teamValue / 10).toFixed(1) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(isLoadingMonthly || isLoadingValue) && (
        <div className="p-2 text-center text-slate-500 text-xs">
          {isLoadingMonthly ? 'Loading monthly points…' : 'Loading team values…'}
        </div>
      )}
    </div>
  );
}
