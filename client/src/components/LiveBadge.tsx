/** Small red pill with a blinking dot, for matches in progress. Blinking stops for prefers-reduced-motion. */
export default function LiveBadge({ label = 'Live', className = '' }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-fpl-snow shadow ${className}`}
    >
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-fpl-snow" aria-hidden />
      {label}
    </span>
  );
}
