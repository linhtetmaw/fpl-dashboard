import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBootstrapStatic, getCurrentEvent } from '../hooks/useFplApi';
import type { FplElement, FplEvent, FplTeam } from '../types/fpl';

const TOP_N = 10;
/** Number of transfer leaders shown as photo cards; the rest go in the ranked list. */
const PODIUM_N = 3;
/** Approx rows visible in first view before scrolling (row height ~44px). */
const ROWS_IN_FIRST_VIEW = 16;

const POS_LABELS: Record<number, string> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

const POS_PILL: Record<number, string> = {
  1: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
  2: 'bg-sky-400/10 text-sky-300 ring-sky-400/20',
  3: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
  4: 'bg-rose-400/10 text-rose-300 ring-rose-400/20',
};

type Direction = 'in' | 'out';

const DIRECTION_STYLES: Record<
  Direction,
  { text: string; chip: string; bar: string; glow: string; sign: string }
> = {
  in: {
    text: 'text-emerald-400',
    chip: 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/25',
    bar: 'bg-emerald-400/70',
    glow: 'from-emerald-500/15',
    sign: '+',
  },
  out: {
    text: 'text-rose-400',
    chip: 'bg-rose-400/10 text-rose-400 ring-rose-400/25',
    bar: 'bg-rose-400/70',
    glow: 'from-rose-500/15',
    sign: '−',
  },
};

interface PlayerSummary {
  id: number;
  name: string;
  teamName: string;
  teamShort: string;
  position: string;
  photoUrl: string | null;
  price: number | null;
  totalPoints: number | null;
}

interface TransferRow extends PlayerSummary {
  count: number;
}

/** Build player photo URL for api/player-photo (same params as PitchView). */
function getPlayerPhotoUrl(element: FplElement | null, teamName: string | undefined): string | null {
  if (!element) return null;
  const first = element.first_name?.trim() ?? '';
  const second = element.second_name?.trim() ?? '';
  const name = first && second ? `${first}_${second}`.replace(/\s+/g, '_') : element.web_name?.replace(/\s+/g, '_') ?? '';
  const rawCode = element.code ?? element.photo;
  const code =
    typeof rawCode === 'number'
      ? String(rawCode)
      : typeof rawCode === 'string'
        ? rawCode.replace(/\D/g, '')
        : '';
  if (!name && !code) return null;
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (code) params.set('code', code);
  if (teamName?.trim()) params.set('team', teamName.trim());
  return `/api/player-photo?${params.toString()}`;
}

