import type { MetadataRoute } from 'next';
import { cardPath, profilePath, setPath } from '@miscellary/shared';
import type { CardSetSummary, Paginated } from '@miscellary/shared';
import { apiFetch } from '@/lib/api';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600;

async function allPublishedSets(): Promise<CardSetSummary[]> {
  const sets: CardSetSummary[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await apiFetch<Paginated<CardSetSummary>>(`/api/v1/sets/?sort=new&page=${page}`, {
      auth: false,
    });
    sets.push(...batch.results);
    if (!batch.next) return sets;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${SITE_URL}${path}`;
  const sets = await allPublishedSets();
  const creators = new Set(sets.filter((s) => !s.creator.deleted).map((s) => s.creator.username));

  return [
    { url: url('/'), changeFrequency: 'daily', priority: 1 },
    { url: url('/sets'), changeFrequency: 'daily', priority: 0.9 },
    ...sets.flatMap((set) => {
      const lastModified = set.published_at ?? undefined;
      return [
        { url: url(setPath(set.slug)), lastModified, priority: 0.8 },
        ...Array.from({ length: set.card_count }, (_, position) => ({
          url: url(cardPath(set.slug, position)),
          lastModified,
          priority: 0.5,
        })),
      ];
    }),
    ...[...creators].map((username) => ({ url: url(profilePath(username)), priority: 0.6 })),
  ];
}
