import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEntry } from '../hooks/useFplApi';
import SearchBar from '../components/SearchBar';

const DEFAULT_LEAGUE_KEY = 'fpl_default_league';
const TEAM_ID_KEY = 'fpl_team_id';

export default function TeamSearchPage() {
  const [, setSearchParams] = useSearchParams();
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const { data: entry, isLoading: entryLoading } = useEntry(selectedEntryId);

  const leagues = entry?.leagues?.classic ?? [];
  const showLeaguePicker = selectedEntryId != null && !entryLoading && entry != null;
  const loadingEntry = selectedEntryId != null && entryLoading;

  useEffect(() => {
    if (showLeaguePicker && leagues.length > 0 && selectedLeagueId == null) {
      const saved = localStorage.getItem(DEFAULT_LEAGUE_KEY);
      const savedId = saved ? parseInt(saved, 10) : null;
      const inList = savedId != null && leagues.some((l) => l.id === savedId);
      setSelectedLeagueId(inList ? savedId : leagues[0].id);
    }
  }, [showLeaguePicker, leagues, selectedLeagueId]);

  const handleTeamSelected = (entryId: number) => {
    setSelectedEntryId(entryId);
    setSelectedLeagueId(null);
  };

  const handleContinue = () => {
    const leagueId = selectedLeagueId ?? leagues[0]?.id;
    if (leagueId == null || selectedEntryId == null) return;
    localStorage.setItem(TEAM_ID_KEY, String(selectedEntryId));
    localStorage.setItem(DEFAULT_LEAGUE_KEY, String(leagueId));
    setRedirecting(true);
    setTimeout(() => {
      setSearchParams({ team: String(selectedEntryId) });
      setRedirecting(false);
    }, 1000);
  };

  const handleBack = () => {
    setSelectedEntryId(null);
    setSelectedLeagueId(null);
  };

  if (redirecting) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-24">
        <div className="rounded-xl border border-fpl-border bg-fpl-card p-8 text-center max-w-sm">
          <div className="animate-pulse text-fpl-accent text-4xl mb-4">⋯</div>
          <p className="text-slate-300 font-medium">Loading your team</p>
          <p className="text-slate-500 text-sm mt-1">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-xl font-semibold text-white mb-2">Add Your Team</h2>
        <p className="text-slate-400 text-sm mb-4">
          Search by <strong>Team/ Manager Name</strong> or <strong>Team ID</strong>, then choose your default league.
        </p>
        {loadingEntry ? (
            <div className="mt-4 py-4 text-slate-400 text-sm">Loading team and leagues…</div>
          ) : !showLeaguePicker ? (
            <div className="mt-4">
              <SearchBar
                onSearch={handleTeamSelected}
                isLoading={false}
                defaultValue={null}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-slate-300 text-sm">
                <span>Team: <strong className="text-white">{entry?.name}</strong></span>
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-fpl-accent hover:underline"
                >
                  Change team
                </button>
              </div>
              <div>
                <label htmlFor="default-league" className="block text-slate-400 text-sm mb-1.5">
                  Choose your default league
                </label>
                <select
                  id="default-league"
                  value={selectedLeagueId ?? ''}
                  onChange={(e) => setSelectedLeagueId(Number(e.target.value) || null)}
                  className="select-arrow-white w-full max-w-md px-3 py-2 rounded-lg bg-fpl-dark border border-fpl-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-fpl-accent text-sm"
                >
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
                <p className="text-slate-500 text-xs mt-1">
                  This league will be selected when you open your dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={handleContinue}
                className="px-6 py-2.5 rounded-lg bg-fpl-accent hover:bg-fpl-accent-hover text-white font-medium transition-colors"
              >
                Continue to dashboard
              </button>
            </div>
          )}
      </div>

      {!showLeaguePicker && (
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-slate-500">
          <p>Search for your team above, then choose your default league to continue.</p>
        </div>
      )}
    </>
  );
}
