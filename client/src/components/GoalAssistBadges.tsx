/**
 * Match-event badges stacked on a player's photo: "G" / "A" for goals and assists (e.g. "2G" for two goals), then a
 * yellow or red card. A red card (straight or a second yellow) shows on its own, as the red is what counts.
 */
export default function GoalAssistBadges({
  goals,
  assists,
  yellowCards = 0,
  redCards = 0,
  className = '',
}: {
  goals: number;
  assists: number;
  yellowCards?: number;
  redCards?: number;
  className?: string;
}) {
  const card = redCards > 0 ? 'red' : yellowCards > 0 ? 'yellow' : null;
  if (goals <= 0 && assists <= 0 && !card) return null;
  const badge = 'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold leading-none shadow ring-1 ring-black/20';
  return (
    <span
      className={`flex flex-col items-end gap-0.5 ${className}`}
      title={[
        goals > 0 ? `${goals} goal${goals === 1 ? '' : 's'}` : null,
        assists > 0 ? `${assists} assist${assists === 1 ? '' : 's'}` : null,
        card === 'red' ? 'Red card' : card === 'yellow' ? 'Yellow card' : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      {goals > 0 && <span className={`${badge} bg-fpl-accent text-fpl-ink`}>{goals > 1 ? `${goals}G` : 'G'}</span>}
      {assists > 0 && <span className={`${badge} bg-sky-400 text-fpl-ink`}>{assists > 1 ? `${assists}A` : 'A'}</span>}
      {card && (
        <span
          className={`mr-0.5 h-[14px] w-[10px] rounded-[2px] shadow ring-1 ring-black/30 ${card === 'red' ? 'bg-red-500' : 'bg-yellow-300'}`}
          role="img"
          aria-label={card === 'red' ? 'Red card' : 'Yellow card'}
        />
      )}
    </span>
  );
}
