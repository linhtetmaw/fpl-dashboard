import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBootstrapStatic, useFixtures, useAllFixtures, getCurrentEvent } from '../hooks/useFplApi';
import type { FplElement, FplFixture, FplTeam } from '../types/fpl';
import { isFixtureLive } from '../utils/fixtureStatus';
import LiveBadge from '../components/LiveBadge';
import MatchDetails from '../components/MatchDetails';

/** Solid FDR fills, tuned for the dark surface (text colour chosen per fill for contrast). */
const FDR_FILL: Record<number, string> = {
  1: 'bg-emerald-600 text-fpl-snow',
  2: 'bg-emerald-400 text-emerald-950',
  3: 'bg-slate-600 text-slate-100',
  4: 'bg-rose-500 text-fpl-snow',
  5: 'bg-rose-800 text-rose-50',
};

const FDR_LABEL: Record<number, string> = {
  1: 'Very easy',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Very hard',
};

function avgTextColor(avg: number): string {
  if (avg <= 2.4) return 'text-emerald-400';
  if (avg <= 3.1) return 'text-slate-200';
  return 'text-rose-400';
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

const TIMEZONE_STORAGE_KEY = 'fpl_fixtures_timezone';
const MAX_GW = 38;
const FDR_RANGES = [3, 5, 8, MAX_GW] as const;

function getStoredTimezone(): string {
  try {
    return localStorage.getItem(TIMEZONE_STORAGE_KEY) ?? 'Asia/Yangon';
  } catch {
    return 'Asia/Yangon';
  }
}

function formatDay(iso: string, timeZone: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone,
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string, timeZone: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    });
  } catch {
    return '';
  }
}

