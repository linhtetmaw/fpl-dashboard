import type { PlayerPoints } from '../types/fpl';

interface PlayersTableProps {
  players: PlayerPoints[];
}

const POS_LABELS: Record<number, string> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

const POS_STYLES: Record<number, string> = {
  1: 'bg-amber-400/10 text-amber-300 ring-amber-400/25',
  2: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
  3: 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
  4: 'bg-rose-400/10 text-rose-300 ring-rose-400/25',
};

function PosBadge({ elementType }: { elementType: number }) {
  return (
    <span
      className={`inline-flex w-10 justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
        POS_STYLES[elementType] ?? 'bg-slate-500/10 text-slate-300 ring-slate-500/25'
      }`}
    >
      {POS_LABELS[elementType] ?? '—'}
    </span>
  );
}

/** Stat cell: zeros are muted so the numbers that matter stand out. */
function Stat({ value }: { value: number }) {
  return <td className={`px-3 py-2.5 text-right tabular-nums ${value ? 'text-slate-200' : 'text-slate-600'}`}>{value}</td>;
}

export default function PlayersTable({ players }: PlayersTableProps) {
  const sorted = [...players].sort((a, b) => a.position - b.position);
  const starters = sorted.filter((p) => !p.is_on_bench);
  const bench = sorted.filter((p) => p.is_on_bench);

  const renderRow = (p: PlayerPoints) => (
    <tr key={`${p.element_id}-${p.position}`} className="border-b border-fpl-border/60 last:border-b-0 hover:bg-white/[0.02]">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-100">{p.web_name}</span>
          {p.is_captain && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-fpl-dark text-[9px] font-extrabold" title="Captain">
              C
            </span>
          )}
          {p.is_vice_captain && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-white text-[8px] font-bold" title="Vice-captain">
              V
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{p.team_name}</td>
      <td className="px-3 py-2.5">
        <PosBadge elementType={p.element_type} />
      </td>
      <Stat value={p.minutes} />
      <Stat value={p.goals_scored} />
      <Stat value={p.assists} />
      <Stat value={p.clean_sheets} />
      <Stat value={p.bonus} />
      <td className="px-4 py-2.5 text-right">
        <span className="font-display font-bold tabular-nums text-white">{p.total_points_effective}</span>
      </td>
    </tr>
  );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-fpl-raised/60 border-b border-fpl-border text-left">
              <th className="eyebrow px-4 py-3">Player</th>
              <th className="eyebrow px-3 py-3">Club</th>
              <th className="eyebrow px-3 py-3">Pos</th>
              <th className="eyebrow px-3 py-3 text-right" title="Minutes">Min</th>
              <th className="eyebrow px-3 py-3 text-right" title="Goals">G</th>
              <th className="eyebrow px-3 py-3 text-right" title="Assists">A</th>
              <th className="eyebrow px-3 py-3 text-right" title="Clean sheets">CS</th>
              <th className="eyebrow px-3 py-3 text-right" title="Bonus">B</th>
              <th className="eyebrow px-4 py-3 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>{starters.map(renderRow)}</tbody>
          {bench.length > 0 && (
            <tbody className="bg-fpl-raised/30">
              <tr className="border-y border-fpl-border">
                <td colSpan={9} className="eyebrow px-4 py-2">
                  Bench
                </td>
              </tr>
              {bench.map(renderRow)}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
