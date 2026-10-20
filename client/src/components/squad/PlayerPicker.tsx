import { useMemo, useState } from 'react';
import type { FplElement, FplTeam } from '../../types/fpl';
import { MAX_PER_CLUB, POSITION_SHORT, QUOTA } from '../../utils/squadRules';
import { getAvailability } from '../../utils/availability';
import AvailabilityBadge from '../AvailabilityBadge';

type SortKey = 'price' | 'points' | 'form' | 'selected';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'points', label: 'Total points' },
  { id: 'price', label: 'Price' },
  { id: 'form', label: 'Form' },
  { id: 'selected', label: 'Selected %' },
];
const PAGE = 40;

/** Lowercase and strip accents so "odegaard" finds "Ødegaard". */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o')
    .toLowerCase();
}

interface PlayerPickerProps {
  elements: FplElement[];
  teams: FplTeam[];
  /** Position to show (1–4); 0 shows all. */
  position: number;
  onPositionChange: (position: number) => void;
  /** Ids already in the squad. */
  squad: number[];
  /** Player being replaced, if any: their price and club slot are freed up. */
  replacing: FplElement | null;
  /** Money left in tenths (before freeing up `replacing`). */
  bank: number;
  /** Players already picked per club. */
  clubCounts: Map<number, number>;
  /** Players already picked per position. */
  typeCounts: Record<number, number>;
  onPick: (element: FplElement) => void;
  onClose?: () => void;
}

export default function PlayerPicker({
  elements,
  teams,
  position,
  onPositionChange,
  squad,
  replacing,
  bank,
  clubCounts,
  typeCounts,
  onPick,
  onClose,
}: PlayerPickerProps) {
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState(0);
  const [sort, setSort] = useState<SortKey>('points');
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const teamShort = useMemo(() => new Map(teams.map((t) => [t.id, t.short_name ?? t.name.slice(0, 3)])), [teams]);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const available = bank + (replacing?.now_cost ?? 0);

  /** Why a player can't be added right now, or null if they can. */
  const blockReason = (e: FplElement): string | null => {
    if (squad.includes(e.id)) return 'In squad';
    if (replacing ? e.element_type !== replacing.element_type : typeCounts[e.element_type] >= QUOTA[e.element_type]) {
      return replacing ? 'Wrong position' : `${POSITION_SHORT[e.element_type]} full`;
    }
    const club = (clubCounts.get(e.team) ?? 0) - (replacing?.team === e.team ? 1 : 0);
    if (club >= MAX_PER_CLUB) return '3 from club';
    if ((e.now_cost ?? 0) > available) return 'Too expensive';
    return null;
  };

  const list = useMemo(() => {
    const q = fold(query.trim());
    const value = (e: FplElement) =>
      sort === 'price'
        ? e.now_cost ?? 0
        : sort === 'form'
          ? parseFloat(e.form ?? '0')
          : sort === 'selected'
            ? parseFloat(e.selected_by_percent ?? '0')
            : e.total_points ?? 0;
    return elements
      .filter((e) => (position === 0 || e.element_type === position) && (team === 0 || e.team === team))
      .filter((e) => !q || fold(`${e.web_name} ${e.first_name ?? ''} ${e.second_name ?? ''}`).includes(q))
      .filter((e) => !affordableOnly || (e.now_cost ?? 0) <= available)
      .sort((a, b) => value(b) - value(a) || (b.now_cost ?? 0) - (a.now_cost ?? 0));
  }, [elements, position, team, query, sort, affordableOnly, available]);

  return (
    <div className="card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-2.5 border-b border-fpl-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="section-title !text-base">{replacing ? `Replace ${replacing.web_name}` : 'Add players'}</h3>
            <p className="text-xs text-slate-500">
              Money available <span className="font-semibold text-white tabular-nums">£{(available / 10).toFixed(1)}m</span>
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-slate-400 hover:bg-white/5 hover:text-white"
              aria-label="Close player list"
            >
              ×
            </button>
          )}
        </div>
        {!replacing && (
          <div className="segmented w-full" role="group" aria-label="Position">
            {[0, 1, 2, 3, 4].map((p) => (
              <button
                key={p}
                type="button"
                data-active={position === p}
                aria-pressed={position === p}
                onClick={() => {
                  onPositionChange(p);
                  setShown(PAGE);
                }}
                className="flex-1 !px-2 !text-xs"
              >
                {p === 0 ? 'All' : POSITION_SHORT[p]}
              </button>
            ))}
          </div>
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search player"
          className="input !py-2"
          aria-label="Search player"
        />
        <div className="grid grid-cols-2 gap-2">
          <select value={team} onChange={(e) => setTeam(Number(e.target.value))} className="input select-arrow-white !py-2 !text-xs" aria-label="Club">
            <option value={0}>All clubs</option>
            {sortedTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input select-arrow-white !py-2 !text-xs" aria-label="Sort by">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={affordableOnly} onChange={(e) => setAffordableOnly(e.target.checked)} className="accent-current" />
          Only players I can afford
        </label>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-fpl-border/60 overflow-y-auto">
        {list.slice(0, shown).map((e) => {
          const reason = blockReason(e);
          const availability = getAvailability(e);
          return (
            <li key={e.id}>
              <button
                type="button"
                disabled={reason != null}
                onClick={() => onPick(e)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors enabled:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45"
                title={availability?.label}
              >
                <span className="w-9 shrink-0 text-[10px] font-semibold text-slate-500">{POSITION_SHORT[e.element_type]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-100">{e.web_name}</span>
                    {availability && <AvailabilityBadge availability={availability} className="shrink-0" />}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {teamShort.get(e.team)} · {e.total_points ?? 0} pts · form {e.form ?? '0'}
                    {reason ? <span className="text-rose-300/80"> · {reason}</span> : null}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-white">£{((e.now_cost ?? 0) / 10).toFixed(1)}</span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No players match.</li>}
      </ul>
      {list.length > shown && (
        <div className="shrink-0 border-t border-fpl-border p-2 text-center">
          <button type="button" className="btn-ghost !py-1.5 !text-xs" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({list.length - shown})
          </button>
        </div>
      )}
    </div>
  );
}
