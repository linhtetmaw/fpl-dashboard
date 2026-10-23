import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEventLive } from '../api/fpl';
import type { FplElement, FplFixture, FplTeam } from '../types/fpl';
import { bonusAwarded, bonusFromBps, fixtureStat } from '../utils/bonus';
import { isFixtureLive } from '../utils/fixtureStatus';
import LineupPitch, { buildLineup, getConfirmedLineups } from './LineupPitch';

interface MatchDetailsProps {
  fixture: FplFixture;
  elementsById: Map<number, FplElement>;
  teams: Map<number, FplTeam>;
}

/**
 * Each team's line-up on a pitch: predicted, then confirmed (about an hour before kick-off), then live. Once the match
 * starts every player shows their points from FPL's per-fixture breakdown, BPS, defensive contribution, and the bonus
 * and DC points earned (bonus projected from live BPS until FPL awards it).
 */
export default function MatchDetails({ fixture: f, elementsById, teams }: MatchDetailsProps) {
  const live = isFixtureLive(f);
  const { data: liveData, isLoading } = useQuery({
    queryKey: ['fpl', 'live', f.event],
    queryFn: () => getEventLive(f.event),
    enabled: Boolean(f.started),
    refetchInterval: live ? 60 * 1000 : false,
  });
  // Before kick-off the predicted XI leans on who started last gameweek.
  const { data: prevLive } = useQuery({
    queryKey: ['fpl', 'live', f.event - 1],
    queryFn: () => getEventLive(f.event - 1),
    enabled: !f.started && f.event > 1,
    staleTime: 60 * 60 * 1000,
  });
  // Announced line-ups (about an hour before kick-off); the server only looks from 90 minutes before.
  const kickoff = f.kickoff_time ? new Date(f.kickoff_time).getTime() : 0;
  const nearKickoff = !f.finished && !f.finished_provisional && kickoff > 0 && Date.now() > kickoff - 90 * 60 * 1000;
  const { data: confirmed } = useQuery({
    queryKey: ['lineups', f.id],
    queryFn: () => getConfirmedLineups(f.id),
    enabled: nearKickoff,
    staleTime: 60 * 1000,
    refetchInterval: (q) => (q.state.data?.status === 'confirmed' ? false : 2 * 60 * 1000),
  });
  const [side, setSide] = useState<'h' | 'a'>('h');

  const awarded = bonusAwarded(f);
  const bps = fixtureStat(f, 'bps');
  const bonus = awarded
    ? new Map(fixtureStat(f, 'bonus').map((r) => [r.element, r.value]))
    : bonusFromBps(bps);
  const bpsByElement = new Map(bps.map((r) => [r.element, r.value]));
  const dcByElement = new Map(fixtureStat(f, 'defensive_contribution').map((r) => [r.element, r.value]));

  /** Points this player scored in this match (FPL breakdown), plus bonus if it's only projected so far. */
  const matchPoints = (element: number) => {
    const el = liveData?.elements.find((e) => (e.id ?? e.element) === element);
    const explain = el?.explain?.find((x) => x.fixture === f.id);
    if (!explain) return null;
    const pts = explain.stats.reduce((n, s) => n + s.points, 0);
    return pts + (awarded ? 0 : bonus.get(element) ?? 0);
  };

  const stats = { bps: bpsByElement, dc: dcByElement, bonus, points: matchPoints };
  const elements = useMemo(() => [...elementsById.values()], [elementsById]);
  const lineupTeam = side === 'h' ? f.team_h : f.team_a;
  const confirmedSide = confirmed?.status === 'confirmed' ? confirmed[side === 'h' ? 'home' : 'away'] : null;
  const lineup = buildLineup(f, lineupTeam, elements, liveData, prevLive, f.event - 1, stats, confirmedSide);

  const tab = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${active ? 'bg-fpl-brand/15 text-fpl-brand' : 'text-slate-400 hover:text-white'}`;

  return (
    <div className="border-t border-fpl-border/60 bg-fpl-dark/40 px-2 py-3 sm:px-5">
      <div className="mb-3 flex gap-1" role="tablist" aria-label="Team">
        {(['h', 'a'] as const).map((s) => {
          const t = teams.get(s === 'h' ? f.team_h : f.team_a);
          return (
            <button key={s} type="button" role="tab" aria-selected={side === s} className={tab(side === s)} onClick={() => setSide(s)}>
              {t?.name ?? (s === 'h' ? 'Home' : 'Away')}
            </button>
          );
        })}
      </div>
      {isLoading && f.started ? (
        <div className="h-80 animate-pulse rounded-xl bg-fpl-raised/60" />
      ) : (
        <LineupPitch lineup={lineup} team={teams.get(lineupTeam)} bonusProjected={!awarded} />
      )}
      <p className="mt-2 text-[11px] text-slate-500">
        {lineup.kind === 'predicted'
          ? 'Predicted from last gameweek’s line-up, starts this season and injury news. The confirmed XI replaces it when the teams are announced, about an hour before kick-off.'
          : lineup.kind === 'confirmed'
          ? 'Confirmed line-up, announced before kick-off. Points, BPS and defensive contribution appear once the match starts.'
          : `Points include bonus (BON) and defensive contribution (DC: +2 at 10 for defenders, 12 for midfielders and forwards)${
              live ? ', updated every minute while the match is on' : ''
            }.${awarded ? '' : ' Bonus marked * is projected from live BPS (top 3 get 3/2/1) and can change until FPL confirms it.'}`}
      </p>
    </div>
  );
}
