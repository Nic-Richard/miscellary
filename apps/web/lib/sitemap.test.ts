import { describe, expect, it } from 'vitest';
import type { CardSetSummary } from '@miscellary/shared';
import { setEntries, setFileCount, sitemapIndex, urlSet } from './sitemap';

const set = (slug: string, cards: number, username: string, deleted = false) =>
  ({
    slug,
    card_count: cards,
    published_at: '2026-10-01T00:00:00Z',
    creator: { username, deleted },
  }) as CardSetSummary;

describe('sitemap', () => {
  it('splits sets into bounded files', () => {
    expect(setFileCount(0)).toBe(0);
    expect(setFileCount(240)).toBe(1);
    expect(setFileCount(241)).toBe(2);
  });

  it('lists each set, its cards and live creators once', () => {
    const entries = setEntries([
      set('film', 2, 'nic'),
      set('birds', 1, 'nic'),
      set('gone', 1, 'old', true),
    ]);
    const paths = entries.map((e) => e.path);
    expect(paths.filter((p) => p.includes('/cards/'))).toHaveLength(4);
    expect(paths.filter((p) => p.startsWith('/users/'))).toEqual(['/users/nic']);
  });

  it('escapes URLs and writes a sitemap index', () => {
    expect(urlSet([{ path: '/sets?a=1&b=2' }])).toContain('/sets?a=1&amp;b=2');
    expect(sitemapIndex(['core.xml'])).toContain('/sitemaps/core.xml</loc>');
  });
});
