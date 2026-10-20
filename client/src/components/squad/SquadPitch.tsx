import { useState } from 'react';
import type { FplElement } from '../../types/fpl';
import { POSITION_SHORT, QUOTA, type SquadDraft } from '../../utils/squadRules';
import { getPlayerImageUrl } from '../../utils/playerPhoto';

export type PitchMode = 'transfers' | 'lineup';

interface SquadPitchProps {
  mode: PitchMode;
  draft: SquadDraft;
  elementsById: Map<number, FplElement>;
  teamName: (teamId: number) => string;
  priceOf: (id: number) => number;
  /** Short next-fixture label per club, e.g. "LIV (A)". */
  nextFixture: (teamId: number) => string;
  /** Player picked for a substitution, highlighted; valid partners get a ring. */
  selectedId: number | null;
  swapTargets: Set<number>;
  onEmptySlot: (position: number) => void;
  onPlayer: (id: number) => void;
  /** Transfers view only: remove a player straight from their card. */
  onRemove: (id: number) => void;
}

function PlayerPhoto({ element, teamName }: { element: FplElement; teamName: string }) {
  const [failed, setFailed] = useState(false);
  const url = getPlayerImageUrl(element, teamName);
  return url && !failed ? (
    <img
      src={url}
      alt=""
      className="h-full w-full object-cover object-top"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-fpl-raised text-xs font-bold text-slate-400">
      {element.web_name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function SquadPitch({
  mode,
  draft,
  elementsById,
  teamName,
  priceOf,
  nextFixture,
  selectedId,
  swapTargets,
  onEmptySlot,
  onPlayer,
  onRemove,
}: SquadPitchProps) {
  const typeOf = (id: number) => elementsById.get(id)?.element_type ?? 0;
  const swapping = selectedId != null;

  const card = (id: number) => {
    const el = elementsById.get(id);
    if (!el) return null;
    const isSelected = selectedId === id;
    const isTarget = swapTargets.has(id);
    const dimmed = swapping && !isSelected && !isTarget;
    const flagged = el.status && el.status !== 'a';
    const removable = mode === 'transfers';
    return (
      <div key={id} className="relative shrink-0">
        <button
          type="button"
          onClick={() => onPlayer(id)}
          className={`relative flex w-[60px] shrink-0 flex-col items-center overflow-hidden rounded-lg text-left transition sm:w-[76px] ${
            isSelected ? 'ring-2 ring-amber-300' : isTarget ? 'ring-2 ring-emerald-400/80' : ''
          } ${dimmed ? 'opacity-40' : 'hover:-translate-y-0.5'} focus:outline-none focus-visible:ring-2 focus-visible:ring-fpl-brand`}
          title={flagged ? el.news || el.web_name : el.web_name}
        >
          <div className="relative h-14 w-12 overflow-hidden rounded-t-md sm:h-[66px] sm:w-[56px]">
            <PlayerPhoto element={el} teamName={teamName(el.team)} />
            {!removable && draft.captain === id && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-extrabold text-fpl-dark shadow">
                C
              </span>
            )}
            {!removable && draft.vice === id && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[8px] font-bold text-white shadow ring-1 ring-white/40">
                V
              </span>
            )}
            {flagged && (
              <span
                className={`absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-fpl-dark shadow ${
                  el.status === 'd' ? 'bg-amber-400' : 'bg-rose-500 text-white'
                }`}
                aria-label={el.news || 'Flagged'}
              >
                !
              </span>
            )}
          </div>
          <p className="w-full truncate bg-fpl-dark/95 px-1 py-0.5 text-center text-[10px] font-semibold text-white sm:text-[11px]">
            {el.web_name}
          </p>
          <p className="w-full truncate bg-white/90 py-0.5 text-center text-[10px] font-semibold tabular-nums text-fpl-dark sm:text-[11px]">
            {mode === 'transfers' ? `£${(priceOf(id) / 10).toFixed(1)}` : nextFixture(el.team) || '—'}
          </p>
        </button>
        {removable && (
          <button
            type="button"
            onClick={() => onRemove(id)}
            className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-sm font-bold leading-none text-white shadow ring-2 ring-[#0f3b24] transition-colors hover:bg-rose-500 focus:outline-none focus-visible:ring-white"
            aria-label={`Remove ${el.web_name}`}
            title={`Remove ${el.web_name}`}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  const emptySlot = (type: number, key: string) => (
    <button
      type="button"
      key={key}
      onClick={() => onEmptySlot(type)}
      className="flex h-[88px] w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/35 bg-black/15 text-white/70 transition-colors hover:border-white/70 hover:bg-black/25 hover:text-white sm:h-[102px] sm:w-[76px]"
      aria-label={`Add ${POSITION_SHORT[type]}`}
    >
      <span className="text-xl leading-none">+</span>
      <span className="text-[10px] font-semibold">{POSITION_SHORT[type]}</span>
    </button>
  );

  // Transfers view: the whole squad as 2-5-5-3 with empty slots. Lineup view: the XI by line, with the bench below.
  const rows = [4, 3, 2, 1].map((type) => {
    if (mode === 'transfers') {
      const owned = draft.players.filter((id) => typeOf(id) === type);
      const empties = Math.max(0, QUOTA[type] - owned.length);
      return [...owned.map(card), ...Array.from({ length: empties }, (_, i) => emptySlot(type, `empty-${type}-${i}`))];
    }
    return draft.starters.filter((id) => typeOf(id) === type).map(card);
  });

  const benchGk = draft.players.find((id) => typeOf(id) === 1 && !draft.starters.includes(id));
  const bench = [...(benchGk != null ? [benchGk] : []), ...draft.bench];

  return (
    <div className="card overflow-hidden">
      <div
        className="relative flex flex-col justify-between gap-4 px-2 py-5 sm:gap-5 sm:px-6 sm:py-6"
        style={{
          minHeight: 380,
          backgroundColor: '#0f3b24',
          backgroundImage:
            'repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0 38px, transparent 38px 76px), radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.06), transparent 60%)',
        }}
      >
        <div className="pointer-events-none absolute inset-3 rounded-sm border border-white/15 sm:inset-4" />
        <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-px bg-white/15 sm:left-4 sm:right-4" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-3 h-12 w-2/5 -translate-x-1/2 border border-t-0 border-white/15 sm:top-4" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-12 w-2/5 -translate-x-1/2 border border-b-0 border-white/15 sm:bottom-4" />
        {rows.map((row, i) => (
          <div key={i} className="relative flex justify-center gap-1.5 sm:gap-3">
            {row}
          </div>
        ))}
      </div>
      {mode === 'lineup' && (
        <div className="border-t border-fpl-border bg-fpl-raised/50 px-3 pb-4 pt-2.5 sm:px-5">
          <p className="eyebrow mb-2.5 text-center">Bench</p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-3">
            {bench.length ? bench.map(card) : <p className="py-4 text-xs text-slate-500">Substitutes appear here.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
