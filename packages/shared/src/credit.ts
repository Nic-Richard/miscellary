import type { ImageCredit } from './api';

/* A licence that asks for attribution wants the author named wherever the work
   is shown, so the line is built here and rendered the same on every client. */
export function creditLine(credit: ImageCredit | null | undefined): string | null {
  const name = credit?.author || siteName(credit?.source_url);
  if (!name) return null;
  return credit?.license ? `Photo: ${name} (${credit.license})` : `Photo: ${name}`;
}

/** A cited link with no name prints as its site, e.g. unsplash.com. */
function siteName(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