function toSummary(e: FplElement, teamsById: Map<number, FplTeam>): PlayerSummary {
  const team = teamsById.get(e.team);
  const teamName = team?.name ?? '';
  return {
    id: e.id,
    name: e.web_name,
    teamName,
    teamShort: team?.short_name ?? teamName.slice(0, 3).toUpperCase(),
    position: POS_LABELS[e.element_type] ?? '',
    photoUrl: getPlayerPhotoUrl(e, teamName || undefined),
    price: e.now_cost != null ? e.now_cost / 10 : null,
    totalPoints: e.total_points ?? null,
  };
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** Player headshot with an initials fallback when the photo is missing or fails to load. */
function PlayerPhoto({
  url,
  name,
  className,
  rounded = 'rounded-full',
}: {
  url: string | null;
  name: string;
  className: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative shrink-0 overflow-hidden bg-fpl-raised ring-1 ring-fpl-border ${rounded} ${className}`}>
      {url && !failed ? (
        <img
          src={url}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover object-top"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-slate-400">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function ArrowIcon({ direction, className = 'h-3.5 w-3.5' }: { direction: Direction; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {direction === 'in' ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Top captained                                                       */
/* ------------------------------------------------------------------ */

function CaptainTile({
  label,
  shortLabel,
  sublabel,
  player,
}: {
  label: string;
  /** Shown on phones, where two tiles share one row. */
  shortLabel: string;
  sublabel: string | null;
  player: PlayerSummary | null;
}) {
  const shortSub = sublabel?.replace(/^Gameweek\s*/i, 'GW');
  return (
    <div className="flex items-center gap-2 sm:gap-4 rounded-lg sm:rounded-xl border border-fpl-border bg-fpl-raised/50 p-2 sm:p-4 min-w-0">
      {player ? (
        <div className="relative shrink-0">
          <PlayerPhoto url={player.photoUrl} name={player.name} className="h-9 w-9 sm:h-14 sm:w-14" />
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-fpl-brand font-display text-[9px] sm:text-[10px] font-bold text-fpl-dark ring-2 ring-fpl-card">
            C
          </span>
        </div>
      ) : (
        <div className="h-9 w-9 sm:h-14 sm:w-14 shrink-0 rounded-full bg-fpl-raised ring-1 ring-fpl-border" />
      )}
      <div className="min-w-0">
        <p className="eyebrow !text-[9px] sm:!text-[11px] truncate">
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
          {sublabel && (
            <span className="text-slate-600">
              {' · '}
              <span className="sm:hidden">{shortSub}</span>
              <span className="hidden sm:inline">{sublabel}</span>
            </span>
          )}
        </p>
        {player ? (
          <>
            <p className="font-display text-sm sm:text-lg font-semibold text-white truncate sm:mt-0.5 leading-tight">{player.name}</p>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">{player.teamName}</p>
          </>
        ) : (
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Not available yet</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Transfers                                                           */
/* ------------------------------------------------------------------ */

function PodiumCard({ row, rank, direction }: { row: TransferRow; rank: number; direction: Direction }) {
  const s = DIRECTION_STYLES[direction];
  return (
    <div
      className="group relative flex flex-col items-center overflow-hidden rounded-xl border border-fpl-border bg-fpl-raised/60 px-1.5 pb-3 pt-2.5 sm:px-2 text-center min-w-0 transition-colors hover:border-slate-600"
      title={`${row.name} (${row.teamName}) · ${row.count.toLocaleString()} transfers ${direction}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${s.glow} to-transparent`} />
      <span className="absolute left-2 top-2 font-display text-xs font-bold text-slate-500">{rank}</span>
      <PlayerPhoto
        url={row.photoUrl}
        name={row.name}
        className="relative h-14 w-14 sm:h-[72px] sm:w-[72px]"
      />
      <p className="relative mt-2 w-full truncate text-xs sm:text-sm font-semibold text-white">{row.name}</p>
      <p className="relative text-[10px] sm:text-[11px] text-slate-500">
        {row.teamShort} · {row.position}
        {row.price != null && <span className="hidden sm:inline"> · £{row.price.toFixed(1)}</span>}
      </p>
      <p className={`relative mt-1.5 font-display text-sm sm:text-base font-bold tabular-nums ${s.text}`}>
        {s.sign}
        {compact.format(row.count)}
      </p>
    </div>
  );
}

function TransferColumn({ direction, rows }: { direction: Direction; rows: TransferRow[] }) {
  const s = DIRECTION_STYLES[direction];
  const podium = rows.slice(0, PODIUM_N);
  const rest = rows.slice(PODIUM_N);
  const max = rows[0]?.count ?? 1;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ring-1 ${s.chip}`}>
          <ArrowIcon direction={direction} />
        </span>
        <h4 className="text-sm font-semibold text-white">
          Most transferred {direction}
        </h4>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fpl-border px-4 py-8 text-center text-sm text-slate-500">
          No data for this gameweek yet
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {podium.map((row, i) => (
              <PodiumCard key={row.id} row={row} rank={i + 1} direction={direction} />
            ))}
          </div>

          {rest.length > 0 && (
            <ol className="mt-3 divide-y divide-fpl-border/60 rounded-xl border border-fpl-border bg-fpl-raised/30">
              {rest.map((row, i) => (
                <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-4 shrink-0 text-right font-display text-xs font-semibold text-slate-500 tabular-nums">
                    {i + PODIUM_N + 1}
                  </span>
                  <PlayerPhoto url={row.photoUrl} name={row.name} className="h-7 w-7" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="truncate text-sm text-white">{row.name}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">{row.teamShort}</span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-fpl-border/60">
                      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs font-medium text-slate-300 tabular-nums">
                    {row.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat leaders: xG, xA, xGI, defensive contribution                   */
/* ------------------------------------------------------------------ */

type LeaderStat = 'xg' | 'xa' | 'xgi' | 'defcon';
type LeaderMode = 'total' | 'per90';

/** Per-90 lists need enough minutes to be meaningful (otherwise a 20-minute cameo tops the table). */
const PER90_MIN_MINUTES = 270;

const LEADER_STATS: {
  id: LeaderStat;
  tab: string;
  title: string;
  total: (e: FplElement) => number;
  per90: (e: FplElement) => number;
  /** Actual output to compare with the expected stat. */
  actual?: { label: string; value: (e: FplElement) => number };
  decimals: number;
}[] = [
  {
    id: 'xg',
    tab: 'xG',
    title: 'Expected goals',
    total: (e) => parseFloat(e.expected_goals ?? '0') || 0,
    per90: (e) => e.expected_goals_per_90 ?? 0,
    actual: { label: 'G', value: (e) => e.goals_scored ?? 0 },
    decimals: 2,
  },
  {
    id: 'xa',
    tab: 'xA',
    title: 'Expected assists',
    total: (e) => parseFloat(e.expected_assists ?? '0') || 0,
    per90: (e) => e.expected_assists_per_90 ?? 0,
    actual: { label: 'A', value: (e) => e.assists ?? 0 },
    decimals: 2,
  },
  {
    id: 'xgi',
    tab: 'xGI',
    title: 'Expected goal involvements',
    total: (e) => parseFloat(e.expected_goal_involvements ?? '0') || 0,
    per90: (e) => e.expected_goal_involvements_per_90 ?? 0,
    actual: { label: 'G+A', value: (e) => (e.goals_scored ?? 0) + (e.assists ?? 0) },
    decimals: 2,
  },
  {
    id: 'defcon',
    tab: 'DefCon',
    title: 'Defensive contribution',
    total: (e) => e.defensive_contribution ?? 0,
    per90: (e) => e.defensive_contribution_per_90 ?? 0,
    decimals: 0,
  },
];

function StatLeadersCard({ elements, teamsById }: { elements: FplElement[]; teamsById: Map<number, FplTeam> }) {
  const [statId, setStatId] = useState<LeaderStat>('xg');
  const [mode, setMode] = useState<LeaderMode>('total');
  const [position, setPosition] = useState<0 | 2 | 3>(0);
  const stat = LEADER_STATS.find((x) => x.id === statId)!;
  const isDefCon = statId === 'defcon';

  const rows = useMemo(() => {
    const value = mode === 'per90' ? stat.per90 : stat.total;
    return elements
      .filter((e) => (mode === 'per90' ? (e.minutes ?? 0) >= PER90_MIN_MINUTES : true))
      .filter((e) => !isDefCon || position === 0 || e.element_type === position)
      .map((e) => ({ e, value: value(e) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value || (b.e.minutes ?? 0) - (a.e.minutes ?? 0))
      .slice(0, TOP_N);
  }, [elements, stat, mode, position, isDefCon]);

  const max = rows[0]?.value || 1;
  const decimals = mode === 'per90' ? 2 : stat.decimals;
  const half = Math.ceil(rows.length / 2);

  const renderRow = ({ e, value }: { e: FplElement; value: number }, rank: number) => {
    const p = toSummary(e, teamsById);
    const actual = stat.actual && mode === 'total' ? stat.actual.value(e) : null;
    const diff = actual != null ? actual - value : null;
    return (
      <li key={e.id} className="flex items-center gap-2 px-2.5 py-2 sm:gap-2.5 sm:px-3">
        <span className="w-4 shrink-0 text-right font-display text-xs font-semibold tabular-nums text-slate-500 sm:w-5">{rank}</span>
        <PlayerPhoto url={p.photoUrl} name={p.name} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-white">{p.name}</span>
            <span className="shrink-0 text-[11px] text-slate-500">{p.teamShort}</span>
            {/* Position pill only from sm up: on phones the space goes to the name. */}
            <span className="hidden sm:inline-flex">
              <PosPill type={e.element_type} />
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-fpl-border/60">
            <div className="h-full rounded-full bg-fpl-brand/70" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
          </div>
        </div>
        <div className="w-[62px] shrink-0 text-right sm:w-[68px]">
          <p className="font-display text-sm font-bold tabular-nums text-white">{value.toFixed(decimals)}</p>
          {actual != null && diff != null ? (
            <p className="text-[10px] tabular-nums text-slate-500" title={`${actual} actual vs ${value.toFixed(2)} expected`}>
              {actual} {stat.actual!.label}{' '}
              <span className={diff >= 0.5 ? 'text-emerald-400' : diff <= -0.5 ? 'text-rose-400' : 'text-slate-500'}>
                ({diff >= 0 ? '+' : '−'}
                {Math.abs(diff).toFixed(1)})
              </span>
            </p>
          ) : isDefCon && mode === 'total' ? (
            <p className="text-[10px] tabular-nums text-slate-500">{(e.defensive_contribution_per_90 ?? 0).toFixed(1)} /90</p>
          ) : (
            <p className="text-[10px] tabular-nums text-slate-500">{(e.minutes ?? 0).toLocaleString()}′ played</p>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="card mt-5 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="section-title">Stat leaders</h3>
          <p className="text-xs text-slate-500">
            {stat.title} · top {TOP_N}
            {mode === 'per90' ? ` · min ${PER90_MIN_MINUTES} minutes` : ' · season total'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented" role="tablist" aria-label="Stat">
            {LEADER_STATS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={statId === x.id}
                data-active={statId === x.id}
                onClick={() => setStatId(x.id)}
                className="!px-2.5"
                title={x.title}
              >
                {x.tab}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Total or per 90 minutes">
            {(['total', 'per90'] as const).map((m) => (
              <button key={m} type="button" data-active={mode === m} aria-pressed={mode === m} onClick={() => setMode(m)} className="!px-2.5">
                {m === 'total' ? 'Total' : 'Per 90'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isDefCon && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="segmented" role="group" aria-label="Position">
            {([0, 2, 3] as const).map((pos) => (
              <button
                key={pos}
                type="button"
                data-active={position === pos}
                aria-pressed={position === pos}
                onClick={() => setPosition(pos)}
                className="!px-2.5 !text-xs"
              >
                {pos === 0 ? 'All' : POS_LABELS[pos]}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-500">
            FPL bonus: DEF 10+ (tackles, blocks, interceptions, clearances) · MID/FWD 12+ (incl. recoveries) = 2 pts
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fpl-border px-4 py-8 text-center text-sm text-slate-500">No data yet</div>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <ol className="min-w-0 divide-y divide-fpl-border/60 rounded-xl border border-fpl-border bg-fpl-raised/30">
            {rows.slice(0, half).map((r, i) => renderRow(r, i + 1))}
          </ol>
          {rows.length > half && (
            <ol className="min-w-0 divide-y divide-fpl-border/60 rounded-xl border border-fpl-border bg-fpl-raised/30">
              {rows.slice(half).map((r, i) => renderRow(r, i + half + 1))}
            </ol>
          )}
        </div>
      )}
      {stat.actual && mode === 'total' && (
        <p className="mt-2 text-[11px] text-slate-500">
          Green = scoring more than expected, red = less (a sign returns may be due).
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Player stats table                                                  */
/* ------------------------------------------------------------------ */

type SortKey = 'points' | 'price' | 'selected' | 'form' | 'rank';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'points', label: 'Points' },
  { key: 'price', label: 'Price' },
  { key: 'selected', label: 'Sel %' },
  { key: 'form', label: 'Form' },
  { key: 'rank', label: 'Rank' },
];

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
      aria-sort={isActive ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined}
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSort(sortKey)}
      className={`px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] cursor-pointer select-none whitespace-nowrap transition-colors ${
        isActive ? 'text-fpl-brand' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {label}
      <span className={`ml-1 inline-block w-2 ${isActive ? '' : 'opacity-0'}`} aria-hidden>
        {sortDir === 'desc' ? '↓' : '↑'}
      </span>
    </th>
  );
}

function PosPill({ type }: { type: number }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-px text-[10px] font-semibold ring-1 ${POS_PILL[type] ?? ''}`}>
      {POS_LABELS[type]}
    </span>
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

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

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
    cost != null ? `£${(cost / 10).toFixed(1)}` : '—';
  const pct = (s: string | undefined) => (s != null && s !== '' ? `${s}%` : '—');
  const rank = (r: number | undefined) => (r != null ? r.toLocaleString() : '—');
  const teamShort = (id: number) => {
    const t = teamsById.get(id);
    return t?.short_name ?? t?.name ?? '';
  };

  return (
    <div className="card overflow-hidden min-w-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5 border-b border-fpl-border">
        <div>
          <h3 className="section-title">All players</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {sorted.length} players<span className="hidden md:inline"> · click a column to sort</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented" role="group" aria-label="Filter by position">
            <button type="button" data-active={positionFilter === ''} onClick={() => onPositionChange('')}>
              All
            </button>
            {[1, 2, 3, 4].map((id) => (
              <button
                key={id}
                type="button"
                data-active={positionFilter === String(id)}
                onClick={() => onPositionChange(String(id))}
              >
                {POS_LABELS[id]}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter by team"
            value={teamFilter}
            onChange={(e) => onTeamChange(e.target.value)}
            className="select-arrow-white rounded-lg border border-fpl-border bg-fpl-raised px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fpl-brand/60 min-w-[150px]"
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
          {/* Column headers are hidden on mobile, so expose sorting as a select there. */}
          <select
            aria-label="Sort by"
            value={sortKey}
            onChange={(e) => {
              setSortKey(e.target.value as SortKey);
              setSortDir('desc');
            }}
            className="md:hidden select-arrow-white rounded-lg border border-fpl-border bg-fpl-raised px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fpl-brand/60"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                Sort: {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile: card list */}
      <div
        className="md:hidden w-full min-w-0 overflow-y-auto overflow-x-hidden players-news-scroll"
        style={{ maxHeight: `min(${ROWS_IN_FIRST_VIEW * 44}px, 75vh)` }}
      >
        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-slate-500 text-center text-sm">No players match the filters</div>
        ) : (
          <ul className="divide-y divide-fpl-border/60">
            {sorted.map((e, i) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 shrink-0 font-display text-xs font-semibold text-slate-600 tabular-nums">{i + 1}</span>
                  <span className="truncate text-sm font-medium text-white">{e.web_name}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{teamShort(e.team)}</span>
                  <PosPill type={e.element_type} />
                  <span className="ml-auto shrink-0 font-display text-sm font-bold text-white tabular-nums">
                    {e.total_points ?? '—'}
                    <span className="ml-0.5 text-[10px] font-medium text-slate-500">pts</span>
                  </span>
                </div>
                <div className="mt-1.5 ml-8 flex gap-4 text-[11px] text-slate-500 tabular-nums">
                  <span><span className="text-slate-300">{price(e.now_cost)}</span></span>
                  <span>Sel <span className="text-slate-300">{pct(e.selected_by_percent)}</span></span>
                  <span>Form <span className="text-slate-300">{e.form ?? '—'}</span></span>
                  <span>Rank <span className="text-slate-300">{rank(e.selected_rank)}</span></span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Desktop: table in contained scroll */}
      <div
        className="hidden md:block player-stats-scroll w-full min-w-0"
        style={{ maxHeight: `min(${ROWS_IN_FIRST_VIEW * 44}px, 75vh)` }}
      >
        <table className="w-full text-left min-w-[640px]">
          <thead className="sticky top-0 z-10 bg-fpl-raised">
            <tr className="border-b border-fpl-border">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 w-10">#</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Player</th>
              {SORT_OPTIONS.map((o) => (
                <SortableTh
                  key={o.key}
                  label={o.label}
                  sortKey={o.key}
                  currentSortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-slate-500 text-center text-sm">
                  No players match the filters
                </td>
              </tr>
            ) : (
              sorted.map((e, i) => {
                const cell = (key: SortKey) =>
                  `px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-sm ${
                    sortKey === key ? 'text-white font-semibold' : 'text-slate-400'
                  }`;
                return (
                  <tr key={e.id} className="border-b border-fpl-border/50 last:border-0 hover:bg-fpl-raised/50 transition-colors">
                    <td className="px-4 py-2.5 font-display text-xs font-semibold text-slate-600 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-sm font-medium text-white max-w-[180px]" title={teamsById.get(e.team)?.name}>
                          {e.web_name}
                        </span>
                        <span className="text-xs text-slate-500">{teamShort(e.team)}</span>
                        <PosPill type={e.element_type} />
                      </div>
                    </td>
                    <td className={cell('points')}>{e.total_points != null ? e.total_points.toLocaleString() : '—'}</td>
                    <td className={cell('price')}>{price(e.now_cost)}</td>
                    <td className={cell('selected')}>{pct(e.selected_by_percent)}</td>
                    <td className={cell('form')}>{e.form ?? '—'}</td>
                    <td className={cell('rank')}>{rank(e.selected_rank)}</td>
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

/* ------------------------------------------------------------------ */
/* Prices                                                              */
/* ------------------------------------------------------------------ */

type PriceTab = 'changes' | 'predicted' | 'value';
type ValueMetric = 'season' | 'form';

const PRICE_TABS: { key: PriceTab; label: string; blurb: string }[] = [
  { key: 'changes', label: 'Price changes', blurb: 'Players whose price has moved this gameweek.' },
  {
    key: 'predicted',
    label: 'Predicted',
    blurb: "Estimate based on net transfers this gameweek. FPL's price formula isn't public.",
  },
  { key: 'value', label: 'Value picks', blurb: 'Most points for the money. Only players with regular minutes.' },
];

/** Price in tenths → "+£0.1m" / "−£0.2m". */
function formatPriceDelta(tenths: number): string {
  const sign = tenths > 0 ? '+' : tenths < 0 ? '−' : '';
  return `${sign}£${(Math.abs(tenths) / 10).toFixed(1)}m`;
}

function formatSigned(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString()}`;
}

function formatPrice(e: FplElement): string {
  return e.now_cost != null ? `£${(e.now_cost / 10).toFixed(1)}` : '—';
}

function netTransfers(e: FplElement): number {
  return (e.transfers_in_event ?? 0) - (e.transfers_out_event ?? 0);
}

function deltaClass(n: number): string {
  return n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-slate-500';
}

interface StatColumn {
  label: string;
  /** Hidden below the sm breakpoint so the table fits on phones. */
  hideOnMobile?: boolean;
  highlight?: boolean;
}

interface StatRow {
  id: number;
  player: PlayerSummary;
  positionType: number;
  cells: ReactNode[];
}

/** Compact ranked player table shared by every price tab. */
function StatTable({
  title,
  direction,
  columns,
  rows,
  emptyText,
}: {
  title?: string;
  direction?: Direction;
  columns: StatColumn[];
  rows: StatRow[];
  emptyText: string;
}) {
  const th = 'px-2 sm:px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap';
  return (
    <div className="min-w-0">
      {title && direction && (
        <div className="mb-3 flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-md ring-1 ${DIRECTION_STYLES[direction].chip}`}>
            <ArrowIcon direction={direction} />
          </span>
          <h4 className="text-sm font-semibold text-white">{title}</h4>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fpl-border px-4 py-8 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-fpl-border bg-fpl-raised/30">
          <table className="w-full text-left">
            <thead className="bg-fpl-raised/70">
              <tr className="border-b border-fpl-border">
                <th className={`${th} w-8 text-right`}>#</th>
                <th className={th}>Player</th>
                {columns.map((c) => (
                  <th key={c.label} className={`${th} text-right ${c.hideOnMobile ? 'hidden sm:table-cell' : ''} ${c.highlight ? 'text-slate-300' : ''}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="border-b border-fpl-border/50 last:border-0 hover:bg-fpl-raised/50 transition-colors">
                  <td className="px-2 sm:px-3 py-2 text-right font-display text-xs font-semibold text-slate-500 tabular-nums">{i + 1}</td>
                  <td className="px-2 sm:px-3 py-2 max-w-0 w-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerPhoto url={row.player.photoUrl} name={row.player.name} className="hidden sm:block h-8 w-8" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white" title={`${row.player.name} (${row.player.teamName})`}>
                          {row.player.name}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          {row.player.teamShort}
                          <PosPill type={row.positionType} />
                        </div>
                      </div>
                    </div>
                  </td>
                  {row.cells.map((cell, ci) => (
                    <td
                      key={columns[ci].label}
                      className={`px-2 sm:px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap ${
                        columns[ci].hideOnMobile ? 'hidden sm:table-cell' : ''
                      } ${columns[ci].highlight ? 'font-semibold text-white' : 'text-slate-400'}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PricesCard({
  elements,
  teamsById,
  finishedGameweeks,
}: {
  elements: FplElement[];
  teamsById: Map<number, FplTeam>;
  finishedGameweeks: number;
}) {
  const [tab, setTab] = useState<PriceTab>('changes');
  const [valuePosition, setValuePosition] = useState<string>('');
  const [valueMetric, setValueMetric] = useState<ValueMetric>('season');

  const baseRow = (e: FplElement) => ({ id: e.id, player: toSummary(e, teamsById), positionType: e.element_type });

  // 1. Actual price changes this gameweek.
  const { risers, fallers } = useMemo(() => {
    const changed = elements.filter((e) => (e.cost_change_event ?? 0) !== 0);
    // Biggest move first, ties broken by the transfer pressure behind it.
    const sortBy = (dir: 1 | -1) => (a: FplElement, b: FplElement) =>
      dir * ((b.cost_change_event ?? 0) - (a.cost_change_event ?? 0)) || dir * (netTransfers(b) - netTransfers(a));
    const toRow = (e: FplElement): StatRow => ({
      ...baseRow(e),
      cells: [
        formatPrice(e),
        <span className={`font-semibold ${deltaClass(e.cost_change_event ?? 0)}`}>{formatPriceDelta(e.cost_change_event ?? 0)}</span>,
        <span className={deltaClass(e.cost_change_start ?? 0)}>{formatPriceDelta(e.cost_change_start ?? 0)}</span>,
        formatSigned(netTransfers(e)),
      ],
    });
    return {
      risers: changed.filter((e) => (e.cost_change_event ?? 0) > 0).sort(sortBy(1)).slice(0, TOP_N).map(toRow),
      fallers: changed.filter((e) => (e.cost_change_event ?? 0) < 0).sort(sortBy(-1)).slice(0, TOP_N).map(toRow),
    };
  }, [elements, teamsById]);

  // 3. Likely to rise / fall next, ranked by net transfers.
  const { likelyRise, likelyFall } = useMemo(() => {
    const toRow = (e: FplElement): StatRow => {
      const net = netTransfers(e);
      return {
        ...baseRow(e),
        cells: [
          formatPrice(e),
          <span className={`font-semibold ${deltaClass(net)}`}>{formatSigned(net)}</span>,
          e.selected_by_percent != null ? `${e.selected_by_percent}%` : '—',
        ],
      };
    };
    const byNet = [...elements].sort((a, b) => netTransfers(b) - netTransfers(a));
    return {
      likelyRise: byNet.filter((e) => netTransfers(e) > 0).slice(0, TOP_N).map(toRow),
      likelyFall: byNet.filter((e) => netTransfers(e) < 0).reverse().slice(0, TOP_N).map(toRow),
    };
  }, [elements, teamsById]);

  // 4. Value picks: points (or form) per £m, ignoring players who barely play.
  const minMinutes = Math.round(Math.max(1, finishedGameweeks) * 90 * 0.5);
  const valueRows = useMemo(() => {
    const metric = (e: FplElement) => {
      const cost = (e.now_cost ?? 0) / 10;
      if (cost <= 0) return 0;
      const base = valueMetric === 'season' ? e.total_points ?? 0 : parseFloat(e.form ?? '0') || 0;
      return base / cost;
    };
    return elements
      .filter((e) => (e.minutes ?? 0) >= minMinutes)
      .filter((e) => !valuePosition || String(e.element_type) === valuePosition)
      .map((e) => ({ e, v: metric(e) }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 15)
      .map(({ e, v }): StatRow => ({
        ...baseRow(e),
        cells: [
          formatPrice(e),
          valueMetric === 'season' ? (e.total_points ?? 0).toLocaleString() : e.form ?? '—',
          e.selected_by_percent != null ? `${e.selected_by_percent}%` : '—',
          <span className="font-display text-fpl-brand">{valueMetric === 'season' ? v.toFixed(1) : v.toFixed(2)}</span>,
        ],
      }));
  }, [elements, teamsById, valuePosition, valueMetric, minMinutes]);

  const activeTab = PRICE_TABS.find((t) => t.key === tab)!;

  return (
    <section className="card mt-5 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="section-title">Prices</h3>
          <p className="text-xs text-slate-500 mt-0.5">{activeTab.blurb}</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Price views">
          {PRICE_TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'changes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {(['in', 'out'] as const).map((dir) => (
            <StatTable
              key={dir}
              title={dir === 'in' ? 'Price risers' : 'Price fallers'}
              direction={dir}
              columns={[
                { label: 'Price' },
                { label: 'GW', highlight: true },
                { label: 'Season', hideOnMobile: true },
                { label: 'Net', hideOnMobile: true },
              ]}
              rows={dir === 'in' ? risers : fallers}
              emptyText={dir === 'in' ? 'No price rises yet this gameweek' : 'No price falls yet this gameweek'}
            />
          ))}
        </div>
      )}

      {tab === 'predicted' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {(['in', 'out'] as const).map((dir) => (
            <StatTable
              key={dir}
              title={dir === 'in' ? 'Likely to rise' : 'Likely to fall'}
              direction={dir}
              columns={[
                { label: 'Price' },
                { label: 'Net transfers', highlight: true },
                { label: 'Sel %', hideOnMobile: true },
              ]}
              rows={dir === 'in' ? likelyRise : likelyFall}
              emptyText="No transfer data for this gameweek yet"
            />
          ))}
        </div>
      )}

      {tab === 'value' && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="segmented" role="group" aria-label="Value metric">
              <button type="button" data-active={valueMetric === 'season'} onClick={() => setValueMetric('season')}>
                Season pts / £m
              </button>
              <button type="button" data-active={valueMetric === 'form'} onClick={() => setValueMetric('form')}>
                Form / £m
              </button>
            </div>
            <div className="segmented" role="group" aria-label="Filter by position">
              <button type="button" data-active={valuePosition === ''} onClick={() => setValuePosition('')}>
                All
              </button>
              {[1, 2, 3, 4].map((id) => (
                <button key={id} type="button" data-active={valuePosition === String(id)} onClick={() => setValuePosition(String(id))}>
                  {POS_LABELS[id]}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500 sm:ml-auto">Min. {minMinutes} mins played</span>
          </div>
          <StatTable
            columns={[
              { label: 'Price' },
              { label: valueMetric === 'season' ? 'Points' : 'Form', hideOnMobile: true },
              { label: 'Sel %', hideOnMobile: true },
              { label: valueMetric === 'season' ? 'Pts / £m' : 'Form / £m', highlight: true },
            ]}
            rows={valueRows}
            emptyText="No players match"
          />
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Section shortcuts                                                   */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { id: 'captains', label: 'Captains' },
  { id: 'leaders', label: 'Stat leaders' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'prices', label: 'Prices' },
  { id: 'players', label: 'All players' },
] as const;

/**
 * Sticky row of shortcuts under the site header. Tapping one scrolls to that section; the tab for the section
 * being read is highlighted as the page scrolls. Returns the scroll offset sections should leave at the top.
 */
function useSectionNav() {
  const [headerH, setHeaderH] = useState(64);
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const barRef = useRef<HTMLDivElement>(null);

  // The site header is one row on desktop and two on phones, so measure it rather than guess.
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const ro = new ResizeObserver(() => setHeaderH(header.getBoundingClientRect().height));
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const offset = headerH + (barRef.current?.offsetHeight ?? 52) + 12;

  useEffect(() => {
    // Five position reads per scroll event is cheap, so no throttling needed.
    const onScroll = () => {
      let current: string = SECTIONS[0].id;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= offset + 24) current = id;
      }
      // At the very bottom the last section may be too short to reach the top; still mark it active.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = SECTIONS[SECTIONS.length - 1].id;
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);

  // Keep the active tab visible in the horizontally scrolling bar on phones.
  useEffect(() => {
    const btn = barRef.current?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: reduce ? 'auto' : 'smooth' });
    setActive(id);
  };

  const bar = (
    <div
      ref={barRef}
      className="sticky z-20 -mx-4 mb-4 border-b border-fpl-border/60 bg-fpl-dark/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-fpl-dark/70"
      style={{ top: headerH }}
    >
      <nav className="no-scrollbar flex gap-1.5 overflow-x-auto" aria-label="Player Stats sections">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            data-section={sec.id}
            onClick={() => go(sec.id)}
            aria-current={active === sec.id ? 'true' : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              active === sec.id
                ? 'bg-fpl-accent text-fpl-purple'
                : 'bg-fpl-raised/70 text-slate-300 ring-1 ring-inset ring-fpl-border hover:text-white'
            }`}
          >
            {sec.label}
          </button>
        ))}
      </nav>
    </div>
  );

  return { bar };
}

export default function PlayerStatsPage() {
  const { data: bootstrap } = useBootstrapStatic();
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const { bar: sectionNav } = useSectionNav();

  const teamsById = useMemo(
    () => new Map((bootstrap?.teams ?? []).map((t) => [t.id, t])),
    [bootstrap]
  );

  const { topIn, topOut } = useMemo(() => {
    const elements: FplElement[] = bootstrap?.elements ?? [];
    const top = (count: (e: FplElement) => number): TransferRow[] =>
      elements
        .map((e) => ({ e, count: count(e) }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_N)
        .map(({ e, count }) => ({ ...toSummary(e, teamsById), count }));

    return {
      topIn: top((e) => e.transfers_in_event ?? 0),
      topOut: top((e) => e.transfers_out_event ?? 0),
    };
  }, [bootstrap, teamsById]);

  const { currentGw, currentCaptain, previousGw, previousCaptain } = useMemo(() => {
    const events: FplEvent[] = bootstrap?.events ?? [];
    const elements: FplElement[] = bootstrap?.elements ?? [];
    const currentGwId = getCurrentEvent(bootstrap ?? undefined);
    const previousGwId = currentGwId != null && currentGwId > 1 ? currentGwId - 1 : null;

    const eventCurrent = currentGwId != null ? events.find((e) => e.id === currentGwId) ?? null : null;
    const eventPrevious = previousGwId != null ? events.find((e) => e.id === previousGwId) ?? null : null;

    const getPlayer = (elementId: number | null | undefined) => {
      if (elementId == null) return null;
      const el = elements.find((e) => e.id === elementId);
      return el ? toSummary(el, teamsById) : null;
    };

    return {
      currentGw: eventCurrent,
      currentCaptain: getPlayer(eventCurrent?.most_captained),
      previousGw: eventPrevious,
      previousCaptain: getPlayer(eventPrevious?.most_captained),
    };
  }, [bootstrap, teamsById]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-5">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">Player Stats</h2>
        <p className="text-slate-400 text-sm mt-1">Captaincy picks, transfer trends and season stats for every player.</p>
      </div>

      {sectionNav}

      <section id="captains" className="card p-4 sm:p-5">
        <h3 className="section-title mb-3">Most captained</h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <CaptainTile label="This gameweek" shortLabel="This GW" sublabel={currentGw?.name ?? null} player={currentCaptain} />
          <CaptainTile label="Last gameweek" shortLabel="Last GW" sublabel={previousGw?.name ?? null} player={previousCaptain} />
        </div>
      </section>

      <div id="leaders">
        <StatLeadersCard elements={bootstrap?.elements ?? []} teamsById={teamsById} />
      </div>

      <section id="transfers" className="card mt-5 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="section-title">
            Transfers
            {currentGw && <span className="ml-2 text-sm font-medium text-slate-500">{currentGw.name}</span>}
          </h3>
          <p className="text-xs text-slate-500">Refreshes every 24 hours</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <TransferColumn direction="in" rows={topIn} />
          <TransferColumn direction="out" rows={topOut} />
        </div>
      </section>

      <div id="prices">
        <PricesCard
          elements={bootstrap?.elements ?? []}
          teamsById={teamsById}
          finishedGameweeks={(bootstrap?.events ?? []).filter((e) => e.finished).length}
        />
      </div>

      <section id="players" className="mt-5 min-w-0 overflow-hidden">
        <PlayerStatsTable
          elements={bootstrap?.elements ?? []}
          teams={bootstrap?.teams ?? []}
          positionFilter={positionFilter}
          teamFilter={teamFilter}
          onPositionChange={setPositionFilter}
          onTeamChange={setTeamFilter}
        />
      </section>
    </main>
  );
}
