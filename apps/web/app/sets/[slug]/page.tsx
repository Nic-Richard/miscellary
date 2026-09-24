import type { Metadata } from 'next';
import { setPath } from '@miscellary/shared';
import BinderClient from './BinderClient';
import { loadSet, setDescription } from '@/lib/publicPages';
import { listPublicSets } from '@/lib/sets';

export const revalidate = 300;

export async function generateStaticParams() {
  const page = await listPublicSets('new');
  return page.results.map((set) => ({ slug: set.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const set = await loadSet(slug);
  if (!set || set.status !== 'published')
    return { title: 'Set not found', robots: { index: false } };
  const description = setDescription(set);
  return {
    title: set.title,
    description,
    alternates: { canonical: setPath(set.slug) },
    openGraph: { title: set.title, description, url: setPath(set.slug) },
  };
}

export default async function BinderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BinderClient slug={slug} initialSet={await loadSet(slug)} />;
}
