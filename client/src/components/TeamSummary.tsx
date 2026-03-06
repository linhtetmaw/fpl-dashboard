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
  return (
    <section className="rounded-xl bg-fpl-card border border-fpl-border p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h2 className="text-lg sm:text-xl font-semibold text-white">{teamName}</h2>
            {showShLeagueBadge && (
              <span
                className="inline-flex items-center rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold bg-[#f37025]/20 text-[#f37025] border border-[#f37025]/50"
                title="Member of SH League (699005)"
              >
                SH League
              </span>
            )}
            {isShHost && (
              <span
                className="inline-flex items-center rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/50"
                title="SH Host"
              >
                SH Host
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">{managerName} · ID {teamId}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            id="gw-select"
            value={gameweek}
            onChange={(e) => onGameweekChange(Number(e.target.value))}
            className="select-arrow-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm rounded-lg bg-fpl-dark border border-fpl-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-fpl-accent"
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
        <div className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 sm:h-16 rounded-lg bg-fpl-dark/60 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && summary && (
        <>
          <div className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-lg bg-fpl-dark/60 p-3 sm:p-4">
              <p className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">GW Net Total</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-0.5 sm:mt-1">{gwNetTotal ?? summary.starting_points}</p>
            </div>
            <div className="rounded-lg bg-fpl-dark/60 p-3 sm:p-4">
              <p className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">Transfers</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-0.5 sm:mt-1 tabular-nums">
                {transfersCost == null ? '—' : transfersCost > 0 ? `-${transfersCost}` : '0'}
              </p>
            </div>
            <div className="rounded-lg bg-fpl-dark/60 p-3 sm:p-4">
              <p className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">Chip</p>
              <p className="text-base sm:text-lg font-medium text-slate-200 mt-0.5 sm:mt-1">{formatChip(summary.chip)}</p>
            </div>
            <div className="rounded-lg bg-fpl-dark/60 p-3 sm:p-4">
              <p className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">Team Value</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-0.5 sm:mt-1">
                {teamValue != null ? (teamValue / 10).toFixed(1) : '—'}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
