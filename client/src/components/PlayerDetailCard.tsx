import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ElementHistoryEntry, FplElement, FplTeam } from '../types/fpl';
import { useElementSummary } from '../hooks/useFplApi';
import { getPlayerTracker } from '../api/fpl';
import { timeAgo } from '../utils/timeAgo';

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

function signedPrice(tenths: number): string {
  return `${tenths > 0 ? '+' : tenths < 0 ? '−' : ''}£${(Math.abs(tenths) / 10).toFixed(1)}m`;
}

const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

const sum = (rows: ElementHistoryEntry[], pick: (h: ElementHistoryEntry) => number | string | undefined) =>
  rows.reduce((n, h) => n + (Number(pick(h)) || 0), 0);

/**
 * Price over the season: FPL's price at each gameweek (one point per round, the last match of a double gameweek),
 * drawn as steps, with rises in green and falls in red, plus today's price if it has moved since.
 */
function PriceHistory({ history, nowCost }: { history: ElementHistoryEntry[]; nowCost: number | undefined }) {
  const byRound = new Map<number, number>();
  for (const h of [...history].sort((a, b) => a.round - b.round)) if (h.value != null) byRound.set(h.round, h.value);
  const points = [...byRound].map(([gw, value]) => ({ label: `GW${gw}`, value }));
  if (nowCost != null && (points.length === 0 || points[points.length - 1].value !== nowCost)) {
    points.push({ label: 'Now', value: nowCost });
  }
  if (points.length < 2) return <p className="text-slate-500 text-sm">Not enough price history yet</p>;

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const W = 300;
  const H = 72;
  const pad = 8;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const y = (v: number) => (hi === lo ? H / 2 : pad + ((hi - v) * (H - 2 * pad)) / (hi - lo));
  // Steps: hold each price until the next gameweek, then move.
  let d = `M ${x(0)} ${y(values[0])}`;
  for (let i = 1; i < points.length; i++) d += ` H ${x(i)} V ${y(values[i])}`;
  const changes = points
    .map((p, i) => ({ i, delta: i > 0 ? p.value - points[i - 1].value : 0 }))
    .filter((c) => c.delta !== 0);
  // FPL prices move £0.1m at a time, so a +£0.2m week is two rises.
  const rises = changes.reduce((n, c) => n + Math.max(0, c.delta), 0);
  const falls = changes.reduce((n, c) => n + Math.max(0, -c.delta), 0);
  const total = values[values.length - 1] - values[0];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[72px]" role="img" aria-label={`Price from £${(values[0] / 10).toFixed(1)}m to £${(values[values.length - 1] / 10).toFixed(1)}m`}>
        <line x1={pad} x2={W - pad} y1={y(lo)} y2={y(lo)} stroke="currentColor" className="text-fpl-border" strokeDasharray="3 4" />
        <line x1={pad} x2={W - pad} y1={y(hi)} y2={y(hi)} stroke="currentColor" className="text-fpl-border" strokeDasharray="3 4" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2} className="text-fpl-brand" strokeLinejoin="round" />
        {changes.map((c) => (
          <circle key={c.i} cx={x(c.i)} cy={y(points[c.i].value)} r={3.5} className={c.delta > 0 ? 'fill-emerald-400' : 'fill-red-400'}>
            <title>{`${points[c.i].label}: ${signedPrice(c.delta)} → £${(points[c.i].value / 10).toFixed(1)}m`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500 tabular-nums">
        <span>
          {points[0].label} · £{(values[0] / 10).toFixed(1)}m
        </span>
        <span>
          {points[points.length - 1].label} · £{(values[values.length - 1] / 10).toFixed(1)}m
        </span>
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        <span className={total > 0 ? 'text-emerald-400' : total < 0 ? 'text-red-400' : 'text-slate-300'}>
          {total === 0 ? 'No change' : signedPrice(total)}
        </span>{' '}
        this season · {rises} rise{rises === 1 ? '' : 's'}, {falls} fall{falls === 1 ? '' : 's'}
      </p>
    </div>
  );
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

  // When this gameweek's price change happened (the server's tracker; shared with the Player Stats page).
  const { data: tracker } = useQuery({
    queryKey: ['player-tracker'],
    queryFn: getPlayerTracker,
    staleTime: 5 * 60 * 1000,
  });
  const gwChange = element.cost_change_event ?? 0;
  const gwChangedAt = gwChange !== 0 ? tracker?.price_changed_at?.[element.id] : undefined;

  // Season totals from the gameweek history.
  const isGk = element.element_type === 1;
  const played = history.filter((h) => (h.minutes ?? 0) > 0).length;
  const xg = sum(history, (h) => h.expected_goals);
  const xa = sum(history, (h) => h.expected_assists);
  const season: { label: string; value: string; sub?: string }[] = isGk
    ? [
        { label: 'Clean sheets', value: String(sum(history, (h) => h.clean_sheets)) },
        { label: 'Saves', value: String(sum(history, (h) => h.saves)) },
        {
          label: 'Conceded',
          value: String(sum(history, (h) => h.goals_conceded)),
          sub: `xGC ${sum(history, (h) => h.expected_goals_conceded).toFixed(1)}`,
        },
        { label: 'Bonus', value: String(sum(history, (h) => h.bonus)) },
      ]
    : [
        { label: 'Goals', value: String(sum(history, (h) => h.goals_scored)), sub: `xG ${xg.toFixed(1)}` },
        { label: 'Assists', value: String(sum(history, (h) => h.assists)), sub: `xA ${xa.toFixed(1)}` },
        element.element_type === 4
          ? { label: 'DefCon', value: String(sum(history, (h) => h.defensive_contribution)) }
          : { label: 'Clean sheets', value: String(sum(history, (h) => h.clean_sheets)) },
        { label: 'Bonus', value: String(sum(history, (h) => h.bonus)) },
      ];
  season.push(
    { label: 'Minutes', value: sum(history, (h) => h.minutes).toLocaleString() },
    { label: 'Starts', value: String(sum(history, (h) => h.starts)), sub: `of ${history.length}` },
    {
      label: 'Pts / match',
      value: played ? (sum(history, (h) => h.total_points) / played).toFixed(1) : '—',
    },
    isGk || element.element_type === 4
      ? { label: 'Yellow cards', value: String(sum(history, (h) => h.yellow_cards)) }
      : { label: 'DefCon', value: String(sum(history, (h) => h.defensive_contribution)) }
  );

  // Set-piece duties (first to third choice) and FPL's expected points for the next gameweek.
  const duties = [
    { label: 'Penalties', order: element.penalties_order },
    { label: 'Corners', order: element.corners_and_indirect_freekicks_order },
    { label: 'Free kicks', order: element.direct_freekicks_order },
  ].filter((d): d is { label: string; order: number } => d.order != null && d.order >= 1 && d.order <= 3);
  const expectedNext = element.ep_next != null && element.ep_next !== '' ? Number(element.ep_next) : null;

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
              {chance != null && chance < 100 && !element.news?.includes(`${chance}%`) && (
                <span className="opacity-75"> · {chance}% chance of playing</span>
              )}
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

          {(expectedNext != null || duties.length > 0) && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {expectedNext != null && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-fpl-brand/15 px-2.5 py-1 text-[11px] font-semibold text-fpl-brand ring-1 ring-inset ring-fpl-brand/30"
                  title="FPL's own expected points for the next gameweek"
                >
                  Expected next GW <span className="tabular-nums">{expectedNext.toFixed(1)}</span>
                </span>
              )}
              {duties.map((d) => (
                <span
                  key={d.label}
                  className="inline-flex items-center rounded-full bg-fpl-raised px-2.5 py-1 text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-fpl-border"
                  title={`${ordinal(d.order)} choice for ${d.label.toLowerCase()} at the club (FPL)`}
                >
                  {d.label} · {d.order === 1 ? 'on duty' : `${ordinal(d.order)} choice`}
                </span>
              ))}
            </div>
          )}

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
            <h3 className="eyebrow mb-2">This season</h3>
            {isLoading ? (
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-[52px] rounded-lg bg-fpl-raised animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {season.map((s) => (
                  <div key={s.label} className="rounded-lg bg-fpl-raised px-1 py-2 text-center">
                    <p className="text-[10px] text-slate-500 truncate">{s.label}</p>
                    <p className="font-display text-sm font-bold text-white tabular-nums leading-tight">{s.value}</p>
                    <p className="h-3.5 text-[10px] text-slate-500 tabular-nums">{s.sub ?? ''}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="eyebrow">Price history</h3>
              {gwChange !== 0 && (
                <span className={`text-[11px] font-semibold tabular-nums ${gwChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  This GW {signedPrice(gwChange)}
                  {gwChangedAt && (
                    <span className="font-normal text-slate-500" title={new Date(gwChangedAt).toLocaleString()}>
                      {' '}
                      · {timeAgo(gwChangedAt)}
                    </span>
                  )}
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="h-[100px] rounded-lg bg-fpl-raised animate-pulse" />
            ) : (
              <PriceHistory history={history} nowCost={element.now_cost} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
