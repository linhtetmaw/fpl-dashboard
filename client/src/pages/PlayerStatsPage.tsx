import { useMemo, useState } from 'react';
import { useBootstrapStatic } from '../hooks/useFplApi';
import PlayersNews from '../components/PlayersNews';
import type { FplElement, FplTeam } from '../types/fpl';

const TOP_N = 10;
/** Approx rows visible in first view before scrolling (row height ~36px). */
const ROWS_IN_FIRST_VIEW = 20;

const POS_LABELS: Record<number, string> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

function TransfersTable({
  title,
  rows,
  countLabel,
}: {
  title: string;
  rows: { name: string; count: number }[];
  countLabel: string;
}) {
  return (
    <div className="rounded-xl border border-fpl-border bg-fpl-card overflow-hidden">
      <h3 className="text-base font-semibold text-white px-4 py-3 border-b border-fpl-border bg-fpl-card/80">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-400 text-sm border-b border-fpl-border">
              <th className="px-4 py-2.5 font-medium">Player</th>
              <th className="px-4 py-2.5 font-medium text-right">{countLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-slate-500 text-center text-sm">
                  No data for this gameweek yet
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-fpl-border/60 last:border-0">
                  <td className="px-4 py-2.5 text-white">{row.name}</td>
                  <td className="px-4 py-2.5 text-slate-300 text-right tabular-nums">
                    {row.count.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SortKey = 'points' | 'price' | 'selected' | 'form' | 'rank';

function SortableTh({
  label,
  sortKey,
  currentSortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentSortKey === sortKey;
  return (
    <th
      role="button"
      tabIndex={0}
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSort(sortKey)}
      className="px-4 py-2.5 font-medium text-right cursor-pointer select-none hover:text-white transition-colors"
    >
      <span className="text-slate-400 hover:text-white">
        {label}
        {isActive && (
          <span className="ml-1 text-white" aria-hidden>
            {sortDir === 'desc' ? '↓' : '↑'}
          </span>
        )}
      </span>
    </th>
  );
}

function PlayerStatsTable({
  elements,
  teams,
  positionFilter,
  teamFilter,
  onPositionChange,
  onTeamChange,
}: {
  elements: FplElement[];
  teams: FplTeam[];
  positionFilter: string;
  teamFilter: string;
  onPositionChange: (v: string) => void;
  onTeamChange: (v: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    return elements.filter((e) => {
      if (positionFilter && String(e.element_type) !== positionFilter) return false;
      if (teamFilter && String(e.team) !== teamFilter) return false;
      return true;
    });
  }, [elements, positionFilter, teamFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'desc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let aVal: number;
      let bVal: number;
      switch (sortKey) {
        case 'points':
          aVal = a.total_points ?? 0;
          bVal = b.total_points ?? 0;
          return (bVal - aVal) * dir;
        case 'price':
          aVal = a.now_cost ?? 0;
          bVal = b.now_cost ?? 0;
          return (bVal - aVal) * dir;
        case 'selected': {
          aVal = parseFloat(a.selected_by_percent ?? '0') || 0;
          bVal = parseFloat(b.selected_by_percent ?? '0') || 0;
          return (bVal - aVal) * dir;
        }
        case 'form': {
          aVal = parseFloat(a.form ?? '0') || 0;
          bVal = parseFloat(b.form ?? '0') || 0;
          return (bVal - aVal) * dir;
        }
        case 'rank': {
          aVal = a.selected_rank ?? 999999;
          bVal = b.selected_rank ?? 999999;
          return (aVal - bVal) * dir;
        }
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const price = (cost: number | undefined) =>
    cost != null ? (cost / 10).toFixed(1) : '—';
  const pct = (s: string | undefined) => (s != null && s !== '' ? `${s}%` : '—');
  const rank = (r: number | undefined) => (r != null ? r.toLocaleString() : '—');

  return (
    <div className="rounded-xl border border-fpl-border bg-fpl-card overflow-hidden min-w-0 w-full">
      <h3 className="text-base font-semibold text-white px-4 py-3 border-b border-fpl-border bg-fpl-card/80">
        Player Stats
      </h3>
      <div className="px-4 py-3 flex flex-wrap gap-3 border-b border-fpl-border/60">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Position
          <select
            value={positionFilter}
            onChange={(e) => onPositionChange(e.target.value)}
            className="select-arrow-white bg-fpl-bg border border-fpl-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-fpl-border"
          >
            <option value="">All</option>
            {[1, 2, 3, 4].map((id) => (
              <option key={id} value={String(id)}>
                {POS_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Team
          <select
            value={teamFilter}
            onChange={(e) => onTeamChange(e.target.value)}
            className="select-arrow-white bg-fpl-bg border border-fpl-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-fpl-border min-w-[140px]"
          >
            <option value="">All</option>
            {teams.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="px-4 py-1 text-slate-500 text-sm border-b border-fpl-border/60">
        All {sorted.length} players — scroll to see more
      </p>

      {/* Mobile: card list (no horizontal scroll, native feel) */}
      <div
        className="md:hidden w-full min-w-0 overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: `min(${ROWS_IN_FIRST_VIEW * 36}px, 75vh)` }}
      >
        {sorted.length === 0 ? (
          <div className="px-4 py-8 text-slate-500 text-center text-sm">
            No players match the filters
          </div>
        ) : (
          <ul className="divide-y divide-fpl-border/60">
            {sorted.map((e) => {
              const teamName = teams.find((t) => t.id === e.team)?.name;
              const displayName = teamName ? `${e.web_name} (${teamName})` : e.web_name;
              return (
                <li
                  key={e.id}
                  className="px-4 py-3 bg-fpl-card/50 first:border-t-0"
                >
                  <p className="text-white font-medium text-sm truncate pr-2" title={displayName}>
                    {displayName}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-slate-400 text-xs">
                    <span>Points</span>
                    <span className="text-slate-300 text-right tabular-nums">
                      {e.total_points != null ? e.total_points.toLocaleString() : '—'}
                    </span>
                    <span>Price</span>
                    <span className="text-slate-300 text-right tabular-nums">{price(e.now_cost)}</span>
                    <span>Sel %</span>
                    <span className="text-slate-300 text-right tabular-nums">{pct(e.selected_by_percent)}</span>
                    <span>Form</span>
                    <span className="text-slate-300 text-right tabular-nums">{e.form ?? '—'}</span>
                    <span>Rank</span>
                    <span className="text-slate-300 text-right tabular-nums">{rank(e.selected_rank)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Desktop: table in contained scroll */}
      <div
        className="hidden md:block player-stats-scroll w-full min-w-0"
        style={{ maxHeight: `min(${ROWS_IN_FIRST_VIEW * 36}px, 75vh)` }}
      >
        <table className="w-full text-left min-w-[600px]">
          <thead className="sticky top-0 bg-fpl-card z-10 shadow-sm">
            <tr className="text-slate-400 text-sm border-b border-fpl-border">
              <th className="sticky left-0 z-20 bg-fpl-card px-3 sm:px-4 py-2.5 font-medium whitespace-nowrap shadow-[4px_0_8px_-2px_rgba(0,0,0,0.25)]">
                Player
              </th>
              <SortableTh
                label="Points"
                sortKey="points"
                currentSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Price"
                sortKey="price"
                currentSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Sel %"
                sortKey="selected"
                currentSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Form"
                sortKey="form"
                currentSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Rank"
                sortKey="rank"
                currentSortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 sm:px-4 py-6 text-slate-500 text-center text-sm">
                  No players match the filters
                </td>
              </tr>
            ) : (
              sorted.map((e) => {
                const teamName = teams.find((t) => t.id === e.team)?.name;
                const displayName = teamName ? `${e.web_name} (${teamName})` : e.web_name;
                return (
                  <tr
                    key={e.id}
                    className="group border-b border-fpl-border/60 last:border-0 hover:bg-fpl-card/80"
                  >
                    <td className="sticky left-0 z-[1] bg-fpl-card group-hover:bg-fpl-card/80 px-3 sm:px-4 py-2.5 text-white text-sm sm:text-base min-w-[120px] max-w-[180px] truncate shadow-[4px_0_8px_-2px_rgba(0,0,0,0.25)]" title={displayName}>
                      {displayName}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-slate-300 text-right tabular-nums whitespace-nowrap">
                      {e.total_points != null ? e.total_points.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-slate-300 text-right tabular-nums whitespace-nowrap">
                      {price(e.now_cost)}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-slate-300 text-right tabular-nums whitespace-nowrap">
                      {pct(e.selected_by_percent)}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-slate-300 text-right tabular-nums whitespace-nowrap">
                      {e.form ?? '—'}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-slate-300 text-right tabular-nums whitespace-nowrap">
                      {rank(e.selected_rank)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PlayerStatsPage() {
  const { data: bootstrap, isLoading: bootstrapLoading } = useBootstrapStatic();
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');

  const { topIn, topOut } = useMemo(() => {
    const elements: FplElement[] = bootstrap?.elements ?? [];
    const teams = new Map((bootstrap?.teams ?? []).map((t) => [t.id, t.name]));

    const withIn = elements
      .map((e) => ({
        element: e,
        count: e.transfers_in_event ?? 0,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N);
    const withOut = elements
      .map((e) => ({
        element: e,
        count: e.transfers_out_event ?? 0,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N);

    const name = (e: FplElement) => {
      const teamName = teams.get(e.team);
      return teamName ? `${e.web_name} (${teamName})` : e.web_name;
    };

    return {
      topIn: withIn.map((x) => ({ name: name(x.element), count: x.count })),
      topOut: withOut.map((x) => ({ name: name(x.element), count: x.count })),
    };
  }, [bootstrap]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Transfers (current gameweek)</h2>
        <p className="text-slate-400 text-sm mb-4">
            Data refreshes every 24 hours.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TransfersTable
            title="Top Transferred In"
            rows={topIn}
            countLabel="Transferred in"
          />
          <TransfersTable
            title="Top Transferred Out"
            rows={topOut}
            countLabel="Transferred out"
          />
        </div>
      </section>

      <section className="mt-8 min-w-0 overflow-hidden">
        <PlayerStatsTable
          elements={bootstrap?.elements ?? []}
          teams={bootstrap?.teams ?? []}
          positionFilter={positionFilter}
          teamFilter={teamFilter}
          onPositionChange={setPositionFilter}
          onTeamChange={setTeamFilter}
        />
      </section>

      <section className="mt-8 h-[50vh] min-h-[280px] max-h-[520px] flex flex-col">
        <h2 className="text-lg font-semibold text-white mb-3">Players News</h2>
        <PlayersNews bootstrap={bootstrap ?? undefined} isLoading={bootstrapLoading} />
      </section>

      <div className="mt-8 rounded-xl border border-fpl-border bg-fpl-card p-12 text-center">
        <p className="text-slate-400 text-lg">We are still working on it</p>
      </div>
    </main>
  );
}
