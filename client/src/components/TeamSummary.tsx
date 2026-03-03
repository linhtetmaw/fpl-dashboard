import type { TeamPointsSummary } from '../types/fpl';
import type { FplEvent } from '../types/fpl';

const CHIP_LABELS: Record<string, string> = {
  bboost: 'BB',
  '3xc': 'TC',
  freehit: 'FH',
  wildcard: 'WC',
};

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
  /** Team value for selected GW (raw from API, e.g. 1005 = 100.5). */
  teamValue?: number | null;
  isLoading?: boolean;
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
  teamValue,
  isLoading,
}: TeamSummaryProps) {
  return (
    <section className="rounded-xl bg-fpl-card border border-fpl-border p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{teamName}</h2>
          <p className="text-slate-400 text-sm">{managerName} · ID {teamId}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            id="gw-select"
            value={gameweek}
            onChange={(e) => onGameweekChange(Number(e.target.value))}
            className="select-arrow-white px-3 py-2 rounded-lg bg-fpl-dark border border-fpl-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-fpl-accent"
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
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-fpl-dark/60 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && summary && (
        <>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg bg-fpl-dark/60 p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wide">GW Net Total</p>
              <p className="text-2xl font-bold text-white mt-1">{gwNetTotal ?? summary.starting_points}</p>
            </div>
            <div className="rounded-lg bg-fpl-dark/60 p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wide">Bench</p>
              <p className="text-2xl font-bold text-white mt-1">{summary.bench_points}</p>
            </div>
            <div className="rounded-lg bg-fpl-dark/60 p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wide">Chip</p>
              <p className="text-lg font-medium text-slate-200 mt-1">{formatChip(summary.chip)}</p>
            </div>
            <div className="rounded-lg bg-fpl-dark/60 p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wide">Team Value</p>
              <p className="text-2xl font-bold text-white mt-1">
                {teamValue != null ? (teamValue / 10).toFixed(1) : '—'}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