function TeamBadge({ teamId, className }: { teamId: number; className: string }) {
  return (
    <img
      src={`/api/badge/${teamId}?v=2`}
      alt=""
      className={`object-contain shrink-0 ${className}`}
      referrerPolicy="no-referrer"
      onError={(e) => {
        (e.target as HTMLImageElement).style.visibility = 'hidden';
      }}
    />
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}

function FixtureRow({
  fixture: f,
  teams,
  timezone,
  elementsById,
}: {
  fixture: FplFixture;
  teams: Map<number, FplTeam>;
  timezone: string;
  elementsById: Map<number, FplElement>;
}) {
  const home = teams.get(f.team_h);
  const away = teams.get(f.team_a);
  const done = f.finished || f.finished_provisional;
  const live = isFixtureLive(f);
  const hasScore = done || (live && f.team_h_score != null && f.team_a_score != null);
  /** Started matches open to show bonus, defensive contribution and player points. */
  const expandable = Boolean(f.started || done);
  const [open, setOpen] = useState(false);

  return (
    <li>
      <div
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? open : undefined}
        onClick={expandable ? () => setOpen((o) => !o) : undefined}
        onKeyDown={expandable ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((o) => !o)) : undefined}
        title={expandable ? (open ? 'Hide match details' : 'Show bonus, defensive contribution and points') : undefined}
        className={`relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 transition-colors hover:bg-fpl-raised/40 ${
          expandable ? 'cursor-pointer' : ''
        } ${open ? 'bg-fpl-raised/40' : ''}`}
      >
        <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0">
          <span className="truncate text-right text-sm font-medium text-white">
            <span className="sm:hidden">{home?.short_name ?? home?.name}</span>
            <span className="hidden sm:inline">{home?.name ?? `Team ${f.team_h}`}</span>
          </span>
          <TeamBadge teamId={f.team_h} className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>

        <div className="flex flex-col items-center w-[4.5rem] sm:w-20">
          {hasScore ? (
            <span
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 font-display text-sm font-bold tabular-nums ${
                live ? 'bg-fpl-brand/15 text-fpl-brand ring-1 ring-fpl-brand/40' : 'bg-fpl-raised text-white ring-1 ring-fpl-border'
              }`}
            >
              {f.team_h_score}
              <span className="text-slate-500 font-normal">–</span>
              {f.team_a_score}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center rounded-md border border-fpl-border px-2.5 py-1 text-sm font-medium tabular-nums text-slate-200">
              {formatTime(f.kickoff_time, timezone)}
            </span>
          )}
          {live ? (
            <LiveBadge label={f.minutes ? `Live ${f.minutes}′` : 'Live'} className="mt-1" />
          ) : (
            hasScore && <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">FT</span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <TeamBadge teamId={f.team_a} className="h-7 w-7 sm:h-8 sm:w-8" />
          <span className="truncate text-sm font-medium text-white">
            <span className="sm:hidden">{away?.short_name ?? away?.name}</span>
            <span className="hidden sm:inline">{away?.name ?? `Team ${f.team_a}`}</span>
          </span>
        </div>
        {expandable && (
          <svg
            viewBox="0 0 24 24"
            className={`absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-transform sm:right-3 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </div>
      {open && <MatchDetails fixture={f} elementsById={elementsById} teams={teams} />}
    </li>
  );
}

interface FdrEntry {
  difficulty: number;
  opponent: number;
  home: boolean;
}

export default function FixturesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [timezone, setTimezone] = useState(() => getStoredTimezone());
  const [fdrRange, setFdrRange] = useState<number>(5);
  const [fdrSort, setFdrSort] = useState<'easiest' | 'name'>('easiest');
  const { data: bootstrap, error: bootstrapError } = useBootstrapStatic();
  const { data: allFixtures } = useAllFixtures();
  const events = bootstrap?.events ?? [];
  const teams = bootstrap?.teams ?? [];
  const defaultGw = getCurrentEvent(bootstrap ?? undefined);
  const gwParam = searchParams.get('gw');
  const gameweek = gwParam ? parseInt(gwParam, 10) : (defaultGw ?? 1);
  const effectiveGw = Number.isNaN(gameweek) || gameweek < 1 ? defaultGw ?? 1 : Math.min(gameweek, MAX_GW);

  const { data: fixtures, isLoading, error } = useFixtures(effectiveGw);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const elementsById = useMemo(() => new Map((bootstrap?.elements ?? []).map((e) => [e.id, e])), [bootstrap?.elements]);
  const shortName = (id: number) => {
    const t = teamById.get(id);
    return t?.short_name ?? t?.name.slice(0, 3).toUpperCase() ?? `T${id}`;
  };

  /** Fixtures for the selected GW, grouped by local kickoff day. */
  const fixtureDays = useMemo(() => {
    const sorted = [...(fixtures ?? [])].sort(
      (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
    );
    const groups: { day: string; items: FplFixture[] }[] = [];
    sorted.forEach((f) => {
      const day = f.kickoff_time ? formatDay(f.kickoff_time, timezone) : 'Date to be confirmed';
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(f);
      else groups.push({ day, items: [f] });
    });
    return groups;
  }, [fixtures, timezone]);

  const { fdrGwIds, fdrRows } = useMemo(() => {
    const endGw = Math.min(effectiveGw + fdrRange - 1, MAX_GW);
    const gwIds = Array.from({ length: endGw - effectiveGw + 1 }, (_, i) => effectiveGw + i);
    // A team can have 0 (blank) or 2+ (double) fixtures in one gameweek.
    const map = new Map<string, FdrEntry[]>();
    const push = (key: string, entry: FdrEntry) => {
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    };
    [...(allFixtures ?? [])]
      .sort((a, b) => (a.kickoff_time ?? '').localeCompare(b.kickoff_time ?? ''))
      .forEach((f: FplFixture) => {
        if (f.event == null) return;
        if (f.team_h_difficulty != null)
          push(`${f.team_h}-${f.event}`, { difficulty: f.team_h_difficulty, opponent: f.team_a, home: true });
        if (f.team_a_difficulty != null)
          push(`${f.team_a}-${f.event}`, { difficulty: f.team_a_difficulty, opponent: f.team_h, home: false });
      });

    const rows = teams.map((team) => {
      const cells = gwIds.map((gw) => map.get(`${team.id}-${gw}`) ?? []);
      const all = cells.flat();
      const avg = all.length ? all.reduce((s, e) => s + e.difficulty, 0) / all.length : null;
      return { team, cells, avg };
    });
    rows.sort((a, b) => {
      if (fdrSort === 'easiest' && a.avg != null && b.avg != null && a.avg !== b.avg) return a.avg - b.avg;
      return a.team.name.localeCompare(b.team.name);
    });
    return { fdrGwIds: gwIds, fdrRows: rows };
  }, [allFixtures, effectiveGw, teams, fdrRange, fdrSort]);

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

  const selectClass =
    'select-arrow-white h-9 pl-3 pr-8 rounded-lg bg-fpl-raised border border-fpl-border text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-fpl-brand/60';
  const navBtnClass =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-fpl-border bg-fpl-raised text-slate-300 transition-colors hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:pointer-events-none';

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Fixtures list */}
      <section className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-fpl-border">
          <div>
            <p className="eyebrow">Premier League</p>
            <h1 className="section-title mt-0.5">Fixtures</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={navBtnClass}
                onClick={() => handleGameweekChange(effectiveGw - 1)}
                disabled={effectiveGw <= 1}
                aria-label="Previous gameweek"
              >
                <ChevronIcon direction="left" />
              </button>
              <select
                id="fixtures-gw-select"
                value={effectiveGw}
                onChange={(e) => handleGameweekChange(Number(e.target.value))}
                className={selectClass}
                aria-label="Gameweek"
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
              <button
                type="button"
                className={navBtnClass}
                onClick={() => handleGameweekChange(effectiveGw + 1)}
                disabled={effectiveGw >= MAX_GW}
                aria-label="Next gameweek"
              >
                <ChevronIcon direction="right" />
              </button>
            </div>
            <select
              id="fixtures-tz-select"
              value={timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className={selectClass}
              aria-label="Time zone"
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
          <div className="m-4 px-4 py-3 rounded-lg bg-amber-500/15 text-amber-200 text-sm">
            Failed to load game data. Please refresh the page.
          </div>
        )}

        {error && (
          <div className="m-4 px-4 py-3 rounded-lg bg-rose-500/15 text-rose-200 text-sm">
            Failed to load fixtures. Please try again.
          </div>
        )}

        {isLoading && (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-fpl-raised/60 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && fixtures && (
          fixtures.length === 0 ? (
            <p className="text-slate-400 text-center py-10 text-sm">No fixtures for this gameweek.</p>
          ) : (
            <div>
              {fixtureDays.map((group) => (
                <div key={group.day}>
                  <h3 className="eyebrow bg-fpl-raised/50 px-4 sm:px-5 py-2 border-b border-fpl-border/60">
                    {group.day}
                  </h3>
                  <ul className="divide-y divide-fpl-border/50 border-b border-fpl-border/60 last:border-b-0">
                    {group.items.map((f) => (
                      <FixtureRow key={f.id} fixture={f} teams={teamById} timezone={timezone} elementsById={elementsById} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* FDR table */}
      <section className="card overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 px-4 sm:px-5 py-4 border-b border-fpl-border">
          <div>
            <p className="eyebrow">Fixture difficulty</p>
            <h2 className="section-title mt-0.5">FDR Table</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              From GW{effectiveGw}. Opponent in capitals is a home game, lowercase is away.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="segmented" role="group" aria-label="Gameweeks to show">
              {FDR_RANGES.map((n) => (
                <button key={n} type="button" data-active={fdrRange === n} onClick={() => setFdrRange(n)}>
                  {n === MAX_GW ? 'All' : `Next ${n}`}
                </button>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="Sort teams">
              <button type="button" data-active={fdrSort === 'easiest'} onClick={() => setFdrSort('easiest')}>
                Easiest
              </button>
              <button type="button" data-active={fdrSort === 'name'} onClick={() => setFdrSort('name')}>
                A–Z
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="sticky left-0 z-10 bg-fpl-card px-3 sm:px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] border-b border-fpl-border">
                  Team
                </th>
                <th className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] border-b border-fpl-border">
                  Avg
                </th>
                {fdrGwIds.map((gwId) => (
                  <th
                    key={gwId}
                    className="px-0.5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap border-b border-fpl-border"
                  >
                    GW{gwId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fdrRows.map(({ team, cells, avg }) => (
                <tr key={team.id} className="group">
                  <td className="sticky left-0 z-10 bg-fpl-card group-hover:bg-fpl-raised px-3 sm:px-4 py-1 border-b border-fpl-border/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamBadge teamId={team.id} className="h-5 w-5" />
                      <span className="font-medium text-white whitespace-nowrap">
                        <span className="sm:hidden">{shortName(team.id)}</span>
                        <span className="hidden sm:inline">{team.name}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-center border-b border-fpl-border/50 group-hover:bg-fpl-raised transition-colors">
                    {avg != null ? (
                      <span className={`font-display text-xs font-bold tabular-nums ${avgTextColor(avg)}`}>
                        {avg.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-slate-600">–</span>
                    )}
                  </td>
                  {cells.map((entries, i) => (
                    <td key={fdrGwIds[i]} className="p-0.5 border-b border-fpl-border/50 group-hover:bg-fpl-raised transition-colors">
                      {entries.length === 0 ? (
                        <div className="flex h-9 min-w-[3.5rem] items-center justify-center rounded-md border border-dashed border-fpl-border text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          Blank
                        </div>
                      ) : (
                        <div className="flex h-9 min-w-[3.5rem] flex-col gap-px">
                          {entries.map((e, j) => {
                            const opp = shortName(e.opponent);
                            return (
                              <div
                                key={j}
                                className={`flex flex-1 items-center justify-center rounded-md font-semibold leading-none ${
                                  entries.length > 1 ? 'text-[10px]' : 'text-xs'
                                } ${FDR_FILL[e.difficulty] ?? 'bg-fpl-raised text-slate-300'}`}
                                title={`${teamById.get(e.opponent)?.name ?? opp} (${e.home ? 'home' : 'away'}) · FDR ${e.difficulty}`}
                              >
                                {e.home ? opp.toUpperCase() : opp.toLowerCase()}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3 border-t border-fpl-border bg-fpl-raised/30">
          {[1, 2, 3, 4, 5].map((d) => (
            <span key={d} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${FDR_FILL[d]}`}>{d}</span>
              {FDR_LABEL[d]}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
