import { useMemo, useState } from 'react';
import { useBootstrapStatic, useEventLive, useFixtures } from '../hooks/useFplApi';
import type { FplElement, FplFixture, FplTeam } from '../types/fpl';
import LineupPitch from '../components/LineupPitch';
import { PlayerPhoto } from '../components/FplNews';
import { usePlayerCard } from '../components/PlayerCardProvider';
import { getPlayerImageUrl } from '../utils/playerPhoto';
import { anyFixtureLive } from '../utils/fixtureStatus';
import { bonusAwarded } from '../utils/bonus';
import { housePicks, teamOfTheWeek, type HousePick } from '../utils/teamOfTheWeek';
import { FDR } from './ClubPage';

const POS: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

const PICK_STYLE: Record<
  HousePick['kind'],
  { label: string; glow: string; text: string; why: (e: FplElement) => string }
> = {
  captain: {
    label: 'Captain pick',
    glow: 'from-fpl-accent/20',
    text: 'text-fpl-accent',
    why: () => 'Our top projected midfielder or forward this gameweek, from form, season average and fixture.',
  },
  differential: {
    label: 'Differential pick',
    glow: 'from-sky-400/20',
    text: 'text-sky-300',
    why: (e) => `Owned by only ${e.selected_by_percent}% of managers, so a big score from him gains you rank.`,
  },
  popular: {
    label: 'Popular pick',
    glow: 'from-amber-400/20',
    text: 'text-amber-300',
    why: (e) => `Owned by ${e.selected_by_percent}% of managers. Not having him is the risk.`,
  },
};

const price = (e: FplElement) => (e.now_cost != null ? `£${(e.now_cost / 10).toFixed(1)}m` : '');

/** Each club's matches in the given fixtures (two in a double gameweek), in kick-off order. */
function opponentsOf(teamId: number, fixtures: FplFixture[] | undefined) {
  return (fixtures ?? [])
    .filter((f) => f.team_h === teamId || f.team_a === teamId)
    .sort((a, b) => (a.kickoff_time ?? '').localeCompare(b.kickoff_time ?? ''))
    .map((f) => {
      const home = f.team_h === teamId;
      return {
        id: f.id,
        opponent: home ? f.team_a : f.team_h,
        home,
        difficulty: home ? f.team_h_difficulty : f.team_a_difficulty,
      };
    });
}

function PlayerOfTheWeek({
  element,
  points,
  goals,
  assists,
  bonus,
  team,
  gw,
  live,
}: {
  element: FplElement;
  points: number;
  goals: number;
  assists: number;
  bonus: number;
  team: FplTeam | undefined;
  gw: number;
  live: boolean;
}) {
  const openPlayer = usePlayerCard();
  const facts = [
    goals > 0 && `${goals} goal${goals === 1 ? '' : 's'}`,
    assists > 0 && `${assists} assist${assists === 1 ? '' : 's'}`,
    bonus > 0 && `${bonus} bonus`,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => openPlayer(element.id)}
      className="card relative flex w-full items-center gap-4 overflow-hidden p-4 text-left transition-colors hover:border-amber-300/60 sm:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-400/15 to-transparent" />
      <PlayerPhoto url={getPlayerImageUrl(element, team?.name)} name={element.web_name} />
      <div className="relative min-w-0 flex-1">
        <p className="eyebrow text-amber-300">⭐ Player of the Week · GW{gw}</p>
        <p className="mt-1 truncate font-display text-xl font-bold text-white sm:text-2xl">{element.web_name}</p>
        <p className="text-sm text-slate-400">
          {team?.name} · {POS[element.element_type]}
          {facts.length > 0 && <> · {facts.join(', ')}</>}
        </p>
      </div>
      <div className="relative shrink-0 text-right">
        <p className="font-display text-3xl font-bold tabular-nums text-white sm:text-4xl">{points}</p>
        <p className="text-xs text-slate-500">{live ? 'pts so far' : 'pts'}</p>
      </div>
    </button>
  );
}

