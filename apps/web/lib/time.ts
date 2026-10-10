export { timeAgo } from '@miscellary/shared';

/** hh:mm:ss until a reset, floored at zero. */
export function countdown(until: string, now: number = Date.now()): string {
  const ms = Math.max(0, new Date(until).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
