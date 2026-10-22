import { useQuery } from '@tanstack/react-query';
import { getEventLive } from '../api/fpl';
import type { FplElement, FplFixture, FplTeam } from '../types/fpl';
import { DC_THRESHOLD, bonusAwarded, bonusFromBps, fixtureStat } from '../utils/bonus';
import { isFixtureLive } from '../utils/fixtureStatus';

const POS: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
/** Show defensive contribution for players within this many of the threshold. */
const DC_NEAR = 4;

interface MatchDetailsProps {
  fixture: FplFixture;
  elementsById: Map<number, FplElement>;
  teams: Map<number, FplTeam>;
}

/**
 * Bonus (projected from live BPS until FPL awards it), defensive contribution progress and each listed player's
 * points for this match. Points come from FPL's per-fixture breakdown, plus projected bonus.
 */
export default function MatchDetails({ fixture: f, elementsById, teams }: MatchDetailsProps) {
  const live = isFixtureLive(f);
  const { data: liveData, isLoading } = useQuery({
    queryKey: ['fpl', 'live', f.event],
    queryFn: () => getEventLive(f.event),
    refetchInterval: live ? 60 * 1000 : false,
  });

  const awarded = bonusAwarded(f);
  const bps = fixtureStat(f, 'bps');
  const bonus = awarded
    ? new Map(fixtureStat(f, 'bonus').map((r) => [r.element, r.value]))
    : bonusFromBps(bps);
  const bpsByElement = new Map(bps.map((r) => [r.element, r.value]));

  /** Points this player scored in this match (FPL breakdown), plus bonus if it's only projected so far. */
  const matchPoints = (element: number) => {
    const el = liveData?.elements.find((e) => (e.id ?? e.element) === element);
    const explain = el?.explain?.find((x) => x.fixture === f.id);
    if (!explain) return null;
    const pts = explain.stats.reduce((n, s) => n + s.points, 0);
    return pts + (awarded ? 0 : bonus.get(element) ?? 0);
  };

  const who = (element: number) => {
    const e = elementsById.get(element);
    return {
      name: e?.web_name ?? `#${element}`,
      team: e ? teams.get(e.team)?.short_name ?? '' : '',
      type: e?.element_type ?? 0,
    };
  };

  // Top BPS: everyone in a bonus place, then the next few chasing.
  const bpsRows = [...bps].sort((a, b) => b.value - a.value).slice(0, Math.max(5, bonus.size));

  const dcRows = fixtureStat(f, 'defensive_contribution')
    .map((r) => ({ ...r, ...who(r.element) }))
    .filter((r) => {
      const t = DC_THRESHOLD[r.type];
      return t != null && r.value >= t - DC_NEAR;
    })
    .sort((a, b) => b.value / DC_THRESHOLD[b.type]! - a.value / DC_THRESHOLD[a.type]!)
    .slice(0, 8);

  const pts = (element: number) => {
    const v = matchPoints(element);
    return v == null ? (isLoading ? '…' : '—') : `${v} pt${Math.abs(v) === 1 ? '' : 's'}`;
  };

  return (
    <div className="grid gap-3 border-t border-fpl-border/60 bg-fpl-dark/40 px-3 py-3 sm:grid-cols-2 sm:gap-5 sm:px-5">
      <section>
        <h4 className="eyebrow mb-1.5">
          {awarded ? 'Bonus' : 'Bonus (projected)'}
          <span className="ml-1 normal-case tracking-normal text-slate-600">· BPS</span>
        </h4>
        {bpsRows.length === 0 ? (
          <p className="text-xs text-slate-500">No BPS yet.</p>
        ) : (
          <ul className="space-y-1">
            {bpsRows.map((r) => {
              const p = who(r.element);
              const b = bonus.get(r.element) ?? 0;
              return (
                <li key={r.element} className="flex items-center gap-2 text-xs">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-display text-[11px] font-bold ${
                      b > 0 ? 'bg-amber-400 text-fpl-ink' : 'bg-fpl-raised text-slate-600'
                    }`}
                    title={b > 0 ? `${b} bonus point${b === 1 ? '' : 's'}${awarded ? '' : ' (projected)'}` : 'No bonus'}
                  >
                    {b > 0 ? b : '–'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">
                    {p.name} <span className="text-slate-500">{p.team}</span>
                  </span>
                  <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{bpsByElement.get(r.element)}</span>
                  <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-white">{pts(r.element)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h4 className="eyebrow mb-1.5">
          Defensive contribution
          <span className="ml-1 normal-case tracking-normal text-slate-600">· DEF 10 · MID/FWD 12 = +2</span>
        </h4>
        {dcRows.length === 0 ? (
          <p className="text-xs text-slate-500">Nobody close to the threshold yet.</p>
        ) : (
          <ul className="space-y-1">
            {dcRows.map((r) => {
              const t = DC_THRESHOLD[r.type]!;
              const done = r.value >= t;
              return (
                <li key={r.element} className="flex items-center gap-2 text-xs">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                      done ? 'bg-emerald-500 text-fpl-ink' : 'bg-fpl-raised text-slate-500'
                    }`}
                  >
                    {done ? '✓' : '…'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">
                    {r.name} <span className="text-slate-500">{r.team} · {POS[r.type]}</span>
                  </span>
                  <span className={`w-12 shrink-0 text-right tabular-nums ${done ? 'font-semibold text-emerald-400' : 'text-slate-400'}`}>
                    {r.value}/{t}
                  </span>
                  <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-white">{pts(r.element)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {!awarded && (
        <p className="text-[11px] text-slate-500 sm:col-span-2">
          Bonus is projected from live BPS (top 3 get 3/2/1) and can change until FPL confirms it after the match. Points include it.
        </p>
      )}
    </div>
  );
}
