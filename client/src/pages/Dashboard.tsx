import { useSearchParams } from 'react-router-dom';
import { useMemo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useBootstrapStatic, useEntry, useTeamPicks, useEventLive, useEntryHistory, useFixtures, getCurrentEvent, computeTeamPointsSummary } from '../hooks/useFplApi';
import TeamSearchPage from './TeamSearchPage';
import TeamSummary from '../components/TeamSummary';
import PitchView from '../components/PitchView';
import TransferSuggestions from '../components/TransferSuggestions';
import { anyFixtureLive } from '../utils/fixtureStatus';
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
  const parsedUrlTeamId = teamIdParam ? parseInt(teamIdParam, 10) : NaN;
  const teamIdFromUrl = Number.isInteger(parsedUrlTeamId) && parsedUrlTeamId > 0 ? parsedUrlTeamId : null;
  // A ?team= link (e.g. shared by someone) takes priority over the team remembered in this browser.
  const resolvedTeamId = teamIdFromUrl ?? teamFromStorage;
  const defaultLeagueId = getDefaultLeagueId();

  useEffect(() => {
    // Remember a team from the URL only if none is saved yet, so opening a shared link doesn't replace the visitor's own team.
    if (teamIdFromUrl != null && teamFromStorage == null) {
      localStorage.setItem(TEAM_ID_KEY, String(teamIdFromUrl));
    }
  }, [teamIdFromUrl, teamFromStorage]);

  const { data: bootstrap, error: bootstrapError } = useBootstrapStatic();
  const { data: entry, isLoading: entryLoading, error: entryError } = useEntry(resolvedTeamId);
  const defaultGw = getCurrentEvent(bootstrap ?? undefined);
  const gwParam = searchParams.get('gw');
  const gameweek = gwParam ? parseInt(gwParam, 10) : (defaultGw ?? undefined);
  const effectiveGw = gameweek ?? defaultGw ?? 1;

  const { data: picks, isLoading: picksLoading } = useTeamPicks(resolvedTeamId, effectiveGw);
  const { data: fixtures, isLoading: fixturesLoading } = useFixtures(effectiveGw);
  // While a match in this gameweek is on, live points re-fetch every minute (fixtures do the same, see useFixtures).
  const { data: live, isLoading: liveLoading } = useEventLive(effectiveGw, anyFixtureLive(fixtures));
  const { data: entryHistory } = useEntryHistory(resolvedTeamId);

  const teamSummary = useMemo(() => {
    if (!resolvedTeamId || !bootstrap || !picks || !live || fixturesLoading) return null;
    return computeTeamPointsSummary(
      resolvedTeamId,
      effectiveGw,
      bootstrap,
      picks,
      live,
      fixtures ?? null,
      entry?.name ?? null
    );
  }, [resolvedTeamId, effectiveGw, bootstrap, picks, live, fixtures, fixturesLoading, entry?.name]);

  const teamValue = useMemo(() => {
    const cur = entryHistory?.current?.find((c) => c.event === effectiveGw);
    return cur && typeof cur.value === 'number' ? cur.value : null;
  }, [entryHistory, effectiveGw]);

  const transfersCost = useMemo(() => {
    const cur = entryHistory?.current?.find((c) => c.event === effectiveGw);
    const raw = cur?.event_transfers_cost;
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [entryHistory, effectiveGw]);

  const gwNetTotal = useMemo(() => {
    if (!teamSummary) return null;
    const base = teamSummary.chip === 'bboost' ? teamSummary.total_points : teamSummary.starting_points;
    const cost = transfersCost ?? 0;
    return Math.max(0, base - cost);
  }, [teamSummary, transfersCost]);

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

  const deadlinePassedForCurrentGw = useMemo(() => {
    const ev = bootstrap?.events?.find((e) => e.is_next || e.is_current);
    if (!ev?.deadline_time) return false;
    return new Date(ev.deadline_time) < new Date();
  }, [bootstrap?.events]);

  const dataUpdatingAfterDeadline =
    deadlinePassedForCurrentGw &&
    (bootstrapError || entryError || entryLoading || picksLoading || liveLoading || (entry != null && teamSummary == null));

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
          <div className="px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-sm">
            No team found for ID {resolvedTeamId}. Check the ID and try again.
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">
        {dataUpdatingAfterDeadline && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
            Deadline passed and game is currently updating. Please wait.
          </div>
        )}
        {bootstrapError && !dataUpdatingAfterDeadline && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
            Failed to load game data. Please refresh the page.
          </div>
        )}

        {entry && (
          <>
            {teamSummary ? (
              <>
                <TeamSummary
                  teamName={entry.name}
                  managerName={`${entry.player_first_name} ${entry.player_last_name}`}
                  teamId={entry.id}
                  gameweek={effectiveGw}
                  events={events}
                  onGameweekChange={handleGameweekChange}
                  summary={teamSummary}
                  gwNetTotal={gwNetTotal}
                  transfersCost={transfersCost}
                  teamValue={teamValue}
                  isLoading={picksLoading || liveLoading}
                  showShLeagueBadge={entry.leagues?.classic?.some((l) => l.id === 699005)}
                />
                <section className="mt-6 flex flex-col lg:flex-row gap-6 items-stretch">
                  <div className="min-w-0 lg:flex-1 flex flex-col">
                    <div ref={pitchWrapRef}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                        <h2 className="section-title">Pitch view</h2>
                        <span className="text-slate-500 text-xs">Tap a player for their profile</span>
                      </div>
                      <PitchView
                        players={teamSummary.players}
                        bootstrap={bootstrap ?? undefined}
                        effectivePitchPlayers={teamSummary.effectivePitchPlayers}
                        effectiveBench={teamSummary.effectiveBench}
                        replacedStarters={teamSummary.replacedStarters}
                        fixtures={fixtures ?? null}
                      />
                    </div>
                  </div>
                  <div
                    // Match the pitch column's height on desktop; on phones use a fixed, scrollable panel.
                    className="lg:w-[480px] lg:flex-shrink-0 flex flex-col min-h-0 h-[600px] lg:h-[var(--league-panel-h)]"
                    style={
                      pitchHeight != null
                        ? ({ '--league-panel-h': `${pitchHeight}px` } as CSSProperties)
                        : undefined
                    }
                  >
                    <h2 className="section-title mb-3 shrink-0">Leagues</h2>
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <LeagueSelector
                      leagues={entry.leagues?.classic ?? []}
                      teamId={resolvedTeamId}
                      bootstrap={bootstrap ?? undefined}
                      onTeamClick={handleSearch}
                      initialLeagueId={defaultLeagueId}
                      gameweek={effectiveGw}
                      currentUserChip={teamSummary.chip ?? null}
                    />
                    </div>
                  </div>
                </section>
                <div className="mt-6">
                  <TransferSuggestions teamId={entry.id} />
                </div>
                <section className="mt-6">
                  <h2 className="section-title mb-3">Player breakdown</h2>
                  <PlayersTable players={teamSummary.players} />
                </section>
              </>
            ) : (
              <>
                <TeamSummary
                  teamName={entry.name}
                  managerName={`${entry.player_first_name} ${entry.player_last_name}`}
                  teamId={entry.id}
                  gameweek={effectiveGw}
                  events={events}
                  onGameweekChange={handleGameweekChange}
                  summary={null}
                  gwNetTotal={null}
                  transfersCost={transfersCost}
                  teamValue={teamValue}
                  isLoading={picksLoading || liveLoading}
                  showShLeagueBadge={entry.leagues?.classic?.some((l) => l.id === 699005)}
                />
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
