import { useSearchParams } from 'react-router-dom';
import { useMemo, useRef, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBootstrapStatic, useEntry, useTeamPicks, useEventLive, getCurrentEvent, computeTeamPointsSummary } from '../hooks/useFplApi';
import SearchBar from '../components/SearchBar';
import PlayersNews from '../components/PlayersNews';
import TeamSummary from '../components/TeamSummary';
import PitchView from '../components/PitchView';
import PlayersTable from '../components/PlayersTable';
import LeagueSelector from '../components/LeagueSelector';

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const teamIdParam = searchParams.get('team');
  const teamId = teamIdParam ? parseInt(teamIdParam, 10) : null;
  const validTeamId = teamId != null && !Number.isNaN(teamId) && teamId > 0 ? teamId : null;

  const { data: bootstrap, isLoading: bootstrapLoading, error: bootstrapError, dataUpdatedAt: bootstrapUpdated } = useBootstrapStatic();
  const { data: entry, isLoading: entryLoading, error: entryError } = useEntry(validTeamId);
  const defaultGw = getCurrentEvent(bootstrap ?? undefined);
  const gwParam = searchParams.get('gw');
  const gameweek = gwParam ? parseInt(gwParam, 10) : (defaultGw ?? undefined);
  const effectiveGw = gameweek ?? defaultGw ?? 1;

  const { data: picks, isLoading: picksLoading } = useTeamPicks(validTeamId, effectiveGw);
  const { data: live, isLoading: liveLoading } = useEventLive(effectiveGw);

  const teamSummary = useMemo(() => {
    if (!validTeamId || !bootstrap || !picks || !live) return null;
    return computeTeamPointsSummary(
      validTeamId,
      effectiveGw,
      bootstrap,
      picks,
      live,
      entry?.name ?? null
    );
  }, [validTeamId, effectiveGw, bootstrap, picks, live, entry?.name]);

  const handleSearch = (id: number) => {
    setSearchParams({ team: String(id) });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fpl'] });
  };

  const handleGameweekChange = (gw: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('gw', String(gw));
      return next;
    });
  };

  const events = bootstrap?.events ?? [];
  const entryNotFound = validTeamId != null && !entryLoading && (entryError != null || !entry);

  const pitchWrapRef = useRef<HTMLDivElement>(null);
  const [pitchHeight, setPitchHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!pitchWrapRef.current) return;
    const el = pitchWrapRef.current;
    const ro = new ResizeObserver(() => setPitchHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [teamSummary]);

  return (
    <div className="min-h-screen bg-fpl-dark text-slate-200">
      <header className="border-b border-fpl-border bg-fpl-card/50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#f37025' }}>FPL HOUSE</h1>
          <p className="text-slate-400 text-sm">
            Search by <strong>League + Team name</strong> or <strong>Team ID</strong> to view your team and leagues.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <SearchBar
                onSearch={handleSearch}
                isLoading={entryLoading && validTeamId != null}
                defaultValue={validTeamId}
              />
            </div>
            {validTeamId != null && (
              <button
                type="button"
                onClick={handleRefresh}
                className="px-4 py-2.5 rounded-lg border border-fpl-border text-slate-300 hover:bg-fpl-card hover:border-fpl-accent/50 text-sm font-medium transition-colors"
              >
                Refresh data
              </button>
            )}
          </div>
          {validTeamId != null && bootstrapUpdated != null && (
            <p className="mt-2 text-slate-500 text-xs">
              Search Your Team.
            </p>
          )}
          {entryNotFound && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-rose-500/20 text-rose-300 text-sm">
              No team found for ID {validTeamId}. Check the ID and try again.
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {bootstrapError && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-amber-500/20 text-amber-200 text-sm">
            Failed to load game data. Please refresh the page.
          </div>
        )}

        {!validTeamId && (
          <>
            <PlayersNews bootstrap={bootstrap ?? undefined} isLoading={bootstrapLoading} />
            <div className="text-center py-16 text-slate-500 mt-6">
              {bootstrapLoading ? (
                <p>Loading…</p>
              ) : (
                <p>Enter your FPL Team ID above to get started.</p>
              )}
            </div>
          </>
        )}

        {validTeamId && entry && (
          <>
            <TeamSummary
              teamName={entry.name}
              managerName={`${entry.player_first_name} ${entry.player_last_name}`}
              teamId={entry.id}
              gameweek={effectiveGw}
              events={events}
              onGameweekChange={handleGameweekChange}
              summary={teamSummary}
              isLoading={picksLoading || liveLoading}
            />

            {teamSummary && (
              <>
                <section className="mt-8">
                  <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                    <div ref={pitchWrapRef} className="min-w-0 lg:flex-1">
                      <h2 className="text-lg font-semibold text-white mb-3">Pitch view</h2>
                      <PitchView players={teamSummary.players} bootstrap={bootstrap ?? undefined} />
                    </div>
                    <div
                      className="lg:w-[420px] lg:flex-shrink-0 lg:min-h-0 lg:overflow-hidden"
                      style={pitchHeight != null ? { height: pitchHeight, maxHeight: '70vh' } : undefined}
                    >
                      <h2 className="text-lg font-semibold text-white mb-3">Leagues</h2>
                      <LeagueSelector
                        leagues={entry.leagues?.classic ?? []}
                        teamId={validTeamId}
                        bootstrap={bootstrap ?? undefined}
                        onTeamClick={handleSearch}
                      />
                    </div>
                  </div>
                </section>
                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-white mb-3">Player breakdown</h2>
                  <PlayersTable players={teamSummary.players} />
                </section>
                <section className="mt-8 h-[50vh] min-h-[280px] max-h-[520px] flex flex-col">
                  <PlayersNews bootstrap={bootstrap ?? undefined} isLoading={bootstrapLoading} />
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
