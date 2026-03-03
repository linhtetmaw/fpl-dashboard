import { useEffect } from 'react';
import type { FplElement, FplTeam } from '../types/fpl';
import { useElementSummary } from '../hooks/useFplApi';

interface PlayerDetailCardProps {
  element: FplElement;
  teamName: string;
  teams: FplTeam[];
  onClose: () => void;
}

function formatPrice(cost: number | undefined): string {
  if (cost == null) return '—';
  return (cost / 10).toFixed(1);
}

export default function PlayerDetailCard({ element, teamName, teams, onClose }: PlayerDetailCardProps) {
  const { data: summary, isLoading } = useElementSummary(element.id);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const teamById = new Map(teams.map((t) => [t.id, t.name]));
  const history = summary?.history ?? [];
  const fixtures = summary?.fixtures ?? [];
  const last3Gw = [...history].sort((a, b) => b.round - a.round).slice(0, 3);
  const next3Fixtures = fixtures.filter((f) => !f.finished).slice(0, 3);
  const getOpponentName = (f: { team_h: number; team_a: number; is_home: boolean }) => {
    const opponentId = f.is_home ? f.team_a : f.team_h;
    return teamById.get(opponentId) ?? `Team ${opponentId}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal
      aria-labelledby="player-detail-title"
    >
      <div
        className="rounded-xl border border-fpl-border bg-fpl-card shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-fpl-card border-b border-fpl-border px-4 py-3 flex items-center justify-between">
          <h2 id="player-detail-title" className="text-lg font-semibold text-white truncate pr-2">
            {element.web_name}
            {teamName ? ` (${teamName})` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg border border-fpl-border text-slate-400 hover:text-white hover:bg-fpl-dark transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Row 1: Price, Points, Form, Rank, Selected % */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            <div className="rounded-lg bg-fpl-dark/80 px-2 py-2">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Price</p>
              <p className="text-white font-semibold">{formatPrice(element.now_cost)}</p>
            </div>
            <div className="rounded-lg bg-fpl-dark/80 px-2 py-2">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Points</p>
              <p className="text-white font-semibold">{element.total_points ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-fpl-dark/80 px-2 py-2">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Form</p>
              <p className="text-white font-semibold">{element.form ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-fpl-dark/80 px-2 py-2">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Rank</p>
              <p className="text-white font-semibold">
                {element.selected_rank != null ? element.selected_rank.toLocaleString() : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-fpl-dark/80 px-2 py-2 col-span-2 sm:col-span-1">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Selected %</p>
              <p className="text-white font-semibold">{element.selected_by_percent ?? '—'}%</p>
            </div>
          </div>

          {/* Row 2: Last 3 GW points + Next 3 fixtures with FDR */}
          <div className="space-y-3">
            <h3 className="text-slate-400 text-sm font-medium">Last 3 gameweeks</h3>
            {isLoading ? (
              <p className="text-slate-500 text-sm">Loading…</p>
            ) : last3Gw.length === 0 ? (
              <p className="text-slate-500 text-sm">No history</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {last3Gw.map((h) => (
                  <span
                    key={h.round}
                    className="inline-flex items-center gap-1 rounded-lg bg-fpl-dark/80 px-3 py-1.5 text-sm"
                  >
                    <span className="text-slate-500">GW{h.round}</span>
                    <span className="text-white font-semibold">{h.total_points} pts</span>
                  </span>
                ))}
              </div>
            )}

            <h3 className="text-slate-400 text-sm font-medium mt-4">Next 3 matches (FDR)</h3>
            {isLoading ? (
              <p className="text-slate-500 text-sm">Loading…</p>
            ) : next3Fixtures.length === 0 ? (
              <p className="text-slate-500 text-sm">No upcoming fixtures</p>
            ) : (
              <ul className="space-y-2">
                {next3Fixtures.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-lg bg-fpl-dark/80 px-3 py-2 text-sm gap-2"
                  >
                    <span className="text-slate-300 truncate">
                      {f.event_name} ({f.is_home ? 'H' : 'A'}) vs {getOpponentName(f)}
                    </span>
                    <span
                      className="shrink-0 ml-2 w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
                      title="Fixture Difficulty Rating"
                      style={{
                        backgroundColor:
                          f.difficulty === 1
                            ? '#22c55e'
                            : f.difficulty === 2
                              ? '#84cc16'
                              : f.difficulty === 3
                                ? '#eab308'
                                : f.difficulty === 4
                                  ? '#f97316'
                                  : '#ef4444',
                      }}
                    >
                      {f.difficulty}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
