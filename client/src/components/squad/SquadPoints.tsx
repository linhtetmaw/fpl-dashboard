import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { getEventLive, getFixtures } from '../../api/fpl';
import { computeTeamPointsSummary } from '../../hooks/useFplApi';
import type { BootstrapStatic, PicksResponse, SavedSquad, SquadVersion, TeamPointsSummary } from '../../types/fpl';
import PitchView from '../PitchView';

/** The version that was in place at a gameweek's deadline. */
function versionFor(squad: SavedSquad, gw: number): SquadVersion | null {
  let found: SquadVersion | null = null;
  for (const v of squad.versions) if (v.gw <= gw) found = v;
  return found;
}

function toPicksResponse(v: SquadVersion): PicksResponse {
  return {
    active_chip: null,
    picks: v.picks.map((p) => ({
      element: p.element,
      position: p.position,
      multiplier: p.position <= 11 ? (p.is_captain ? 2 : 1) : 0,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
    })),
  };
}

interface SquadPointsProps {
  squad: SavedSquad;
  bootstrap: BootstrapStatic;
}

export default function SquadPoints({ squad, bootstrap }: SquadPointsProps) {
  const currentGw = bootstrap.events.find((e) => e.is_current)?.id ?? null;
  const startGw = squad.start_gw;
  const gameweeks = useMemo(() => {
    if (startGw == null || currentGw == null || currentGw < startGw) return [];
    return Array.from({ length: currentGw - startGw + 1 }, (_, i) => startGw + i);
  }, [startGw, currentGw]);

  const [gw, setGw] = useState<number | null>(null);
  useEffect(() => {
    if (gw == null || !gameweeks.includes(gw)) setGw(gameweeks[gameweeks.length - 1] ?? null);
  }, [gameweeks, gw]);

  const liveQueries = useQueries({
    queries: gameweeks.map((g) => ({
      queryKey: ['fpl', 'live', g],
      queryFn: () => getEventLive(g),
      staleTime: g === currentGw ? 60 * 1000 : 30 * 60 * 1000,
    })),
  });
  const { data: fixtures, isLoading: fixturesLoading } = useQuery({
    queryKey: ['fpl', 'fixtures', 'all'],
    queryFn: () => getFixtures(),
    staleTime: 2 * 60 * 1000,
  });

  const summaries = useMemo(() => {
    const map = new Map<number, TeamPointsSummary>();
    if (fixturesLoading) return map;
    gameweeks.forEach((g, i) => {
      const live = liveQueries[i]?.data;
      const version = versionFor(squad, g);
      if (!live || !version) return;
      map.set(g, computeTeamPointsSummary(0, g, bootstrap, toPicksResponse(version), live, fixtures ?? null, squad.name));
    });
    return map;
  }, [gameweeks, liveQueries, squad, bootstrap, fixtures, fixturesLoading]);

  if (startGw == null) return null;

  if (gameweeks.length === 0) {
    const ev = bootstrap.events.find((e) => e.id === startGw);
    return (
      <div className="card p-6 text-center">
        <p className="font-display text-lg font-semibold text-white">Your squad starts scoring in {ev?.name ?? `Gameweek ${startGw}`}</p>
        {ev?.deadline_time && (
          <p className="mt-1 text-sm text-slate-400">
            Deadline {new Date(ev.deadline_time).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.
            You can keep editing until then.
          </p>
        )}
      </div>
    );
  }

  const summary = gw != null ? summaries.get(gw) : undefined;
  const total = [...summaries.values()].reduce((n, s) => n + s.total_points, 0);
  const allLoaded = summaries.size === gameweeks.length;
  const event = bootstrap.events.find((e) => e.id === gw);
  const avg = (event as { average_entry_score?: number } | undefined)?.average_entry_score;
  const value = gw != null ? versionFor(squad, gw)?.picks.reduce((n, p) => n + p.purchase_price, 0) : undefined;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Gameweek
          <select
            value={gw ?? ''}
            onChange={(e) => setGw(Number(e.target.value))}
            className="input select-arrow-white !w-auto !py-1.5"
          >
            {gameweeks.map((g) => (
              <option key={g} value={g}>
                GW{g}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-fpl-brand/15 px-4 py-2 ring-1 ring-inset ring-fpl-brand/30">
            <p className="eyebrow !text-fpl-brand">GW points</p>
            <p className="font-display text-2xl font-bold tabular-nums text-white">{summary?.total_points ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-fpl-raised px-4 py-2">
            <p className="eyebrow">Total</p>
            <p className="font-display text-2xl font-bold tabular-nums text-white">{allLoaded ? total : '…'}</p>
          </div>
          <div className="rounded-xl bg-fpl-raised px-4 py-2">
            <p className="eyebrow">GW average</p>
            <p className="font-display text-2xl font-bold tabular-nums text-slate-300">{avg ?? '—'}</p>
          </div>
        </div>
      </div>

      {summary ? (
        <PitchView
          players={summary.players}
          bootstrap={bootstrap}
          effectivePitchPlayers={summary.effectivePitchPlayers}
          effectiveBench={summary.effectiveBench}
          replacedStarters={summary.replacedStarters}
          fixtures={(fixtures ?? []).filter((f) => f.event === gw)}
        />
      ) : (
        <div className="card h-96 animate-pulse" />
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-fpl-border px-4 py-3">
          <h3 className="section-title !text-base">Gameweek history</h3>
          {value != null && <span className="text-xs text-slate-500">Squad value £{(value / 10).toFixed(1)}m</span>}
        </div>
        <ul className="divide-y divide-fpl-border/60">
          {[...gameweeks].reverse().map((g) => (
            <li key={g}>
              <button
                type="button"
                onClick={() => setGw(g)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.03] ${
                  g === gw ? 'bg-fpl-brand/10 shadow-[inset_3px_0_0_0_#00FF85]' : ''
                }`}
              >
                <span className="text-slate-300">
                  GW{g}
                  {g === currentGw && <span className="ml-2 text-[11px] text-emerald-400">live</span>}
                </span>
                <span className="font-display font-bold tabular-nums text-white">{summaries.get(g)?.total_points ?? '…'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
