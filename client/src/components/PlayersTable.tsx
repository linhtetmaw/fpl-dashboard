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

function posLabel(elementType: number): string {
  return POS_LABELS[elementType] ?? '—';
}

export default function PlayersTable({ players }: PlayersTableProps) {
  const sorted = [...players].sort((a, b) => a.position - b.position);

  return (
    <div className="rounded-xl border border-fpl-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-fpl-card border-b border-fpl-border text-slate-400 text-left">
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Pos</th>
              <th className="px-4 py-3 font-medium w-12">C</th>
              <th className="px-4 py-3 font-medium">Bench</th>
              <th className="px-4 py-3 font-medium text-right">Min</th>
              <th className="px-4 py-3 font-medium text-right">G</th>
              <th className="px-4 py-3 font-medium text-right">A</th>
              <th className="px-4 py-3 font-medium text-right">CS</th>
              <th className="px-4 py-3 font-medium text-right">B</th>
              <th className="px-4 py-3 font-medium text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr
                key={`${p.element_id}-${p.position}`}
                className={`border-b border-fpl-border/70 ${
                  p.is_captain ? 'bg-fpl-accent/10' : p.is_on_bench ? 'bg-slate-800/30' : 'bg-fpl-dark/30'
                } ${i % 2 === 1 ? 'bg-fpl-dark/20' : ''}`}
              >
                <td className="px-4 py-2.5 text-slate-200 font-medium">
                  {p.web_name}
                  {p.is_vice_captain && <span className="text-slate-500 ml-1">(VC)</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-400">{p.team_name}</td>
                <td className="px-4 py-2.5 text-slate-400">{posLabel(p.element_type)}</td>
                <td className="px-4 py-2.5">{p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : '—'}</td>
                <td className="px-4 py-2.5 text-slate-400">{p.is_on_bench ? 'Yes' : '—'}</td>
                <td className="px-4 py-2.5 text-right text-slate-300">{p.minutes}</td>
                <td className="px-4 py-2.5 text-right text-slate-300">{p.goals_scored}</td>
                <td className="px-4 py-2.5 text-right text-slate-300">{p.assists}</td>
                <td className="px-4 py-2.5 text-right text-slate-300">{p.clean_sheets}</td>
                <td className="px-4 py-2.5 text-right text-slate-300">{p.bonus}</td>
                <td className="px-4 py-2.5 text-right font-medium text-white">{p.total_points_effective}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
