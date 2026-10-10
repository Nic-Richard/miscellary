/** Short relative time for comments and notifications, exact date past a week. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const secs = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = secs / 60;
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
