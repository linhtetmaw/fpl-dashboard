import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useBootstrapStatic } from '../hooks/useFplApi';
import { ClockIcon, LogoMark, MoonIcon, SunIcon, SwapIcon } from './icons';
import { getTheme, setTheme, type Theme } from '../theme';
import SEO_ROUTES from '../seo-routes.json';
import PlayerCardProvider from './PlayerCardProvider';
import InstallButton from './InstallButton';
import PageLoader from './PageLoader';

const TEAM_ID_KEY = 'fpl_team_id';

const NAV_ITEMS = [
  { to: '/', label: 'Your Team', end: true },
  { to: '/player-stats', label: 'Player Stats' },
  { to: '/player-news', label: 'Player News' },
  { to: '/fixtures', label: 'Fixtures' },
  { to: '/squad-planner', label: 'Squad Planner' },
  { to: '/opinions', label: 'Opinions' },
];

function useNextDeadline(): { date: Date; name: string } | null {
  const { data: bootstrap } = useBootstrapStatic();
  const nextEvent = bootstrap?.events?.find((e) => e.is_next);
  if (!nextEvent?.deadline_time) return null;
  const date = new Date(nextEvent.deadline_time);
  return isNaN(date.getTime()) ? null : { date, name: nextEvent.name };
}

function useCountdown(deadline: Date | null): { d: number; h: number; m: number; s: number } | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline || deadline.getTime() <= now) return null;
  const diff = Math.max(0, Math.floor((deadline.getTime() - now) / 1000));
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return { d, h, m, s };
}

function hasStoredTeam(): boolean {
  if (typeof window === 'undefined') return false;
  const s = localStorage.getItem(TEAM_ID_KEY);
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isInteger(n) && n > 0;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Countdown as compact segments, e.g. 11d 01h 18m 29s. */
function CountdownDigits({ countdown }: { countdown: { d: number; h: number; m: number; s: number } }) {
  const parts: [number, string][] = [
    [countdown.d, 'd'],
    [countdown.h, 'h'],
    [countdown.m, 'm'],
    [countdown.s, 's'],
  ];
  return (
    <span className="tabular-nums font-semibold text-white">
      {parts.map(([value, unit], i) => (
        <span key={unit}>
          {i === 0 ? value : pad(value)}
          <span className="text-slate-500 font-medium">{unit}</span>
          {i < parts.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

function DeadlineChip({ className = '' }: { className?: string }) {
  const deadline = useNextDeadline();
  const countdown = useCountdown(deadline?.date ?? null);
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-fpl-border bg-fpl-raised/70 px-3 py-1.5 text-xs sm:text-sm ${className}`}
      title={deadline ? `${deadline.name} deadline: ${deadline.date.toLocaleString()}` : undefined}
    >
      <ClockIcon className="h-4 w-4 text-fpl-brand shrink-0" />
      <span className="text-slate-400">{deadline ? `${deadline.name} deadline` : 'Next deadline'}</span>
      {countdown ? <CountdownDigits countdown={countdown} /> : <span className="text-slate-500">TBC</span>}
    </div>
  );
}

const PAGE_TITLES: Record<string, { title: string }> = SEO_ROUTES;

export default function AppLayout() {
  const location = useLocation();
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const pageRef = useRef<HTMLDivElement>(null);
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  // Browser tab (and Google Analytics page) title per section; the server sets the same on first load (server/seo.js).
  useEffect(() => {
    const p = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : location.pathname;
    document.title = PAGE_TITLES[p]?.title ?? 'Page not found | FPL House';
  }, [location.pathname]);
  const [, setSearchParams] = useSearchParams();
  const hasTeam = hasStoredTeam();

  const handleChangeTeam = () => {
    localStorage.removeItem(TEAM_ID_KEY);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen text-slate-200 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-fpl-border bg-fpl-dark/85 backdrop-blur supports-[backdrop-filter]:bg-fpl-dark/70">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-8 min-w-0">
              <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="FPL House home">
                <LogoMark className="h-8 w-8" />
                <span className="font-display text-xl tracking-[-0.04em] text-white">
                  <span className="font-bold">FPL</span><span className="font-normal text-fpl-brand">house</span>
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-1 h-16" aria-label="Main">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `relative flex items-center h-full px-3 text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-white after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-fpl-brand'
                          : 'text-slate-400 hover:text-slate-100'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <DeadlineChip className="hidden lg:inline-flex" />
              <InstallButton />
              <button
                type="button"
                onClick={toggleTheme}
                className="btn-ghost px-2.5"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </button>
              {hasTeam && (
                <>
                  <button type="button" onClick={handleChangeTeam} className="btn-ghost px-2.5 sm:px-3" title="Change team">
                    <SwapIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Change team</span>
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Mobile nav: horizontally scrollable tabs */}
          <nav className="md:hidden -mx-4 px-4 flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none]" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-fpl-accent text-fpl-purple font-semibold' : 'text-slate-400 hover:text-slate-100 bg-fpl-raised/60'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 pt-4 space-y-3">
        {/* Deadline shown here below lg; in the header on large screens. */}
        <DeadlineChip className="lg:hidden w-full justify-center" />
        <div className="flex items-center justify-center rounded-xl border border-dashed border-fpl-border/80 bg-fpl-card/40 h-12 text-xs text-slate-500">
          <span className="eyebrow mr-2">Ad</span>
          Advertise here
        </div>
      </div>

      {/* The player card provider sits outside the fading wrapper so its pop-up is never positioned mid-animation.
          Keyed by path so only switching sections replays the fade (not ?gw= / ?team= changes). */}
      <PlayerCardProvider>
        <div key={location.pathname} ref={pageRef} className="page-enter flex-1 min-h-0">
          <Outlet />
        </div>
      </PlayerCardProvider>
      {/* First visit to each page: the animated logo until its data and on-screen images have loaded. */}
      <PageLoader key={location.pathname} path={location.pathname} contentRef={pageRef} />

      <footer className="shrink-0 border-t border-fpl-border mt-8">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <LogoMark className="h-5 w-5" />
            <span>© {new Date().getFullYear()} FPL House · Developed by Reindeers</span>
          </div>
          <p className="text-center sm:text-right">
            Data from the official Fantasy Premier League API. Not affiliated with the Premier League.
          </p>
        </div>
      </footer>
    </div>
  );
}