function PickCard({
  pick,
  team,
  fixtures,
  teams,
}: {
  pick: HousePick;
  team: FplTeam | undefined;
  fixtures: FplFixture[] | undefined;
  teams: Map<number, FplTeam>;
}) {
  const openPlayer = usePlayerCard();
  const e = pick.element;
  const style = PICK_STYLE[pick.kind];
  return (
    <button
      type="button"
      onClick={() => openPlayer(e.id)}
      className="card relative flex min-w-0 flex-col items-center overflow-hidden px-1.5 py-3 text-center transition-colors hover:border-slate-600 sm:p-4"
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${style.glow} to-transparent`}
      />
      {/* Three across on phones: "Captain" etc. without " pick", and no reason line. */}
      <p className={`eyebrow relative !text-[10px] sm:!text-[11px] ${style.text}`}>
        {style.label.replace(' pick', '')}
        <span className="hidden sm:inline"> pick</span>
      </p>
      <div className="relative mt-2 sm:mt-3">
        <PlayerPhoto url={getPlayerImageUrl(e, team?.name)} name={e.web_name} />
      </div>
      <p className="relative mt-2 w-full truncate font-display text-sm font-bold text-white sm:text-lg">{e.web_name}</p>
      <p className="relative text-[10px] text-slate-500 sm:text-xs">
        {team?.short_name} · {POS[e.element_type]}
        <span className="block sm:inline">
          <span className="hidden sm:inline"> · </span>
          {price(e)}
        </span>
      </p>
      <div className="relative mt-2 flex flex-wrap justify-center gap-1">
        {opponentsOf(e.team, fixtures).map((o) => (
          <span
            key={o.id}
            className={`rounded px-1 py-0.5 text-[10px] font-semibold sm:px-1.5 sm:text-[11px] ${FDR[o.difficulty ?? 3] ?? FDR[3]}`}
          >
            {teams.get(o.opponent)?.short_name} ({o.home ? 'H' : 'A'})
          </span>
        ))}
      </div>
      <dl className="relative mt-2 grid w-full grid-cols-1 gap-1 rounded-lg bg-fpl-raised/60 py-1.5 text-center sm:mt-3 sm:grid-cols-3 sm:py-2">
        <div>
          <dt className="text-[9px] uppercase text-slate-500 sm:text-[10px]">Proj. pts</dt>
          <dd className="text-sm font-semibold tabular-nums text-white sm:text-base">{pick.expected.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase text-slate-500 sm:text-[10px]">Form</dt>
          <dd className="text-sm font-semibold tabular-nums text-white sm:text-base">{e.form ?? '–'}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase text-slate-500 sm:text-[10px]">Owned</dt>
          <dd className="text-sm font-semibold tabular-nums text-white sm:text-base">{e.selected_by_percent}%</dd>
        </div>
      </dl>
      <p className="relative mt-3 hidden text-xs leading-5 text-slate-400 sm:block">{style.why(e)}</p>
    </button>
  );
}

/** Team of the Week and Player of the Week (any finished or live gameweek), plus FPL House picks for the next one. */
export default function TeamOfTheWeekPage() {
  const { data: bootstrap, isLoading } = useBootstrapStatic();
  const events = bootstrap?.events ?? [];
  const currentGw = events.find((e) => e.is_current)?.id ?? null;
  const nextGw = events.find((e) => e.is_next)?.id ?? null;
  const [picked, setPicked] = useState<number | null>(null);
  const gw = picked ?? currentGw;

  const { data: fixtures } = useFixtures(gw);
  const inPlay = anyFixtureLive(fixtures);
  const { data: live, isLoading: liveLoading } = useEventLive(gw, inPlay);
  const { data: nextFixtures } = useFixtures(nextGw);

  const elements = bootstrap?.elements ?? [];
  const teams = useMemo(() => new Map((bootstrap?.teams ?? []).map((t) => [t.id, t])), [bootstrap?.teams]);
  const totw = useMemo(() => teamOfTheWeek(elements, live, fixtures), [elements, live, fixtures]);
  const picks = useMemo(
    () => housePicks(elements, nextFixtures, events.filter((e) => e.finished).length),
    [elements, nextFixtures, events]
  );
  const gwDone = events.find((e) => e.id === gw)?.finished ?? false;
  const bonusPending = (fixtures ?? []).some((f) => f.started && !bonusAwarded(f));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">Team of the Week</h1>
      <p className="mt-1 text-sm text-slate-400">
        The highest-scoring FPL team of each gameweek, the Player of the Week, and FPL House picks for the next
        deadline.
      </p>

      <section className="mt-5 space-y-3">
        <h2 className="section-title">FPL House picks{nextGw != null && ` · Gameweek ${nextGw}`}</h2>
        {picks.length === 0 ? (
          <p className="card p-6 text-sm text-slate-400">
            {nextGw == null ? 'No upcoming gameweek.' : 'Picks appear once the next gameweek’s fixtures are known.'}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {picks.map((p) => (
              <PickCard key={p.kind} pick={p} team={teams.get(p.element.team)} fixtures={nextFixtures} teams={teams} />
            ))}
          </div>
        )}
      </section>
      <section className="mx-auto mt-8 max-w-2xl space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">
            Gameweek {gw ?? '–'}
            {gw != null && !gwDone && (
              <span className="ml-2 text-xs font-medium text-slate-500">{inPlay ? 'live' : 'so far'}</span>
            )}
          </h2>
          {currentGw != null && (
            <div className="segmented">
              <button
                type="button"
                disabled={gw == null || gw <= 1}
                onClick={() => setPicked((gw ?? 1) - 1)}
                aria-label="Previous gameweek"
              >
                ‹
              </button>
              <button
                type="button"
                disabled={gw == null || gw >= currentGw}
                onClick={() => setPicked((gw ?? 0) + 1)}
                aria-label="Next gameweek"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {isLoading || liveLoading ? (
          <div className="card h-[460px] animate-pulse" />
        ) : !totw ? (
          <p className="card p-6 text-sm text-slate-400">
            {currentGw == null
              ? 'The season hasn’t started yet.'
              : 'Not enough matches played yet for a Team of the Week.'}
          </p>
        ) : (
          <>
            <PlayerOfTheWeek
              element={totw.star.element}
              points={totw.star.points ?? 0}
              goals={totw.star.goals}
              assists={totw.star.assists}
              bonus={totw.star.bonus}
              team={teams.get(totw.star.element.team)}
              gw={gw!}
              live={!gwDone}
            />
            <LineupPitch
              lineup={{ xi: totw.xi, bench: [], kind: 'started' }}
              team={undefined}
              title="Team of the Week"
              teamNameOf={(e) => teams.get(e.team)?.name ?? ''}
              starId={totw.star.element.id}
              bonusProjected={bonusPending}
            />
            {bonusPending && (
              <p className="text-[11px] text-slate-500">* Bonus projected from live BPS until FPL confirms it.</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
