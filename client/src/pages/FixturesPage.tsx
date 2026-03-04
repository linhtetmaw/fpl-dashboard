import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBootstrapStatic, useFixtures, useAllFixtures, getCurrentEvent } from '../hooks/useFplApi';
import type { FplFixture, FplTeam } from '../types/fpl';

const FDR_COLOR: Record<number, string> = {
  1: 'bg-emerald-500/30 text-emerald-200 border-emerald-500/50',
  2: 'bg-lime-500/20 text-lime-200 border-lime-500/40',
  3: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  4: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
  5: 'bg-rose-500/30 text-rose-200 border-rose-500/50',
};

function getTeamName(teams: FplTeam[], teamId: number): string {
  const team = teams.find((t) => t.id === teamId);
  return team?.name ?? `Team ${teamId}`;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC Time' },
  { value: 'Europe/London', label: 'UK Time' },
  { value: 'Europe/Berlin', label: 'CET Time' },
  { value: 'America/New_York', label: 'ET Time' },
  { value: 'America/Los_Angeles', label: 'PT Time' },
  { value: 'Asia/Kolkata', label: 'IST Time' },
  { value: 'Asia/Yangon', label: 'MM Time' },
  { value: 'Asia/Bangkok', label: 'ICT Time' },
  { value: 'Asia/Singapore', label: 'SGT Time' },
];

function formatKickoff(iso: string, timeZone: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    });
  } catch {
    return iso;
  }
}

const TIMEZONE_STORAGE_KEY = 'fpl_fixtures_timezone';
const MAX_GW = 38;

function getStoredTimezone(): string {
  if (typeof window === 'undefined') return 'Asia/Yangon';
  return localStorage.getItem(TIMEZONE_STORAGE_KEY) ?? 'Asia/Yangon';
}

