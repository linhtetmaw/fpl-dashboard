import { useEffect, useState } from 'react';
import type { FplElement, FplTeam } from '../types/fpl';
import { useElementSummary } from '../hooks/useFplApi';

interface PlayerDetailCardProps {
  element: FplElement;
  teamName: string;
  teams: FplTeam[];
  /** Player photo (same source as the pitch card); falls back to initials when missing or broken. */
  imageUrl?: string | null;
  onClose: () => void;
}

const POSITION_LABELS: Record<number, string> = { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Forward' };

/** Official FPL fixture difficulty colours. */
const FDR_STYLES: Record<number, { bg: string; text: string }> = {
  1: { bg: '#375523', text: '#ffffff' },
  2: { bg: '#01fc7a', text: '#0a0d13' },
  3: { bg: '#e7e7e7', text: '#0a0d13' },
  4: { bg: '#ff1751', text: '#ffffff' },
  5: { bg: '#80072d', text: '#ffffff' },
};

const NEXT_FIXTURES = 5;
const RECENT_GWS = 5;

function formatPrice(cost: number | undefined): string {
  if (cost == null) return '—';
  return `£${(cost / 10).toFixed(1)}m`;
}

/** Tint a recent-GW points tile: blanks muted, big hauls highlighted. */
function pointsTone(points: number): string {
  if (points >= 10) return 'bg-fpl-accent text-fpl-ink';
  if (points >= 6) return 'bg-fpl-brand/25 text-fpl-brand';
  if (points <= 2) return 'bg-fpl-dark/80 text-slate-500';
  return 'bg-fpl-dark/80 text-white';
}

export default function PlayerDetailCard({ element, teamName, teams, imageUrl, onClose }: PlayerDetailCardProps) {
  const { data: summary, isLoading } = useElementSummary(element.id);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const shortNameById = new Map(teams.map((t) => [t.id, t.short_name ?? t.name.slice(0, 3).toUpperCase()]));
  const history = summary?.history ?? [];
  const fixtures = summary?.fixtures ?? [];
  const recentGws = [...history].sort((a, b) => b.round - a.round).slice(0, RECENT_GWS).reverse();
  const nextFixtures = fixtures.filter((f) => !f.finished).slice(0, NEXT_FIXTURES);

  const priceChange = element.cost_change_start ?? 0;
  const hasNews = !!element.news?.trim();
  const chance = element.chance_of_playing_next_round;
  const newsTone =
    chance === 0 || element.status === 'i' || element.status === 's'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-200';

  const stats: { label: string; value: string; sub?: string; subTone?: string }[] = [
    {
      label: 'Price',
      value: formatPrice(element.now_cost),
      sub: priceChange !== 0 ? `${priceChange > 0 ? '+' : '−'}£${(Math.abs(priceChange) / 10).toFixed(1)}m` : undefined,
      subTone: priceChange > 0 ? 'text-emerald-400' : 'text-red-400',
    },
    { label: 'Points', value: element.total_points != null ? String(element.total_points) : '—' },
    { label: 'Form', value: element.form ?? '—' },
    {
      label: 'Owned',
      value: element.selected_by_percent != null ? `${element.selected_by_percent}%` : '—',
      sub: element.selected_rank != null ? `#${element.selected_rank.toLocaleString()}` : undefined,
      subTone: 'text-slate-500',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal
      aria-labelledby="player-detail-title"
    >
      <div
        className="card w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: photo, name, club and position */}
        <div className="relative flex items-end gap-4 px-5 pt-5 pb-4 border-b border-fpl-border bg-gradient-to-b from-fpl-brand/15 to-transparent">
          <div className="relative h-20 w-[68px] shrink-0 overflow-hidden rounded-xl bg-fpl-raised ring-1 ring-white/10">
            {imageUrl && !photoFailed ? (
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover object-top"
                referrerPolicy="no-referrer"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-slate-400">
                {element.web_name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="eyebrow !text-fpl-brand">{POSITION_LABELS[element.element_type] ?? 'Player'}</p>
            <h2 id="player-detail-title" className="font-display text-xl font-bold text-white truncate">
              {element.web_name}
            </h2>
            {teamName && <p className="text-slate-400 text-sm truncate">{teamName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {hasNews && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${newsTone}`}>
              {element.news}
              {chance != null && chance < 100 && <span className="opacity-75"> · {chance}% chance of playing</span>}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-fpl-raised px-2 py-2.5 text-center">
                <p className="eyebrow !text-[10px]">{s.label}</p>
                <p className="mt-0.5 font-display text-base font-bold text-white tabular-nums">{s.value}</p>
                <p className={`text-[10px] tabular-nums h-3.5 ${s.subTone ?? ''}`}>{s.sub ?? ''}</p>
              </div>
            ))}
          </div>

          <section>
            <h3 className="eyebrow mb-2">Next {NEXT_FIXTURES} matches</h3>
            {isLoading ? (
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: NEXT_FIXTURES }, (_, i) => (
                  <div key={i} className="h-[58px] rounded-lg bg-fpl-raised animate-pulse" />
                ))}
              </div>
            ) : nextFixtures.length === 0 ? (
              <p className="text-slate-500 text-sm">No upcoming fixtures</p>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {nextFixtures.map((f) => {
                  const opponentId = f.is_home ? f.team_a : f.team_h;
                  const style = FDR_STYLES[f.difficulty] ?? FDR_STYLES[3];
                  return (
                    <div
                      key={f.id}
                      className="rounded-lg px-1 py-2 text-center"
                      style={{ backgroundColor: style.bg, color: style.text }}
                      title={`${f.event_name}: ${f.is_home ? 'home' : 'away'} vs ${shortNameById.get(opponentId) ?? ''} · difficulty ${f.difficulty}`}
                    >
                      <p className="text-[10px] font-medium opacity-75">GW{f.event}</p>
                      <p className="font-display text-sm font-bold leading-tight">{shortNameById.get(opponentId) ?? '—'}</p>
                      <p className="text-[10px] font-semibold opacity-80">{f.is_home ? 'Home' : 'Away'}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="eyebrow mb-2">Recent points</h3>
            {isLoading ? (
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: RECENT_GWS }, (_, i) => (
                  <div key={i} className="h-[58px] rounded-lg bg-fpl-raised animate-pulse" />
                ))}
              </div>
            ) : recentGws.length === 0 ? (
              <p className="text-slate-500 text-sm">No history yet</p>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {recentGws.map((h, i) => (
                  <div key={`${h.round}-${i}`} className={`rounded-lg px-1 py-2 text-center ${pointsTone(h.total_points)}`}>
                    <p className="text-[10px] font-medium opacity-75">GW{h.round}</p>
                    <p className="font-display text-base font-bold leading-tight tabular-nums">{h.total_points}</p>
                    <p className="text-[10px] opacity-75 truncate">
                      {h.opponent_team != null
                        ? `${shortNameById.get(h.opponent_team) ?? ''} (${h.was_home ? 'H' : 'A'})`
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
