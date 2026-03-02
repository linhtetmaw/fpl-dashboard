import { useState, useEffect } from 'react';
import type { ClassicLeague } from '../types/fpl';
import type { BootstrapStatic } from '../types/fpl';
import LeagueTable from './LeagueTable';

interface LeagueSelectorProps {
  leagues: ClassicLeague[];
  teamId: number;
  bootstrap: BootstrapStatic | undefined;
  onTeamClick?: (entryId: number) => void;
}

export default function LeagueSelector({ leagues, teamId, bootstrap, onTeamClick }: LeagueSelectorProps) {
  const [selectedId, setSelectedId] = useState<number | null>(leagues[0]?.id ?? null);

  useEffect(() => {
    const firstId = leagues[0]?.id ?? null;
    setSelectedId((prev) => (leagues.some((l) => l.id === prev) ? prev : firstId));
  }, [leagues]);

  if (!leagues.length) {
    return (
      <div className="rounded-xl border border-fpl-border bg-fpl-card p-6 text-slate-400 text-sm">
        No classic leagues found.
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col min-h-0">
      <div>
        <label htmlFor="league-select" className="block text-slate-400 text-sm mb-1.5">League</label>
        <select
          id="league-select"
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(Number(e.target.value) || null)}
          className="w-full px-3 py-2 rounded-lg bg-fpl-dark border border-fpl-border text-slate-200 focus:outline-none focus:ring-2 focus:ring-fpl-accent text-sm"
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
          />
        </div>
      )}
    </div>
  );
}