export default function FixturesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [timezone, setTimezone] = useState(() => getStoredTimezone());
  const { data: bootstrap, error: bootstrapError } = useBootstrapStatic();
  const { data: allFixtures } = useAllFixtures();
  const events = bootstrap?.events ?? [];
  const teams = bootstrap?.teams ?? [];
  const defaultGw = getCurrentEvent(bootstrap ?? undefined);
  const gwParam = searchParams.get('gw');
  const gameweek = gwParam ? parseInt(gwParam, 10) : (defaultGw ?? 1);
  const effectiveGw = Number.isNaN(gameweek) || gameweek < 1 ? defaultGw ?? 1 : gameweek;

  const [fdrUntilGw, setFdrUntilGw] = useState(MAX_GW);

  const { data: fixtures, isLoading, error } = useFixtures(effectiveGw);

  const { fdrGwIds, fdrMap, eventNames } = useMemo(() => {
    const endGw = Math.min(Math.max(fdrUntilGw, effectiveGw), MAX_GW);
    const gwIds = Array.from(
      { length: endGw - effectiveGw + 1 },
      (_, i) => effectiveGw + i
    );
    const map = new Map<string, { difficulty: number; opponent: number }>();
    (allFixtures ?? []).forEach((f: FplFixture) => {
      if (f.team_h_difficulty != null)
        map.set(`${f.team_h}-${f.event}`, { difficulty: f.team_h_difficulty, opponent: f.team_a });
      if (f.team_a_difficulty != null)
        map.set(`${f.team_a}-${f.event}`, { difficulty: f.team_a_difficulty, opponent: f.team_h });
    });
    const names: Record<number, string> = {};
    events.forEach((ev) => {
      names[ev.id] = ev.name;
    });
    return { fdrGwIds: gwIds, fdrMap: map, eventNames: names };
  }, [allFixtures, effectiveGw, events, fdrUntilGw]);

  const handleGameweekChange = (gw: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('gw', String(gw));
      return next;
    });
  };

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    try {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
    } catch (_) {}
  };

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* FDR table */}
      <div className="rounded-xl border border-fpl-border bg-fpl-card overflow-hidden mb-8">
        <h2 className="text-lg font-semibold text-white px-4 py-3 border-b border-fpl-border">
          FDR Table
        </h2>
        <p className="text-slate-400 text-sm px-4 pb-2">
          Fixture Difficulty Rating (1 = easiest, 5 = hardest) and opponent. Use the slider to show gameweeks up to GW38.
        </p>
        <div className="px-4 pb-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <span>Show until GW</span>
            <span className="font-medium text-white tabular-nums">{fdrUntilGw}</span>
            <input
              type="range"
              min={effectiveGw}
              max={MAX_GW}
              value={Math.max(fdrUntilGw, effectiveGw)}
              onChange={(e) => setFdrUntilGw(Number(e.target.value))}
              className="w-32 sm:w-48 h-2 rounded-lg appearance-none bg-fpl-dark accent-[#f37025]"
            />
            <span className="text-slate-500 text-xs">GW{effectiveGw} – {MAX_GW}</span>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-fpl-border text-slate-400">
                <th className="px-4 py-2.5 font-medium">Team</th>
                {fdrGwIds.map((gwId) => (
                  <th key={gwId} className="px-3 py-2.5 font-medium text-center min-w-[5rem]">
                    {eventNames[gwId] ?? `GW${gwId}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((t) => (
                <tr key={t.id} className="border-b border-fpl-border/60 last:border-0">
                  <td className="px-4 py-2 text-white font-medium">{t.name}</td>
                  {fdrGwIds.map((gwId) => {
                    const data = fdrMap.get(`${t.id}-${gwId}`);
                    const style = data != null ? FDR_COLOR[data.difficulty] ?? '' : '';
                    const opponentName = data != null ? getTeamName(teams, data.opponent) : null;
                    return (
                      <td key={gwId} className="px-3 py-2 text-center align-top">
                        {data != null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded border font-medium ${style}`}
                              title={`Difficulty ${data.difficulty} vs ${opponentName}`}
                            >
                              {data.difficulty}
                            </span>
                            <span className="text-slate-400 text-xs leading-tight max-w-[4.5rem] truncate" title={opponentName ?? undefined}>
                              {opponentName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-fpl-border bg-fpl-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-xl font-semibold text-white">Fixtures</h1>
          <div className="flex items-center gap-2">
            <select
              id="fixtures-gw-select"
              value={effectiveGw}
              onChange={(e) => handleGameweekChange(Number(e.target.value))}
              className="select-arrow-white px-3 py-2 rounded-lg bg-fpl-dark border border-fpl-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-fpl-accent"
            >
              {events.length === 0 ? (
                <option value={effectiveGw}>Gameweek {effectiveGw}</option>
              ) : (
                events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))
              )}
            </select>
            <select
              id="fixtures-tz-select"
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="select-arrow-white px-3 py-2 rounded-lg bg-fpl-dark border border-fpl-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-fpl-accent"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {bootstrapError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/20 text-amber-200 text-sm">
            Failed to load game data. Please refresh the page.
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-rose-500/20 text-rose-200 text-sm">
            Failed to load fixtures. Please try again.
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-fpl-dark/60 animate-pulse"
              />
            ))}
          </div>
        )}

        {!isLoading && fixtures && (
          <>
            {fixtures.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                No fixtures for this gameweek.
              </p>
            ) : (
              <ul className="space-y-3">
                {fixtures.map((f: FplFixture) => (
                  <li
                    key={f.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 rounded-lg bg-fpl-dark/60 border border-fpl-border/60"
                  >
                    <div className="text-slate-400 text-xs sm:text-base shrink-0 w-32">
                      {formatKickoff(f.kickoff_time, timezone)}
                    </div>
                    <div className="flex-1 flex items-center justify-between sm:justify-center gap-2 sm:gap-6">
                      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end sm:justify-end">
                        <span className="text-white font-medium truncate text-right text-xs sm:text-base">
                          {getTeamName(teams, f.team_h)}
                        </span>
                        <img
                          src={`/api/badge/${f.team_h}?v=2`}
                          alt=""
                          className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <span className="text-slate-300 font-mono shrink-0 px-1">
                        {f.finished
                          ? `${f.team_h_score ?? '–'} – ${f.team_a_score ?? '–'}`
                          : 'vs'}
                      </span>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <img
                          src={`/api/badge/${f.team_a}?v=2`}
                          alt=""
                          className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <span className="text-white font-medium truncate text-xs sm:text-base">
                          {getTeamName(teams, f.team_a)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
