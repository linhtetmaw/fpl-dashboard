import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFplNews } from '../api/fpl';
import { useBootstrapStatic } from '../hooks/useFplApi';
import { getPlayerImageUrl } from '../utils/playerPhoto';
import { playerCardProps, usePlayerCard } from './PlayerCardProvider';
import type { FplNewsPlayer } from '../types/fpl';

type StatusFilter = 'all' | 'i' | 's' | 'd' | 'u';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'i', label: 'Injured' },
  { id: 's', label: 'Suspended' },
  { id: 'd', label: 'Doubtful' },
  { id: 'u', label: 'Unavailable' },
];

const STATUS: Record<string, { label: string; badge: string }> = {
  i: { label: 'Injured', badge: 'bg-rose-500/15 text-rose-300 ring-rose-500/40' },
  s: { label: 'Suspended', badge: 'bg-red-500/15 text-red-300 ring-red-500/40' },
  d: { label: 'Doubtful', badge: 'bg-amber-400/15 text-amber-300 ring-amber-400/40' },
  u: { label: 'Unavailable', badge: 'bg-slate-500/20 text-slate-300 ring-slate-500/40' },
  n: { label: 'Not eligible', badge: 'bg-slate-500/20 text-slate-300 ring-slate-500/40' },
  a: { label: 'Available', badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40' },
};

const POSITIONS: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const PAGE_SIZE = 24;

/** "3 hours ago". */
function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function chanceTone(chance: number): string {
  if (chance === 0) return 'text-rose-300';
  if (chance <= 50) return 'text-amber-300';
  return 'text-yellow-200';
}

function PlayerPhoto({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-fpl-raised ring-1 ring-white/10">
      {url && !failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function NewsCard({ player, teamName, teamShort }: { player: FplNewsPlayer; teamName: string; teamShort: string }) {
  const status = STATUS[player.status] ?? STATUS.u;
  const chance = player.chance_of_playing_next_round;
  const openPlayer = usePlayerCard();
  return (
    <li
      {...playerCardProps(openPlayer, player.id, player.web_name)}
      className="card p-4 flex gap-3 cursor-pointer transition-colors hover:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-fpl-brand/60"
    >
      <PlayerPhoto url={getPlayerImageUrl(player, teamName)} name={player.web_name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-white">{player.web_name}</span>
          <span className="text-xs text-slate-500">
            {teamShort} · {POSITIONS[player.element_type] ?? ''}
          </span>
          <span
            className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${status.badge}`}
          >
            {status.label}
          </span>
        </div>
        {player.news_en && <p className="mt-1 text-sm leading-relaxed text-slate-200">{player.news_en}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {chance != null && chance < 100 && (
            <span className={`font-semibold tabular-nums ${chanceTone(chance)}`}>
              {chance}%<span className="font-normal text-slate-500"> chance</span>
            </span>
          )}
          {player.selected_by_percent != null && (
            <span className="tabular-nums">
              {player.selected_by_percent}% owned
            </span>
          )}
          {player.news_added && (
            <time
              dateTime={player.news_added}
              title={new Date(player.news_added).toLocaleString()}
            >
              {timeAgo(player.news_added)}
            </time>
          )}
        </div>
      </div>
    </li>
  );
}

export default function FplNews() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fpl-news'],
    queryFn: getFplNews,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 20 * 60 * 1000,
  });
  const { data: bootstrap } = useBootstrapStatic();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [shown, setShown] = useState(PAGE_SIZE);

  const teams = useMemo(() => new Map((bootstrap?.teams ?? []).map((t) => [t.id, t])), [bootstrap?.teams]);
  const teamShort = (id: number) => teams.get(id)?.short_name ?? '';

  const players = useMemo(
    () => (data?.players ?? []).filter((p) => filter === 'all' || p.status === filter || (filter === 'u' && p.status === 'n')),
    [data?.players, filter]
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.players.length ?? 0 };
    for (const p of data?.players ?? []) {
      const key = p.status === 'n' ? 'u' : p.status;
      c[key] = (c[key] ?? 0) + 1;
    }
    return c;
  }, [data?.players]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="section-title">Latest updates</h3>
        <div className="segmented" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              data-active={filter === f.id}
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setShown(PAGE_SIZE);
              }}
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-60">{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="card p-5 text-sm text-rose-300">Couldn't load FPL news. Please try again later.</p>}

      <div>
        {isLoading ? (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="card h-32 animate-pulse" />
            ))}
          </ul>
        ) : players.length === 0 ? (
          <p className="card p-6 text-sm text-slate-400">No player news right now.</p>
        ) : (
          <>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {players.slice(0, shown).map((p) => (
                <NewsCard key={p.id} player={p} teamName={teams.get(p.team)?.name ?? ''} teamShort={teamShort(p.team)} />
              ))}
            </ul>
            {players.length > shown && (
              <div className="mt-4 flex justify-center">
                <button type="button" className="btn-ghost" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                  Show more ({players.length - shown})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Player news comes from the official Fantasy Premier League game and updates every 20 minutes.
      </p>
    </section>
  );
}
