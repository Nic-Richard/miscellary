import type { ImageCredit } from './api';

/* A licence that asks for attribution wants the author named wherever the work
   is shown, so the line is built here and rendered the same on every client. */
export function creditLine(credit: ImageCredit | null | undefined): string | null {
  if (!credit?.author) return null;
  return credit.license ? `Photo: ${credit.author} (${credit.license})` : `Photo: ${credit.author}`;
}
