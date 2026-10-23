import { useState } from 'react';
import type { EventLiveResponse, FplElement, FplFixture, FplTeam } from '../types/fpl';
import { DC_THRESHOLD } from '../utils/bonus';
import { getPlayerImageUrl } from '../utils/playerPhoto';
import { getAvailability } from '../utils/availability';
import AvailabilityBadge from './AvailabilityBadge';
import { usePlayerCard } from './PlayerCardProvider';

type LiveElement = EventLiveResponse['elements'][number];
/** Bootstrap sends season starts too; not in the shared type. */
type Element = FplElement & { starts?: number };

export interface LineupPlayer {
  element: Element;
  /** Points in this match (FPL breakdown + projected bonus); null before kick-off. */
  points: number | null;
  bps: number | null;
  dc: number | null;
  /** Bonus this player gets (projected from BPS until FPL awards it). */
  bonus: number;
}

export interface Lineup {
  xi: LineupPlayer[];
  /** Subs who came on (after kick-off), the named bench (confirmed), or players likely to miss out (predicted). */
  bench: LineupPlayer[];
  /** predicted: our guess · confirmed: announced team (ESPN), before kick-off · started: from FPL's live data. */
  kind: 'predicted' | 'confirmed' | 'started';
  /** Formation as announced (confirmed line-ups only). */
  formation?: string | null;
}

/** One side of an announced line-up from /api/lineups (server/lineups.js). element is null if not matched to FPL. */
interface ConfirmedPlayer {
  element: number | null;
  name: string;
  type: number;
}
export interface ConfirmedSide {
  formation: string | null;
  xi: ConfirmedPlayer[];
  bench: ConfirmedPlayer[];
}
export type ConfirmedLineups = { status: 'confirmed'; home: ConfirmedSide; away: ConfirmedSide } | { status: 'pending' | 'unknown' };

export async function getConfirmedLineups(fixtureId: number): Promise<ConfirmedLineups> {
  const res = await fetch(`/api/lineups/${fixtureId}`);
  if (!res.ok) throw new Error(`Line-ups ${res.status}`);
  return res.json();
}

interface MatchStats {
  bps: Map<number, number>;
  dc: Map<number, number>;
  bonus: Map<number, number>;
  points: (element: number) => number | null;
}

const chance = (e: FplElement) => e.chance_of_playing_this_round ?? e.chance_of_playing_next_round ?? null;
const ruledOut = (e: FplElement) => {
  const c = chance(e);
  return c != null ? c < 50 : e.status != null && e.status !== 'a' && e.status !== 'd';
};

/**
 * Predicted XI before kick-off: one goalkeeper and ten outfielders (3–5 DEF, 2–5 MID, 1–3 FWD), picked by who started
 * last gameweek and how often they've started this season, leaving out players who are injured, suspended or below a
 * 50% chance of playing.
 */
function predictXi(squad: Element[], startedLastGw: Set<number>, gwsPlayed: number): { xi: Element[]; out: Element[] } {
  const score = (e: Element) =>
    (startedLastGw.has(e.id) ? 3 : 0) + (e.starts ?? 0) / Math.max(1, gwsPlayed) + (e.minutes ?? 0) / 90 / Math.max(1, gwsPlayed) / 2;
  const fit = squad.filter((e) => !ruledOut(e)).sort((a, b) => score(b) - score(a));
  const out = squad.filter((e) => ruledOut(e) && (startedLastGw.has(e.id) || (e.starts ?? 0) >= gwsPlayed / 2));

  const gk = fit.find((e) => e.element_type === 1);
  const MIN: Record<number, number> = { 2: 3, 3: 2, 4: 1 };
  const MAX: Record<number, number> = { 2: 5, 3: 5, 4: 3 };
  const count: Record<number, number> = { 2: 0, 3: 0, 4: 0 };
  const picked = new Set<number>();
  // Fill the minimum for each line first, then the best of the rest up to ten outfielders.
  for (const type of [2, 3, 4]) {
    for (const e of fit.filter((x) => x.element_type === type).slice(0, MIN[type])) {
      picked.add(e.id);
      count[type]++;
    }
  }
  for (const e of fit) {
    if (picked.size >= 10) break;
    if (e.element_type === 1 || picked.has(e.id) || count[e.element_type] >= MAX[e.element_type]) continue;
    picked.add(e.id);
    count[e.element_type]++;
  }
  const xi = [...(gk ? [gk] : []), ...fit.filter((e) => picked.has(e.id))];
  return { xi, out };
}

