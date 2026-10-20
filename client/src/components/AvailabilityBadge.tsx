import type { Availability } from '../utils/availability';

/** Small warning triangle for players who may not play: amber = doubtful, red = out. */
export default function AvailabilityBadge({ availability, className = '' }: { availability: Availability; className?: string }) {
  const color = availability.level === 'out' ? 'text-rose-500' : 'text-amber-400';
  return (
    <span className={`inline-flex drop-shadow ${color} ${className}`} title={availability.label} role="img" aria-label={availability.label}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path fill="currentColor" d="M10.3 3.9 1.8 18.6A2 2 0 0 0 3.5 21.6h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path fill="#13001a" d="M11 9h2v5.5h-2zM11 16.5h2v2h-2z" />
      </svg>
    </span>
  );
}
