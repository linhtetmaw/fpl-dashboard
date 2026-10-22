/** "3 min ago", "1 hour ago", "2 days ago". */
export function timeAgo(iso: string | number, now: number = Date.now()): string {
  const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