/** This team's line-up for the fixture: the real one once the match has started, predicted before. */
export function buildLineup(
  f: FplFixture,
  teamId: number,
  elements: Element[],
  live: EventLiveResponse | undefined,
  prevLive: EventLiveResponse | undefined,
  gwsPlayed: number,
  stats: MatchStats,
  confirmed?: ConfirmedSide | null
): Lineup {
  const squad = elements.filter((e) => e.team === teamId);
  const liveById = new Map<number, LiveElement>((live?.elements ?? []).map((e) => [(e.id ?? e.element)!, e]));
  const minutesIn = (id: number) =>
    liveById.get(id)?.explain?.find((x) => x.fixture === f.id)?.stats.find((s) => s.identifier === 'minutes')?.value ?? 0;
  const toPlayer = (e: Element, kickedOff: boolean): LineupPlayer => ({
    element: e,
    points: kickedOff ? stats.points(e.id) : null,
    bps: kickedOff ? stats.bps.get(e.id) ?? 0 : null,
    dc: kickedOff ? stats.dc.get(e.id) ?? 0 : null,
    bonus: kickedOff ? stats.bonus.get(e.id) ?? 0 : 0,
  });

  if (f.started) {
    const played = squad.filter((e) => minutesIn(e.id) > 0);
    if (played.length >= 11) {
      // FPL marks who started; fall back to the 11 with most minutes if that doesn't add up (e.g. a double gameweek).
      let starters = played.filter((e) => ((liveById.get(e.id)?.stats as { starts?: number } | undefined)?.starts ?? 0) > 0);
      if (starters.length !== 11) starters = [...played].sort((a, b) => minutesIn(b.id) - minutesIn(a.id)).slice(0, 11);
      const ids = new Set(starters.map((e) => e.id));
      return {
        xi: starters.map((e) => toPlayer(e, true)),
        bench: played.filter((e) => !ids.has(e.id)).map((e) => toPlayer(e, true)),
        kind: 'started',
        // The announced shape (e.g. 4-2-3-1) says more than FPL's positions, which count wingers as midfielders.
        formation: confirmed?.formation,
      };
    }
    // Kicked off but FPL's live data hasn't caught up yet: show the announced (or predicted) team until it does.
  }

  if (confirmed && confirmed.xi.length === 11) {
    const byId = new Map(squad.map((e) => [e.id, e]));
    // Players we couldn't match to FPL still show, by name, without FPL stats.
    const toElement = (p: ConfirmedPlayer, i: number): Element =>
      (p.element != null ? byId.get(p.element) : undefined) ?? { id: -1 - i, web_name: p.name, team: teamId, element_type: p.type };
    return {
      xi: confirmed.xi.map((p, i) => toPlayer(toElement(p, i), false)),
      bench: confirmed.bench.map((p, i) => toPlayer(toElement(p, 100 + i), false)),
      kind: 'confirmed',
      formation: confirmed.formation,
    };
  }

  const startedLastGw = new Set(
    (prevLive?.elements ?? [])
      .filter((e) => ((e.stats as { starts?: number }).starts ?? 0) > 0)
      .map((e) => (e.id ?? e.element)!)
  );
  const { xi, out } = predictXi(squad, startedLastGw, gwsPlayed);
  return { xi: xi.map((e) => toPlayer(e, false)), bench: out.map((e) => toPlayer(e, false)), kind: 'predicted' };
}

