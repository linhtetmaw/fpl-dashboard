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
      <div className="flex flex-1 flex-col items-center justify-center py-24 px-4">
        <div className="card p-8 text-center max-w-sm w-full">
          <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-fpl-brand border-t-transparent animate-spin" />
          <p className="text-white font-semibold">Loading your team</p>
          <p className="text-slate-500 text-sm mt-1">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <p className="eyebrow text-fpl-brand mb-3">Live Fantasy Premier League</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Your FPL team, live.
          </h1>
          <p className="text-slate-400 mt-3 sm:text-lg text-balance">
            Live points with auto-subs, mini-league tables and player stats. No login needed.
          </p>
        </div>

        <div className="card p-5 sm:p-6">
          {loadingEntry ? (
            <div className="py-6 flex items-center justify-center gap-3 text-slate-400 text-sm">
              <span className="h-4 w-4 rounded-full border-2 border-fpl-brand border-t-transparent animate-spin" />
              Loading team and leagues…
            </div>
          ) : !showLeaguePicker ? (
            <SearchBar onSearch={handleTeamSelected} isLoading={false} defaultValue={null} />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-fpl-raised/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="eyebrow">Team</p>
                  <p className="text-white font-semibold truncate">{entry?.name}</p>
                </div>
                <button type="button" onClick={handleBack} className="text-sm text-fpl-brand hover:underline">
                  Change
                </button>
              </div>
              <div>
                <label htmlFor="default-league" className="eyebrow block mb-1.5">
                  Default league
                </label>
                <select
                  id="default-league"
                  value={selectedLeagueId ?? ''}
                  onChange={(e) => setSelectedLeagueId(Number(e.target.value) || null)}
                  className="select-arrow-white input"
                >
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
                <p className="text-slate-500 text-xs mt-1.5">
                  This league opens first on your dashboard. You can switch any time.
                </p>
              </div>
              <button type="button" onClick={handleContinue} className="btn-primary w-full py-2.5">
                Continue to dashboard
              </button>
            </div>
          )}
        </div>

        {!showLeaguePicker && (
          <ul className="mt-8 grid gap-3 sm:grid-cols-3 text-sm">
            {[
              ['Live points', 'Auto-subs and captaincy applied as matches finish.'],
              ['Mini-leagues', 'Live standings, chips and captains for every rival.'],
              ['Stats & fixtures', 'Form, ownership, transfers and fixture difficulty.'],
            ].map(([title, body]) => (
              <li key={title} className="rounded-xl border border-fpl-border/70 bg-fpl-card/50 p-4">
                <p className="font-semibold text-slate-100">{title}</p>
                <p className="text-slate-500 mt-1">{body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
