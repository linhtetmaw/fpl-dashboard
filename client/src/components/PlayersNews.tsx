import type { BootstrapStatic, FplElement } from '../types/fpl';

const POS_LABELS: Record<number, string> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

function statusLabel(status: string | undefined): string {
  switch (status) {
    case 's':
      return 'Suspended';
    case 'i':
      return 'Injured';
    case 'd':
      return 'Doubtful';
    case 'u':
    default:
      return 'Update';
  }
}

function statusClass(status: string | undefined): string {
  switch (status) {
    case 's':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'i':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'd':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  }
}

interface PlayersNewsProps {
  bootstrap: BootstrapStatic | undefined;
  isLoading?: boolean;
}

export default function PlayersNews({ bootstrap, isLoading }: PlayersNewsProps) {
  if (isLoading || !bootstrap) {
    return (
      <div className="h-full rounded-xl border border-fpl-border bg-fpl-card overflow-hidden flex flex-col justify-center min-h-[200px]">
        <h3 className="text-lg font-semibold text-white px-4 py-3 border-b border-fpl-border bg-fpl-card/80">Player News</h3>
        <div className="p-4">
          <p className="text-slate-500 text-sm">Loading news…</p>
        </div>
      </div>
    );
  }

  const teams = new Map(bootstrap.teams.map((t) => [t.id, t.name]));
  const elements = bootstrap.elements ?? [];

  const withNews: FplElement[] = elements.filter(
    (e) =>
      (e.news != null && String(e.news).trim().length > 0) ||
      (e.status && e.status !== 'a')
  );

  const sorted = [...withNews].sort((a, b) => {
    const order = { s: 0, i: 1, d: 2, u: 3, a: 4 };
    const ai = order[a.status as keyof typeof order] ?? 4;
    const bi = order[b.status as keyof typeof order] ?? 4;
    if (ai !== bi) return ai - bi;
    const da = a.news_added ? new Date(a.news_added).getTime() : 0;
    const db = b.news_added ? new Date(b.news_added).getTime() : 0;
    return db - da;
  });

  return (
    <div className="h-full flex flex-col rounded-xl border border-fpl-border bg-fpl-card overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-fpl-border bg-fpl-card/80">
        <h3 className="text-lg font-semibold text-white">Player News</h3>
        <p className="text-slate-500 text-sm mt-0.5">
          Injuries, suspensions and updates from Premier League (FPL API)
        </p>
      </div>
      <div className="players-news-scroll flex-1 min-h-0 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-slate-500 text-sm text-center">
            No injury or suspension news right now.
          </p>
        ) : (
          <ul className="divide-y divide-fpl-border/70">
            {sorted.map((e) => {
              const teamName = teams.get(e.team) ?? `Team ${e.team}`;
              const pos = POS_LABELS[e.element_type] ?? '';
              const chance = e.chance_of_playing_next_round ?? e.chance_of_playing_this_round;
              return (
                <li key={e.id} className="px-4 py-2.5 hover:bg-fpl-dark/30">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-200">{e.web_name}</span>
                      <span className="text-slate-500 text-xs ml-1.5">
                        {teamName}
                        {pos ? ` · ${pos}` : ''}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusClass(e.status)}`}
                    >
                      {statusLabel(e.status)}
                    </span>
                  </div>
                  {e.news && (
                    <p className="text-slate-400 text-xs mt-1 leading-snug">{e.news}</p>
                  )}
                  {chance != null && chance < 100 && (
                    <p className="text-slate-500 text-xs mt-0.5">
                      Chance of playing next round: {chance}%
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
