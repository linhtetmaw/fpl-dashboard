import { useSearchParams } from 'react-router-dom';
import { useMemo, useRef, useEffect, useState } from 'react';
import { useBootstrapStatic, useEntry, useTeamPicks, useEventLive, useEntryHistory, getCurrentEvent, computeTeamPointsSummary } from '../hooks/useFplApi';
import TeamSearchPage from './TeamSearchPage';
import TeamSummary from '../components/TeamSummary';
import PitchView from '../components/PitchView';
import PlayersTable from '../components/PlayersTable';
import LeagueSelector from '../components/LeagueSelector';

const DEFAULT_LEAGUE_KEY = 'fpl_default_league';
const TEAM_ID_KEY = 'fpl_team_id';

function getDefaultLeagueId(): number | null {
  if (typeof window === 'undefined') return null;
  const s = localStorage.getItem(DEFAULT_LEAGUE_KEY);
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getStoredTeamId(): number | null {
  if (typeof window === 'undefined') return null;
  const s = localStorage.getItem(TEAM_ID_KEY);
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const teamFromStorage = getStoredTeamId();
  const teamIdParam = searchParams.get('team');
  const teamIdFromUrl = teamIdParam ? parseInt(teamIdParam, 10) : null;
  const validTeamId = (teamFromStorage ?? teamIdFromUrl) ?? null;
  const resolvedTeamId = validTeamId != null && !Number.isNaN(validTeamId) && validTeamId > 0 ? validTeamId : null;
  const defaultLeagueId = getDefaultLeagueId();

  useEffect(() => {
    if (resolvedTeamId != null && teamIdParam != null && parseInt(teamIdParam, 10) === resolvedTeamId) {
      localStorage.setItem(TEAM_ID_KEY, String(resolvedTeamId));
    }
  }, [resolvedTeamId, teamIdParam]);

  const { data: bootstrap, error: bootstrapError } = useBootstrapStatic();
  const { data: entry, isLoading: entryLoading, error: entryError } = useEntry(resolvedTeamId);
  const defaultGw = getCurrentEvent(bootstrap ?? undefined);
  const gwParam = searchParams.get('gw');
  const gameweek = gwParam ? parseInt(gwParam, 10) : (defaultGw ?? undefined);
  const effectiveGw = gameweek ?? defaultGw ?? 1;

  const { data: picks, isLoading: picksLoading } = useTeamPicks(resolvedTeamId, effectiveGw);
  const { data: live, isLoading: liveLoading } = useEventLive(effectiveGw);
  const { data: entryHistory } = useEntryHistory(resolvedTeamId);

  const teamSummary = useMemo(() => {
    if (!resolvedTeamId || !bootstrap || !picks || !live) return null;
    return computeTeamPointsSummary(
      resolvedTeamId,
      effectiveGw,
      bootstrap,
      picks,
      live,
      entry?.name ?? null
    );
  }, [resolvedTeamId, effectiveGw, bootstrap, picks, live, entry?.name]);

  const teamValue = useMemo(() => {
    const cur = entryHistory?.current?.find((c) => c.event === effectiveGw);
    return cur && typeof cur.value === 'number' ? cur.value : null;
  }, [entryHistory, effectiveGw]);

  const handleSearch = (id: number) => {
    localStorage.setItem(TEAM_ID_KEY, String(id));
    setSearchParams({ team: String(id) });
  };

  const handleGameweekChange = (gw: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('gw', String(gw));
      return next;
    });
  };

  const events = bootstrap?.events ?? [];
  const entryNotFound = resolvedTeamId != null && !entryLoading && (entryError != null || !entry);

  const pitchWrapRef = useRef<HTMLDivElement>(null);
  const [pitchHeight, setPitchHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!pitchWrapRef.current) return;
    const el = pitchWrapRef.current;
    const ro = new ResizeObserver(() => setPitchHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [teamSummary]);

  if (!resolvedTeamId) {
    return <TeamSearchPage />;
  }

  return (
    <>
      {entryNotFound && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="px-4 py-2 rounded-lg bg-rose-500/20 text-rose-300 text-sm">
            No team found for ID {resolvedTeamId}. Check the ID and try again.
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        {bootstrapError && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-amber-500/20 text-amber-200 text-sm">
            Failed to load game data. Please refresh the page.
          </div>
        )}

        {entry && (
          <>
            <TeamSummary
              teamName={entry.name}
              managerName={`${entry.player_first_name} ${entry.player_last_name}`}
              teamId={entry.id}
              gameweek={effectiveGw}
              events={events}
              onGameweekChange={handleGameweekChange}
              summary={teamSummary}
              gwNetTotal={teamSummary ? (teamSummary.chip === 'bboost' ? teamSummary.total_points : teamSummary.starting_points) : null}
              teamValue={teamValue}
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
                      className="lg:w-[480px] lg:flex-shrink-0 lg:min-h-0 lg:overflow-hidden"
                      style={pitchHeight != null ? { height: pitchHeight, maxHeight: '85vh' } : undefined}
                    >
                      <h2 className="text-lg font-semibold text-white mb-3">Leagues</h2>
                      <LeagueSelector
                        leagues={entry.leagues?.classic ?? []}
                        teamId={resolvedTeamId}
                        bootstrap={bootstrap ?? undefined}
                        onTeamClick={handleSearch}
                        initialLeagueId={defaultLeagueId}
                        gameweek={effectiveGw}
                        currentUserChip={teamSummary?.chip ?? null}
                      />
                    </div>
                  </div>
                </section>
                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-white mb-3">Player breakdown</h2>
                  <PlayersTable players={teamSummary.players} />
                </section>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
