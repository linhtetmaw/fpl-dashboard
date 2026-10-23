import CLUBS_JSON from '../clubs.json';
import type { FplTeam } from '../types/fpl';

export interface ClubInfo {
  slug: string;
  /** Full English name, e.g. "Manchester United". */
  name: string;
  /** Burmese name, e.g. "မန်ယူ". */
  my: string;
  /** Other names people search for, e.g. "Man U". */
  aka: string[];
}

const { _note, ...CLUBS } = CLUBS_JSON as unknown as Record<string, ClubInfo> & { _note: string };
void _note;

/** Club info for an FPL team (falls back to FPL's own name for a club missing from clubs.json). */
export function clubInfo(team: FplTeam): ClubInfo {
  const known = team.short_name ? CLUBS[team.short_name] : undefined;
  return (
    known ?? {
      slug: team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name: team.name,
      my: team.name,
      aka: [],
    }
  );
}

export function clubPath(team: FplTeam): string {
  return `/clubs/${clubInfo(team).slug}`;
}

const MMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Yangon',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Kick-off in Myanmar time, e.g. "Sat 24 Oct, 21:30". */
export function myanmarTime(iso: string | null | undefined): string {
  return iso ? MMT.format(new Date(iso)) : 'TBC';
}