function PlayerTile({
  p,
  teamName,
  faded = false,
  bonusProjected = false,
}: {
  p: LineupPlayer;
  teamName: string;
  faded?: boolean;
  bonusProjected?: boolean;
}) {
  const openPlayer = usePlayerCard();
  const e = p.element;
  const [imgFailed, setImgFailed] = useState(false);
  const img = getPlayerImageUrl(e, teamName);
  const availability = getAvailability(e);
  const threshold = DC_THRESHOLD[e.element_type];
  const dcDone = threshold != null && p.dc != null && p.dc >= threshold;
  const selected = e.selected_by_percent != null ? `${Number(e.selected_by_percent).toFixed(1)}%` : '–';
  return (
    <button
      type="button"
      disabled={e.id < 0}
      onClick={() => openPlayer(e.id)}
      title={`View ${e.web_name}`}
      className={`flex w-[58px] sm:w-[80px] shrink-0 flex-col items-center overflow-hidden rounded-lg text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-fpl-brand ${
        faded ? 'opacity-60' : ''
      }`}
    >
      <div className="relative h-[52px] w-11 shrink-0 overflow-hidden rounded-t-md sm:h-[70px] sm:w-[60px]">
        {img && !imgFailed ? (
          <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-fpl-raised text-xs font-bold text-slate-400">
            {e.web_name.slice(0, 2).toUpperCase()}
          </div>
        )}
        {availability && <AvailabilityBadge availability={availability} className="absolute left-0.5 top-0.5" />}
      </div>
      <p className="w-full truncate bg-fpl-dark/95 px-1 py-0.5 text-center text-[10px] font-semibold text-white sm:text-[11px]">{e.web_name}</p>
      {p.points != null ? (
        <>
          <p className="w-full bg-fpl-accent py-0.5 text-center text-[10px] font-bold tabular-nums text-fpl-ink sm:text-[11px]">{p.points} pts</p>
          <div
            className="grid w-full auto-cols-fr grid-flow-col bg-fpl-dark/90 py-0.5 text-center leading-tight tabular-nums"
            title={`BPS ${p.bps}${threshold != null ? ` · Defensive contribution ${p.dc}/${threshold}${dcDone ? ' (+2 earned)' : ''}` : ''}`}
          >
            <span>
              <span className="block text-[8px] font-medium uppercase text-slate-500">BPS</span>
              <span className="block text-[10px] font-semibold text-slate-200">{p.bps}</span>
            </span>
            {threshold != null && (
              <span>
                <span className="block text-[8px] font-medium uppercase text-slate-500">DC</span>
                <span className={`block text-[10px] font-semibold ${dcDone ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {dcDone ? `✓ ${p.dc}` : `${p.dc}/${threshold}`}
                </span>
              </span>
            )}
          </div>
          {(p.bonus > 0 || dcDone) && (
            <div
              className="grid w-full auto-cols-fr grid-flow-col bg-fpl-dark/90 pb-0.5 text-center text-[10px] font-bold leading-tight tabular-nums"
              title={[
                p.bonus > 0 ? `${p.bonus} bonus point${p.bonus === 1 ? '' : 's'}${bonusProjected ? ' (projected from live BPS; can still change)' : ''}` : null,
                dcDone ? '2 points for defensive contribution' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              {p.bonus > 0 && (
                <span className="text-amber-300">
                  +{p.bonus} <span className="text-[8px] font-semibold">BON{bonusProjected ? '*' : ''}</span>
                </span>
              )}
              {dcDone && (
                <span className="text-emerald-400">
                  +2 <span className="text-[8px] font-semibold">DC</span>
                </span>
              )}
            </div>
          )}
        </>
      ) : null}
      <p className="w-full truncate rounded-b-md bg-fpl-dark/80 px-1 py-px text-center text-[9px] font-medium tabular-nums text-slate-400 sm:text-[10px]" title="Selected by FPL managers">
        Sel. {selected}
      </p>
    </button>
  );
}

/** One team's line-up on a vertical pitch (attack at the top), with subs or likely absentees underneath. */
export default function LineupPitch({
  lineup,
  team,
  bonusProjected = false,
}: {
  lineup: Lineup;
  team: FplTeam | undefined;
  /** Bonus isn't confirmed by FPL yet (marked * on the tiles). */
  bonusProjected?: boolean;
}) {
  const teamName = team?.name ?? '';
  const rows = [4, 3, 2, 1].map((type) => lineup.xi.filter((p) => p.element.element_type === type));
  const total = lineup.kind === 'started' ? lineup.xi.concat(lineup.bench).reduce((n, p) => n + (p.points ?? 0), 0) : null;
  const formation = lineup.formation || rows.slice(0, 3).reverse().map((r) => r.length).join('-');
  const title = { predicted: 'Predicted XI', confirmed: 'Confirmed XI', started: 'Starting XI' }[lineup.kind];
  return (
    <div className="overflow-hidden rounded-xl border border-fpl-border">
      <div className="flex items-center justify-between gap-2 bg-fpl-raised/60 px-3 py-1.5 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-slate-200">
          {lineup.kind === 'confirmed' && <span className="h-1.5 w-1.5 rounded-full bg-fpl-accent" aria-hidden />}
          {title} <span className="font-normal text-slate-500">· {formation}</span>
        </span>
        {total != null && <span className="tabular-nums text-slate-400">{total} pts in total</span>}
      </div>
      <div
        className="relative flex flex-col justify-between gap-3 px-1 py-4 sm:gap-4 sm:px-4"
        style={{
          minHeight: 340,
          backgroundColor: '#0f3b24',
          backgroundImage:
            'repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0 38px, transparent 38px 76px), radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.06), transparent 60%)',
        }}
      >
        <div className="pointer-events-none absolute inset-2 rounded-sm border border-fpl-snow/15" />
        <div className="pointer-events-none absolute left-2 right-2 top-1/2 h-px bg-fpl-snow/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fpl-snow/15" />
        <div className="pointer-events-none absolute bottom-2 left-1/2 h-10 w-2/5 -translate-x-1/2 border border-b-0 border-fpl-snow/15" />
        {rows.map((row, i) => (
          <div key={i} className="relative flex justify-center gap-1 sm:gap-3">
            {row.map((p) => (
              <PlayerTile key={p.element.id} p={p} teamName={teamName} bonusProjected={bonusProjected} />
            ))}
          </div>
        ))}
      </div>
      {lineup.bench.length > 0 && (
        <div className="border-t border-fpl-border bg-fpl-raised/50 px-2 pb-3 pt-2">
          <p className="eyebrow mb-2 text-center">{{ predicted: 'Likely to miss out', confirmed: 'Bench', started: 'Subs used' }[lineup.kind]}</p>
          <div className="flex flex-wrap justify-center gap-1 sm:gap-3">
            {lineup.bench.map((p) => (
              <PlayerTile key={p.element.id} p={p} teamName={teamName} faded={lineup.kind === 'predicted'} bonusProjected={bonusProjected} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
