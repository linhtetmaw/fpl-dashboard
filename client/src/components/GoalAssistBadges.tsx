/** "G" / "A" badges for a player's goals and assists (e.g. "2G" for two goals), stacked on the player's photo. */
export default function GoalAssistBadges({
  goals,
  assists,
  className = '',
}: {
  goals: number;
  assists: number;
  className?: string;
}) {
  if (goals <= 0 && assists <= 0) return null;
  const badge = 'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold leading-none shadow ring-1 ring-black/20';
  return (
    <span
      className={`flex flex-col items-end gap-0.5 ${className}`}
      title={[
        goals > 0 ? `${goals} goal${goals === 1 ? '' : 's'}` : null,
        assists > 0 ? `${assists} assist${assists === 1 ? '' : 's'}` : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      {goals > 0 && <span className={`${badge} bg-fpl-accent text-fpl-ink`}>{goals > 1 ? `${goals}G` : 'G'}</span>}
      {assists > 0 && <span className={`${badge} bg-sky-400 text-fpl-ink`}>{assists > 1 ? `${assists}A` : 'A'}</span>}
    </span>
  );
}
