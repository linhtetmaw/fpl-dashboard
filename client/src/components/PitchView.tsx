import { useState } from 'react';
import type { PlayerPoints } from '../types/fpl';
import type { BootstrapStatic, FplElement, FplFixture } from '../types/fpl';
import { isFixtureLive } from '../utils/fixtureStatus';
import LiveBadge from './LiveBadge';
import { DC_THRESHOLD } from '../utils/bonus';
import PlayerDetailCard from './PlayerDetailCard';
import { getPlayerImageUrl } from '../utils/playerPhoto';
import { getAvailability } from '../utils/availability';
import AvailabilityBadge from './AvailabilityBadge';

/** Group starting XI by element_type: 1=GKP, 2=DEF, 3=MID, 4=FWD. Order: FWD top → GKP bottom (vertical pitch). */
function getFormationRows(players: PlayerPoints[]): PlayerPoints[][] {
  const starting = players.filter((p) => !p.is_on_bench).sort((a, b) => a.position - b.position);
  const byType: PlayerPoints[][] = [[], [], [], []];
  for (const p of starting) {
    const idx = p.element_type >= 1 && p.element_type <= 4 ? p.element_type - 1 : 0;
    byType[idx].push(p);
  }
  return byType;
}

function getBenchPlayers(players: PlayerPoints[]): PlayerPoints[] {
  return players.filter((p) => p.is_on_bench).sort((a, b) => a.position - b.position);
}

interface PitchViewProps {
  players: PlayerPoints[];
  bootstrap: BootstrapStatic | undefined;
  /** When set, use these 11 for the pitch (with auto-subs in place) and bench section below. */
  effectivePitchPlayers?: PlayerPoints[];
  /** Bench players not used as subs. Shown after replacedStarters on the bench. */
  effectiveBench?: PlayerPoints[];
  /** Starters who did not play and were replaced; show their cards on the bench (non-starting players moved to bench). */
  replacedStarters?: PlayerPoints[];
  /** Fixtures of the gameweek shown: adds each player's opponent and an "In play" badge while their match is on. */
  fixtures?: FplFixture[] | null;
}

type ClubFixture = { opponent: number; home: boolean; live: boolean };

