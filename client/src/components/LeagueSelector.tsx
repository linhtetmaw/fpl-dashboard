import { useState, useEffect } from 'react';
import type { ClassicLeague } from '../types/fpl';
import type { BootstrapStatic } from '../types/fpl';
import LeagueTable from './LeagueTable';

interface LeagueSelectorProps {
  leagues: ClassicLeague[];
  teamId: number;
  bootstrap: BootstrapStatic | undefined;
  onTeamClick?: (entryId: number) => void;
  /** Default league to select (e.g. from session). */
  initialLeagueId?: number | null;
  /** Current gameweek (for fetching chip badges for all teams in standings). */
  gameweek: number;
  /** Current user's chip this GW (fallback badge when API doesn't return chips). */
  currentUserChip?: string | null;
}

/** The league being viewed, kept for this tab: tapping a team in the table loads that team (the page rebuilds this
 * picker), and the shared mini-league should stay selected rather than jump to the new team's first league. */
const VIEWING_LEAGUE_KEY = 'fpl_viewing_league';

function getViewingLeagueId(): number | null {
  try {
    const n = parseInt(sessionStorage.getItem(VIEWING_LEAGUE_KEY) ?? '', 10);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** First of the candidates this team is in, else its first league. */
function pickLeague(leagues: ClassicLeague[], ...candidates: (number | null | undefined)[]): number | null {
  for (const id of candidates) if (id != null && leagues.some((l) => l.id === id)) return id;
  return leagues[0]?.id ?? null;
}

export default function LeagueSelector({ leagues, teamId, bootstrap, onTeamClick, initialLeagueId, gameweek, currentUserChip }: LeagueSelectorProps) {
  const [selectedId, setSelectedId] = useState<number | null>(() =>
    pickLeague(leagues, getViewingLeagueId(), initialLeagueId)
  );

  useEffect(() => {
    if (!leagues.length) return;
    setSelectedId((prev) => pickLeague(leagues, prev, getViewingLeagueId(), initialLeagueId));
  }, [leagues, initialLeagueId]);

  useEffect(() => {
    if (selectedId == null) return;
    try {
      sessionStorage.setItem(VIEWING_LEAGUE_KEY, String(selectedId));
    } catch {
      // Private mode etc.: the league just isn't remembered.
    }
  }, [selectedId]);

  if (!leagues.length) {
    return (
      <div className="card p-6 text-slate-400 text-sm">
        No classic leagues found.
      </div>
    );
  }

  return (
    <div className="space-y-3 h-full flex flex-col min-h-0">
      <div>
        <label htmlFor="league-select" className="sr-only">League</label>
        <select
          id="league-select"
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(Number(e.target.value) || null)}
          className="select-arrow-white input font-medium"
        >
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      </div>
      {selectedId != null && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <LeagueTable
            leagueId={selectedId}
            teamId={teamId}
            bootstrap={bootstrap}
            onTeamClick={onTeamClick}
            gameweek={gameweek}
            currentUserChip={currentUserChip}
            userRank={leagues.find((l) => l.id === selectedId)?.entry_rank ?? null}
            rankCount={leagues.find((l) => l.id === selectedId)?.rank_count ?? null}
          />
        </div>
      )}
    </div>
  );
}
