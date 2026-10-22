import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshIcon } from './icons';
import type { TeamPointsSummary } from '../types/fpl';
import type { FplEvent } from '../types/fpl';

const CHIP_LABELS: Record<string, string> = {
  bboost: 'BB',
  '3xc': 'TC',
  freehit: 'FH',
  wildcard: 'WC',
};

/** Team IDs that show the blue "SH Host" badge. */
const SH_HOST_TEAM_IDS = new Set([883503, 2983091, 3476111, 6633067, 12269690]);

function formatChip(chip: string | null | undefined): string {
  if (!chip) return '—';
  return CHIP_LABELS[chip.toLowerCase()] ?? chip;
}

interface TeamSummaryProps {
  teamName: string;
  managerName: string;
  teamId: number;
  gameweek: number;
  events: FplEvent[];
  onGameweekChange: (gw: number) => void;
  summary: TeamPointsSummary | null;
  /** Season total (sum of all GW points); shown as "GW Net Total". */
  gwNetTotal?: number | null;
  /** Transfer hit cost for selected GW (e.g. 4, 8). Displayed as negative. */
  transfersCost?: number | null;
  /** Team value for selected GW (raw from API, e.g. 1005 = 100.5). */
  teamValue?: number | null;
  isLoading?: boolean;
  /** When true, show "SH League" badge beside team name (team is in league 699005). */
  showShLeagueBadge?: boolean;
}

export default function TeamSummary({
  teamName,
  managerName,
  teamId,
  gameweek,
  events,
  onGameweekChange,
  summary,
  gwNetTotal,
  transfersCost,
  teamValue,
  isLoading,
  showShLeagueBadge = false,
}: TeamSummaryProps) {
  const isShHost = SH_HOST_TEAM_IDS.has(teamId);
  /** Projected bonus counted in the GW total (players who score for the team, with captain multiplier). */
  const isBenchBoost = /bboost|bench/i.test(String(summary?.chip ?? ''));
  const projectedBonusPts = summary
    ? [...summary.effectivePitchPlayers, ...(isBenchBoost ? summary.effectiveBench : [])].reduce(
        (n, p) => n + (p.projected_bonus ?? 0) * (p.multiplier || 1),
        0
      )
    : 0;
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Re-fetch all FPL data (live points, picks, league tables); the server cache keeps this cheap. */
  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ['fpl'] });
    setTimeout(() => setIsRefreshing(false), 1000);
  };
  const initials = teamName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <section className="card p-3 sm:p-6">
      {/* Phones: name and GW picker share one row, stats in a single compact row. sm+ is unchanged. */}
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fpl-accent font-display text-lg font-bold text-fpl-purple">
            {initials || 'FH'}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base sm:text-2xl font-bold tracking-tight text-white truncate">{teamName}</h2>
              {showShLeagueBadge && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold bg-fpl-brand/15 text-fpl-brand ring-1 ring-inset ring-fpl-brand/40"
                  title="Member of SH League (699005)"
                >
                  SH League
                </span>
              )}
              {isShHost && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/40"
                  title="SH Host"
                >
                  SH Host
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs sm:text-sm sm:mt-0.5 truncate">
              {managerName} <span className="text-slate-600">·</span> <span className="tabular-nums">ID {teamId}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-ghost h-[30px] w-[30px] !p-0 sm:h-auto sm:w-auto sm:!px-3 sm:!py-2"
            title="Refresh data"
            aria-label={isRefreshing ? 'Refreshing data' : 'Refresh data'}
          >
            <RefreshIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <label htmlFor="gw-select" className="sr-only">
            Gameweek
          </label>
          <select
            id="gw-select"
            value={gameweek}
            onChange={(e) => onGameweekChange(Number(e.target.value))}
            className="select-arrow-white input !py-1.5 sm:!py-2 !text-xs sm:!text-sm !pl-2.5 sm:!pl-3 w-auto font-medium"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="mt-3 sm:mt-6 grid grid-cols-4 gap-1.5 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[58px] sm:h-[84px] rounded-lg sm:rounded-xl bg-fpl-raised animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && summary && (
        <div className="mt-3 sm:mt-6 grid grid-cols-4 gap-1.5 sm:gap-3">
          <div className="min-w-0 rounded-lg sm:rounded-xl px-1.5 py-2 sm:p-4 bg-gradient-to-br from-fpl-brand/20 to-fpl-brand/5 ring-1 ring-inset ring-fpl-brand/30">
            <p className="eyebrow !text-[9px] sm:!text-[11px] text-fpl-brand/90 truncate">
              <span className="sm:hidden">GW pts</span>
              <span className="hidden sm:inline">GW points</span>
            </p>
            <p className="font-display text-xl sm:text-4xl font-bold text-white mt-0.5 sm:mt-1 tabular-nums leading-tight">
              {gwNetTotal ?? summary.starting_points}
            </p>
            {projectedBonusPts > 0 && (
              <p
                className="mt-0.5 truncate text-[9px] font-semibold text-amber-300 sm:text-[11px]"
                title="Bonus projected from live BPS. It can still change until FPL confirms it after the match."
              >
                <span className="sm:hidden">+{projectedBonusPts} bonus</span>
                <span className="hidden sm:inline">incl. +{projectedBonusPts} projected bonus</span>
              </p>
            )}
          </div>
          <StatTile label="Transfer hits" shortLabel="Hits">
            <span className={transfersCost != null && transfersCost > 0 ? 'text-rose-400' : ''}>
              {transfersCost == null ? '—' : transfersCost > 0 ? `-${transfersCost}` : '0'}
            </span>
          </StatTile>
          <StatTile label="Chip">
            {summary.chip ? (
              <span className="inline-flex items-center rounded-md bg-fpl-brand/15 px-1.5 sm:px-2 py-0.5 text-sm sm:text-xl text-fpl-brand ring-1 ring-inset ring-fpl-brand/30">
                {formatChip(summary.chip)}
              </span>
            ) : (
              <span className="text-slate-500">None</span>
            )}
          </StatTile>
          <StatTile label="Team value" shortLabel="Value">
            {teamValue != null ? (
              <>
                <span className="text-slate-500 text-xs sm:text-lg sm:mr-0.5">£</span>
                {(teamValue / 10).toFixed(1)}
                <span className="hidden sm:inline text-slate-500 text-lg">m</span>
              </>
            ) : (
              '—'
            )}
          </StatTile>
        </div>
      )}
    </section>
  );
}

function StatTile({ label, shortLabel, children }: { label: string; shortLabel?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg sm:rounded-xl bg-fpl-raised/70 px-1.5 py-2 sm:p-4 ring-1 ring-inset ring-white/[0.03]">
      <p className="eyebrow !text-[9px] sm:!text-[11px] truncate">
        <span className="sm:hidden">{shortLabel ?? label}</span>
        <span className="hidden sm:inline">{label}</span>
      </p>
      <p className="font-display text-base sm:text-[28px] font-bold text-white mt-1 sm:mt-1.5 tabular-nums leading-tight truncate">{children}</p>
    </div>
  );
}
