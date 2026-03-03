import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBootstrapStatic, useFixtures, getCurrentEvent } from '../hooks/useFplApi';
import type { FplFixture, FplTeam } from '../types/fpl';

function getTeamName(teams: FplTeam[], teamId: number): string {
  const team = teams.find((t) => t.id === teamId);
  return team?.name ?? `Team ${teamId}`;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'UK (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Central Europe' },
  { value: 'America/New_York', label: 'Eastern' },
  { value: 'America/Los_Angeles', label: 'Pacific' },
  { value: 'Asia/Kolkata', label: 'India' },
  { value: 'Asia/Yangon', label: 'Myanmar' },
  { value: 'Asia/Bangkok', label: 'Indochina' },
  { value: 'Asia/Singapore', label: 'Singapore' },
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

function getStoredTimezone(): string {
  if (typeof window === 'undefined') return 'Asia/Yangon';
  return localStorage.getItem(TIMEZONE_STORAGE_KEY) ?? 'Asia/Yangon';
}

export default function FixturesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [timezone, setTimezone] = useState(() => getStoredTimezone());
  const { data: bootstrap, error: bootstrapError } = useBootstrapStatic();
  const events = bootstrap?.events ?? [];
  const teams = bootstrap?.teams ?? [];
  const defaultGw = getCurrentEvent(bootstrap ?? undefined);
  const gwParam = searchParams.get('gw');
  const gameweek = gwParam ? parseInt(gwParam, 10) : (defaultGw ?? 1);
  const effectiveGw = Number.isNaN(gameweek) || gameweek < 1 ? defaultGw ?? 1 : gameweek;

  const { data: fixtures, isLoading, error } = useFixtures(effectiveGw);

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

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="rounded-xl border border-fpl-border bg-fpl-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-xl font-semibold text-white">Fixtures</h1>
          <div className="flex items-center gap-2">
            <select
              id="fixtures-gw-select"
              value={effectiveGw}
              onChange={(e) => handleGameweekChange(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-fpl-dark border border-fpl-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-fpl-accent"
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
              className="px-3 py-2 rounded-lg bg-fpl-dark border border-fpl-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-fpl-accent"
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
                    <div className="text-slate-400 text-sm shrink-0">
                      {formatKickoff(f.kickoff_time, timezone)}
                    </div>
                    <div className="flex-1 flex items-center justify-between sm:justify-center gap-2 sm:gap-6">
                      <span className="text-white font-medium text-right sm:text-right min-w-[100px] sm:min-w-[120px]">
                        {getTeamName(teams, f.team_h)}
                      </span>
                      <span className="text-slate-300 font-mono shrink-0">
                        {f.finished
                          ? `${f.team_h_score ?? '–'} – ${f.team_a_score ?? '–'}`
                          : 'vs'}
                      </span>
                      <span className="text-white font-medium text-left sm:text-left min-w-[100px] sm:min-w-[120px]">
                        {getTeamName(teams, f.team_a)}
                      </span>
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
