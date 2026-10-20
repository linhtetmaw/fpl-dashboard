import { useState, FormEvent } from 'react';
import { searchTeams, searchByLeagueAndTeam } from '../api/fpl';
import type { StandingEntry } from '../types/fpl';
import { SearchIcon } from './icons';

/** Search result: from index (no league info) or from search-by-league (with league_id/league_name). */
type SearchResult = StandingEntry & { league_id?: number; league_name?: string };

interface SearchBarProps {
  onSearch: (teamId: number) => void;
  isLoading?: boolean;
  defaultValue?: number | null;
}

export default function SearchBar({
  onSearch,
  isLoading = false,
  defaultValue,
}: SearchBarProps) {
  const [mode, setMode] = useState<'league' | 'id'>('league');
  const [idValue, setIdValue] = useState(defaultValue?.toString() ?? '');
  const [teamName, setTeamName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [teamIdImgError, setTeamIdImgError] = useState(false);

  const handleSubmitId = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSearchResults(null);
    const id = idValue.trim();
    if (!id) {
      setError('Enter a team ID');
      return;
    }
    const num = parseInt(id, 10);
    if (Number.isNaN(num) || num < 1) {
      setError('Team ID must be a positive number');
      return;
    }
    onSearch(num);
  };

  const handleSubmitLeague = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSearchResults(null);
    const team = teamName.trim();
    if (!team) {
      setError('Enter a team name');
      return;
    }
    setSearching(true);
    try {
      // Option C: try index first (instant if seeded), then fall back to live search-by-league
      let matches: SearchResult[] = await searchTeams(team, managerName.trim() || undefined);
      if (matches.length === 0) {
        matches = await searchByLeagueAndTeam(team, {
          managerName: managerName.trim() || undefined,
        });
      }
      setSearchResults(matches);
      if (matches.length === 0) {
        setError('No teams found. Check team/ manager name or search by team ID.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (entryId: number) => {
    setSearchResults(null);
    onSearch(entryId);
  };

  return (
    <div className="space-y-4">
      <div className="segmented w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none" role="tablist">
        <button
          type="button"
          onClick={() => {
            setMode('league');
            setError(null);
            setSearchResults(null);
          }}
          data-active={mode === 'league'}
          role="tab"
          aria-selected={mode === 'league'}
        >
          Team / manager name
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('id');
            setError(null);
            setSearchResults(null);
          }}
          data-active={mode === 'id'}
          role="tab"
          aria-selected={mode === 'id'}
        >
          Team ID
        </button>
      </div>

      {mode === 'league' ? (
        <>
          <form onSubmit={handleSubmitLeague} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="search-team" className="eyebrow block mb-1.5">Team name</label>
                <input
                  id="search-team"
                  type="text"
                  placeholder="e.g. My FPL Team"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value);
                    setError(null);
                  }}
                  className="input"
                  disabled={searching}
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="search-manager" className="eyebrow block mb-1.5">Manager name <span className="normal-case tracking-normal font-normal">(optional)</span></label>
                <input
                  id="search-manager"
                  type="text"
                  placeholder="e.g. John Smith"
                  value={managerName}
                  onChange={(e) => {
                    setManagerName(e.target.value);
                    setError(null);
                  }}
                  className="input"
                  disabled={searching}
                />
              </div>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={searching || !teamName.trim()}
              className="btn-primary w-full sm:w-auto px-6 py-2.5"
            >
              <SearchIcon className="h-4 w-4" />
              {searching ? 'Searching…' : 'Find my team'}
            </button>
          </form>

          {searchResults !== null && searchResults.length > 0 && (
            <div className="rounded-xl border border-fpl-border bg-fpl-raised/50 overflow-hidden">
              <p className="eyebrow px-3 py-2.5 border-b border-fpl-border">
                {searchResults.length} team{searchResults.length !== 1 ? 's' : ''} found — click to view
              </p>
              <ul className="max-h-64 overflow-y-auto">
                {searchResults.map((r) => (
                  <li key={r.entry}>
                    <button
                      type="button"
                      onClick={() => handleSelectResult(r.entry)}
                      className="w-full px-3 py-2.5 text-left hover:bg-white/[0.04] border-b border-fpl-border/50 last:border-b-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 transition-colors"
                    >
                      <span className="text-slate-200 font-medium truncate">{r.entry_name}</span>
                      <span className="text-slate-500 text-xs shrink-0">
                        {r.player_name}
                        {r.league_name != null && r.league_name ? ` · ${r.league_name}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-fpl-border bg-fpl-raised/40 p-4 text-slate-400 text-sm">
            <p className="font-medium text-slate-300 mb-1">How to find your Team ID</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Go to <a href="https://fantasy.premierleague.com" target="_blank" rel="noopener noreferrer" className="text-fpl-brand hover:underline">fantasy.premierleague.com</a> and log in.</li>
              <li>Choose "Points".</li>
              <li>Look at the browser address bar. The URL will look like <code className="bg-fpl-dark px-1 rounded">…/entry/<strong>123456</strong>/event/…</code> — the number after <code className="bg-fpl-dark px-1 rounded">entry/</code> is your Team ID.</li>
            </ol>
            {/* Screenshot: add client/public/how-to-find-team-id.png (browser address bar showing entry/123456) */}
            <figure className="mt-3">
              <div className="w-full max-w-md rounded border border-fpl-border bg-fpl-dark/50 min-h-[120px] flex items-center justify-center overflow-hidden">
                {teamIdImgError ? (
                  <span className="text-slate-500 text-xs p-4 text-center">
                    Add screenshot: <code className="bg-fpl-dark px-1 rounded">client/public/how-to-find-team-id.png</code>
                  </span>
                ) : (
                  <img
                    src="/how-to-find-team-id.png"
                    alt="Screenshot showing where to find Team ID in the FPL website address bar"
                    className="w-full object-contain"
                    onError={() => setTeamIdImgError(true)}
                  />
                )}
              </div>
              <figcaption className="text-slate-500 text-xs mt-1">
                The number after <code className="bg-fpl-dark px-1 rounded">entry/</code> in the address bar is your Team ID.
              </figcaption>
            </figure>
          </div>
          <form onSubmit={handleSubmitId} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 flex flex-col gap-1">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter FPL Team ID (e.g. 12345)"
                value={idValue}
                onChange={(e) => {
                  setIdValue(e.target.value);
                  setError(null);
                }}
                className="input"
                disabled={isLoading}
              />
              {error && <p className="text-sm text-rose-400">{error}</p>}
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary px-6 py-2.5"
            >
              {isLoading ? 'Loading…' : 'View team'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
