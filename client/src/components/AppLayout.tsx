import { Outlet, NavLink, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

const TEAM_ID_KEY = 'fpl_team_id';

function hasStoredTeam(): boolean {
  if (typeof window === 'undefined') return false;
  const s = sessionStorage.getItem(TEAM_ID_KEY);
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isInteger(n) && n > 0;
}

export default function AppLayout() {
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const hasTeam = hasStoredTeam();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fpl'] });
  };

  const handleChangeTeam = () => {
    sessionStorage.removeItem(TEAM_ID_KEY);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-fpl-dark text-slate-200">
      <header className="sticky top-0 z-30 border-b border-fpl-border bg-fpl-card">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Row 1: Title left, Refresh + Change team right */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold" style={{ color: '#f37025' }}>
              FPL HOUSE
            </h1>
            {hasTeam && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="px-4 py-2.5 rounded-lg border border-fpl-border text-slate-300 hover:bg-fpl-card hover:border-fpl-accent/50 text-sm font-medium transition-colors"
                >
                  Refresh data
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
          {/* Row 3: Nav buttons */}
          <nav className="flex flex-wrap items-center gap-2 mt-3">
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
        </div>
      </header>
      <Outlet />
    </div>
  );
}
