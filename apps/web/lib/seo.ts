import { SITE_URL as PRODUCTION_SITE_URL } from '@miscellary/shared';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE_URL;

/** Plain text short enough for a search snippet or a link preview. */
export function snippet(text: string, max = 160): string {
  const plain = text
    .replace(/[*_`#>[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}