export default function PitchView({ players, bootstrap, effectivePitchPlayers, effectiveBench, replacedStarters, fixtures }: PitchViewProps) {
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null);
  const pitchPlayers = effectivePitchPlayers?.length === 11 ? effectivePitchPlayers : players.filter((p) => !p.is_on_bench).sort((a, b) => a.position - b.position);
  const hasEffective = effectivePitchPlayers?.length === 11;
  const benchUnused = hasEffective ? (effectiveBench ?? []) : [];
  const replaced = hasEffective ? (replacedStarters ?? []) : [];
  const benchPlayers = benchUnused.length > 0 || replaced.length > 0 ? [...replaced, ...benchUnused] : getBenchPlayers(players);
  const rows = getFormationRows(pitchPlayers);
  const [gkRow, defRow, midRow, fwdRow] = rows;
  const elementById = new Map<number, FplElement>(
    (bootstrap?.elements ?? []).map((e) => [e.id, e])
  );
  const teamById = new Map<number, string>(
    (bootstrap?.teams ?? []).map((t) => [t.id, t.name])
  );

  const shortById = new Map<number, string>((bootstrap?.teams ?? []).map((t) => [t.id, t.short_name ?? t.name.slice(0, 3).toUpperCase()]));
  /** Each club's matches this gameweek (two in a double gameweek, none in a blank). */
  const fixturesByClub = new Map<number, ClubFixture[]>();
  for (const f of [...(fixtures ?? [])].sort((a, b) => (a.kickoff_time ?? '').localeCompare(b.kickoff_time ?? ''))) {
    const live = isFixtureLive(f);
    fixturesByClub.set(f.team_h, [...(fixturesByClub.get(f.team_h) ?? []), { opponent: f.team_a, home: true, live }]);
    fixturesByClub.set(f.team_a, [...(fixturesByClub.get(f.team_a) ?? []), { opponent: f.team_h, home: false, live }]);
  }

  const bench = benchPlayers;
  const selectedElement = selectedElementId != null ? elementById.get(selectedElementId) : null;
  const selectedTeamName = selectedElement != null ? teamById.get(selectedElement.team) : undefined;

  const renderPlayerCard = (p: PlayerPoints, { isReplaced = false }: { isReplaced?: boolean }) => {
    const element = elementById.get(p.element_id);
    const teamName = element ? teamById.get(element.team) : undefined;
    const imageUrl = getPlayerImageUrl(element, teamName);
    const isSub = p.is_substitute === true;
    const availability = getAvailability(element);
    const clubFixtures = fixtures && element ? fixturesByClub.get(element.team) ?? [] : null;
    const inPlay = clubFixtures?.some((f) => f.live) ?? false;
    const opponents = clubFixtures?.map((f) => `${shortById.get(f.opponent) ?? '?'} (${f.home ? 'H' : 'A'})`).join(', ');
    const bonus = p.projected_bonus ?? 0;
    const dcThreshold = DC_THRESHOLD[p.element_type];
    const dc = p.defensive_contribution ?? 0;
    const showDc = dcThreshold != null && dc > 0 && !isReplaced;
    return (
      <button
        type="button"
        key={`${p.element_id}-${p.position}-${isSub ? 'sub' : ''}-${isReplaced ? 'repl' : ''}`}
        className={`group flex flex-col items-center w-[64px] sm:w-[80px] shrink-0 rounded-lg overflow-hidden text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-fpl-brand ${
          isReplaced ? 'opacity-60' : ''
        }`}
        onClick={() => element && setSelectedElementId(p.element_id)}
        title={isSub ? 'Auto-sub (replaced non-playing starter)' : isReplaced ? 'Did not play (replaced by sub)' : `View ${p.web_name}`}
      >
        <div className="relative w-12 h-14 sm:w-[60px] sm:h-[70px] flex-shrink-0 overflow-hidden rounded-t-md">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={p.web_name}
              className="w-full h-full object-cover object-top"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const fallback = img.nextElementSibling;
                if (fallback instanceof HTMLElement) fallback.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`absolute inset-0 flex items-center justify-center bg-fpl-raised text-slate-400 font-bold text-xs ${imageUrl ? 'hidden' : ''}`}
            aria-hidden={!!imageUrl}
          >
            {p.web_name.slice(0, 2).toUpperCase()}
          </div>
          {p.is_captain && (
            <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-fpl-dark text-[9px] font-extrabold shadow">
              C
            </span>
          )}
          {p.is_vice_captain && (
            <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-white text-[8px] font-bold ring-1 ring-white/40 shadow">
              V
            </span>
          )}
          {isSub && (
            <span className="absolute top-0.5 left-0.5 rounded bg-amber-400 px-1 text-[8px] font-bold text-slate-900 shadow">
              SUB
            </span>
          )}
          {availability && <AvailabilityBadge availability={availability} className={`absolute left-0.5 ${isSub ? 'top-4' : 'top-0.5'}`} />}
          {inPlay && <LiveBadge label="In play" className="absolute bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap !text-[8px]" />}
        </div>
        <p className="w-full truncate bg-fpl-dark/95 px-1 py-0.5 text-center text-[10px] sm:text-[11px] font-semibold text-white">
          {p.web_name}
        </p>
        <p
          className={`w-full py-0.5 text-center text-[10px] sm:text-[11px] font-bold tabular-nums ${
            isReplaced ? 'bg-slate-600 text-white' : 'bg-fpl-brand text-fpl-dark'
          }`}
        >
          {isReplaced ? 'Did not play' : `${p.total_points_effective} pts`}
        </p>
        {(bonus > 0 || showDc) && !isReplaced && (
          <p
            className="flex w-full items-center justify-center gap-1 bg-fpl-dark/90 px-0.5 py-px text-[9px] font-bold tabular-nums sm:text-[10px]"
            title={[
              bonus > 0 ? `${bonus} projected bonus point${bonus === 1 ? '' : 's'} (from live BPS; can still change)` : null,
              showDc ? `Defensive contribution ${dc}/${dcThreshold}${dc >= dcThreshold ? ' — +2 earned' : ''}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            {bonus > 0 && <span className="text-amber-300">B+{bonus}</span>}
            {showDc && (
              <span className={dc >= dcThreshold ? 'text-emerald-400' : 'text-slate-400'}>
                {dc >= dcThreshold ? 'DC ✓+2' : `DC ${dc}/${dcThreshold}`}
              </span>
            )}
          </p>
        )}
        {clubFixtures && (
          <p
            className="w-full truncate rounded-b-md bg-fpl-dark/80 px-1 py-px text-center text-[9px] sm:text-[10px] font-medium text-slate-300"
            title={opponents || 'No match this gameweek'}
          >
            {opponents || 'No match'}
          </p>
        )}
      </button>
    );
  };

  const rowClass = 'relative flex justify-center gap-1.5 sm:gap-3';

  return (
    <div className="card overflow-hidden">
      {/* Vertical pitch (attack at the top): mown stripes and pitch markings */}
      <div
        className="relative px-2 py-5 sm:px-6 sm:py-6 flex flex-col justify-between gap-4 sm:gap-5"
        style={{
          minHeight: 380,
          backgroundColor: '#0f3b24',
          backgroundImage:
            'repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0 38px, transparent 38px 76px), radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.06), transparent 60%)',
        }}
      >
        <div className="pointer-events-none absolute inset-3 sm:inset-4 rounded-sm border border-white/15" />
        <div className="pointer-events-none absolute left-3 right-3 sm:left-4 sm:right-4 top-1/2 h-px bg-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-3 sm:top-4 h-12 w-2/5 -translate-x-1/2 border border-t-0 border-white/15" />
        <div className="pointer-events-none absolute left-1/2 bottom-3 sm:bottom-4 h-12 w-2/5 -translate-x-1/2 border border-b-0 border-white/15" />

        <div className={rowClass}>{(fwdRow ?? []).map((p) => renderPlayerCard(p, {}))}</div>
        <div className={rowClass}>{(midRow ?? []).map((p) => renderPlayerCard(p, {}))}</div>
        <div className={rowClass}>{(defRow ?? []).map((p) => renderPlayerCard(p, {}))}</div>
        <div className={rowClass}>{(gkRow ?? []).map((p) => renderPlayerCard(p, {}))}</div>
      </div>

      {/* Bench: replaced starters (did not play) first, then unused bench players */}
      {bench.length > 0 && (
        <div className="border-t border-fpl-border bg-fpl-raised/50 px-3 pt-2.5 pb-4 sm:px-5">
          <p className="eyebrow text-center mb-2.5">Bench</p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-3">
            {bench.map((p, i) => renderPlayerCard(p, { isReplaced: i < replaced.length }))}
          </div>
        </div>
      )}

      {selectedElement != null && (
        <PlayerDetailCard
          element={selectedElement}
          teamName={selectedTeamName ?? ''}
          teams={bootstrap?.teams ?? []}
          imageUrl={getPlayerImageUrl(selectedElement, selectedTeamName)}
          onClose={() => setSelectedElementId(null)}
        />
      )}
    </div>
  );
}
