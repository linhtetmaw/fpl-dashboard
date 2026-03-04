import { useState, useEffect } from 'react';
import { Outlet, NavLink, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useBootstrapStatic } from '../hooks/useFplApi';

const TEAM_ID_KEY = 'fpl_team_id';

function useNextDeadline(): Date | null {
  const { data: bootstrap } = useBootstrapStatic();
  const nextEvent = bootstrap?.events?.find((e) => e.is_next);
  const nextDeadline = nextEvent?.deadline_time;
  if (!nextDeadline) return null;
  const date = new Date(nextDeadline);
  return isNaN(date.getTime()) ? null : date;
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

export default function AppLayout() {
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const hasTeam = hasStoredTeam();
  const nextDeadline = useNextDeadline();
  const countdown = useCountdown(nextDeadline);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ['fpl'] });
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleChangeTeam = () => {
    localStorage.removeItem(TEAM_ID_KEY);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-fpl-dark text-slate-200 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-fpl-border bg-fpl-card shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Row 1: Title left, Right: buttons + deadline */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-bold" style={{ color: '#f37025' }}>
              FPL HOUSE
            </h1>
            {hasTeam && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="px-4 py-2.5 rounded-lg border border-fpl-border text-slate-300 hover:bg-fpl-card hover:border-fpl-accent/50 text-sm font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isRefreshing ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" aria-hidden />
                      <span>Refreshing…</span>
                    </>
                  ) : (
                    'Refresh data'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleChangeTeam}
                  className="px-4 py-2.5 rounded-lg border border-fpl-border text-slate-300 hover:bg-fpl-card hover:border-fpl-accent/50 text-sm font-medium transition-colors"
                >
                  Change team
                </button>
              </div>
            )}
          </div>
          {/* Row 2: Subtitle (when team selected) */}
          {hasTeam && (
            <p className="text-slate-400 text-sm mt-1">
              View Your Team Points and League Standings.
            </p>
          )}
          {/* Row 3: Nav buttons + Gameweek deadline (same level) */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <nav className="flex flex-wrap items-center gap-2">
              <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-fpl-accent text-white'
                    : 'bg-fpl-dark/60 text-slate-400 hover:text-slate-200'
                }`
              }
            >
              Your Team
            </NavLink>
            <NavLink
              to="/player-stats"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-fpl-accent text-white'
                    : 'bg-fpl-dark/60 text-slate-400 hover:text-slate-200'
                }`
              }
            >
              Player Stats
            </NavLink>
            <NavLink
              to="/fixtures"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-fpl-accent text-white'
                    : 'bg-fpl-dark/60 text-slate-400 hover:text-slate-200'
                }`
              }
            >
              Fixtures
            </NavLink>
            </nav>
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold" style={{ color: '#f37025' }}>
                Next Gameweek Deadline
              </span>
              {countdown ? (
                <span className="text-white text-sm tabular-nums mt-0.5">
                  {countdown.d} Days : {countdown.h} Hours : {countdown.m} Minutes : {countdown.s} Seconds
                </span>
              ) : (
                <span className="text-slate-500 text-sm mt-0.5">—</span>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="shrink-0 flex justify-center px-4">
        <div className="w-full max-w-6xl border-b border-fpl-border bg-fpl-card/40 py-2 flex items-center justify-center min-h-[52px] rounded-b-lg">
          <span className="text-slate-500 text-sm">Advertise here</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
      <footer className="shrink-0 border-t border-fpl-border bg-fpl-card/60 py-4">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-sm">
          © FPL HOUSE 2026. Developed by Reindeers.
        </div>
      </footer>
    </div>
  );
}
