import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function SwapIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 16H3l4 4" />
      <path d="M3 16h14a4 4 0 0 0 4-4" />
      <path d="M17 8h4l-4-4" />
      <path d="M21 8H7a4 4 0 0 0-4 4" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/**
 * FPL House mark: three bars forming a house roofline on a purple tile; the middle
 * (captain) bar is Pitch Green. Matches favicon.svg.
 */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#37003C" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="#6B4A70" strokeOpacity="0.6" />
      <polygon points="12,52 12,33 23,24 23,52" fill="#FFFFFF" />
      <polygon points="26,52 26,21 32,15 38,21 38,52" fill="#00FF85" />
      <polygon points="41,52 41,24 52,33 52,52" fill="#FFFFFF" />
    </svg>
  );
}
