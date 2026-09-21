import BinderClient from './BinderClient';
import { getPublicSet, listPublicSets } from '@/lib/sets';
import { ApiRequestError } from '@/lib/api';

export const revalidate = 300;

export async function generateStaticParams() {
  const page = await listPublicSets('new');
  return page.results.map((set) => ({ slug: set.slug }));
}

export default async function BinderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const set = await getPublicSet(slug);
    return <BinderClient slug={slug} initialSet={set} />;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return <BinderClient slug={slug} initialSet={null} />;
    }
    throw error;
  }
}
