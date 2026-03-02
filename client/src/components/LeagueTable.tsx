import { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import type { BootstrapStatic } from '../types/fpl';
import type { LeagueSortBy } from '../types/fpl';
import { getLeagueStandings, getEntryHistory } from '../api/fpl';

interface LeagueTableProps {
  leagueId: number;
  teamId: number;
  bootstrap: BootstrapStatic | undefined;
  onTeamClick?: (entryId: number) => void;
}

interface RowData {
  rank: number;
  entry: number;
  entry_name: string;
  player_name: string;
  points: number;
  movement: string;
  isCurrentUser: boolean;
}

function getCurrentMonthGameweekIds(bootstrap: BootstrapStatic): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  return (bootstrap.events ?? [])
    .filter((e) => {
      const d = new Date(e.deadline_time);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    })
    .map((e) => e.id);
}

export default function LeagueTable({ leagueId, teamId, bootstrap, onTeamClick }: LeagueTableProps) {
  const [sortBy, setSortBy] = useState<LeagueSortBy>('total');

  const { data: standingsData, isLoading: standingsLoading } = useQuery({
    queryKey: ['fpl', 'standings', leagueId, 1],
    queryFn: () => getLeagueStandings(leagueId, 1),
    enabled: leagueId > 0,
  });

  const results = standingsData?.standings?.results ?? [];
  const entryIds = results.map((r) => r.entry);

  const historyQueries = useQueries({
    queries:
      sortBy === 'monthly' && bootstrap && entryIds.length > 0
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

  const rows: RowData[] = useMemo(() => {
    const base: RowData[] = results.map((r) => ({
      rank: r.rank,
      entry: r.entry,
      entry_name: r.entry_name,
      player_name: r.player_name,
      points: sortBy === 'event_total' ? r.event_total : sortBy === 'monthly' ? (monthlyByEntry.get(r.entry) ?? 0) : r.total,
      movement: r.movement ?? '—',
      isCurrentUser: r.entry === teamId,
    }));

    if (sortBy === 'event_total') {
      return [...base].sort((a, b) => b.points - a.points);
    }
    if (sortBy === 'monthly') {
      return [...base].sort((a, b) => b.points - a.points);
    }
    return base;
  }, [results, sortBy, monthlyByEntry, teamId]);

  const isLoadingMonthly = sortBy === 'monthly' && historyQueries.some((q) => q.isLoading);

  return (
    <div className="rounded-xl border border-fpl-border bg-fpl-card overflow-hidden h-full flex flex-col min-h-0">
      <div className="shrink-0 p-4 border-b border-fpl-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 text-sm">Sort by</span>
        {(['total', 'event_total', 'monthly'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortBy === key
                ? 'bg-fpl-accent text-white'
                : 'bg-fpl-dark/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {key === 'total' ? 'Overall' : key === 'event_total' ? 'Current GW' : 'Monthly'}
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
        <div className="league-table-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-fpl-dark/60 border-b border-fpl-border text-slate-400 text-left">
                <th className="px-4 py-3 font-medium w-14">#</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium text-right">Points</th>
                <th className="px-4 py-3 font-medium w-16 text-center">Move</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.entry}
                  onClick={() => onTeamClick?.(row.entry)}
                  className={`border-b border-fpl-border/70 ${
                    row.isCurrentUser ? 'bg-fpl-accent/20' : idx % 2 === 1 ? 'bg-fpl-dark/20' : ''
                  } ${onTeamClick ? 'cursor-pointer hover:bg-fpl-accent/10' : ''}`}
                >
                  <td className="px-4 py-2.5 text-slate-400 font-medium">{idx + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-200">{row.entry_name}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{row.player_name}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-white">{row.points}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500 text-xs">{row.movement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isLoadingMonthly && (
        <div className="p-2 text-center text-slate-500 text-xs">Loading monthly points…</div>
      )}
    </div>
  );
}
