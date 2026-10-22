import { cardPath, profilePath, setPath } from '@miscellary/shared';
import type { CardSetSummary, Paginated } from '@miscellary/shared';
import { apiFetch } from './api';
import { SITE_URL } from './seo';

export const API_PAGE_SIZE = 24;
// 240 sets per file stays far below Google's 50,000-URL limit at realistic set sizes.
export const PAGES_PER_FILE = 10;

export type SitemapEntry = { path: string; lastModified?: string | null; priority?: number };

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' }[c]};`,
  );

export function xmlResponse(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

export function sitemapIndex(files: string[]): string {
  const items = files.map(
    (file) => `<sitemap><loc>${escapeXml(`${SITE_URL}/sitemaps/${file}`)}</loc></sitemap>`,
  );
  return `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.join('')}</sitemapindex>`;
}

export function urlSet(entries: SitemapEntry[]): string {
  const items = entries.map(({ path, lastModified, priority }) => {
    const parts = [`<loc>${escapeXml(`${SITE_URL}${path}`)}</loc>`];
    if (lastModified) parts.push(`<lastmod>${escapeXml(lastModified)}</lastmod>`);
    if (priority !== undefined) parts.push(`<priority>${priority}</priority>`);
    return `<url>${parts.join('')}</url>`;
  });
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.join('')}</urlset>`;
}

export function setFileCount(setCount: number): number {
  return Math.ceil(setCount / (API_PAGE_SIZE * PAGES_PER_FILE));
}

export function setEntries(sets: CardSetSummary[]): SitemapEntry[] {
  const creators = new Set(sets.filter((s) => !s.creator.deleted).map((s) => s.creator.username));
  return [
    ...sets.flatMap((set) => [
      { path: setPath(set.slug), lastModified: set.published_at, priority: 0.8 },
      ...Array.from({ length: set.card_count }, (_, position) => ({
        path: cardPath(set.slug, position),
        lastModified: set.published_at,
        priority: 0.5,
      })),
    ]),
    ...[...creators].map((username) => ({ path: profilePath(username), priority: 0.6 })),
  ];
}

export function fetchSetPage(page: number): Promise<Paginated<CardSetSummary>> {
  return apiFetch<Paginated<CardSetSummary>>(`/api/v1/sets/?sort=new&page=${page}`, {
    auth: false,
  });
}

export async function setsForFile(index: number): Promise<CardSetSummary[]> {
  const first = index * PAGES_PER_FILE + 1;
  const sets: CardSetSummary[] = [];
  for (let page = first; page < first + PAGES_PER_FILE; page += 1) {
    const batch = await fetchSetPage(page);
    sets.push(...batch.results);
    if (!batch.next) break;
  }
  return sets;
}
