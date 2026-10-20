import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cardPath } from '@miscellary/shared';
import BinderClient from '../../BinderClient';
import { findCard, loadSet } from '@/lib/publicPages';
import { cardDescription } from '@/lib/seo';

export const revalidate = 300;

type Params = Promise<{ slug: string; number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, number } = await params;
  const set = await loadSet(slug);
  const card = findCard(set, number);
  if (!set || !card) return { title: 'Card not found', robots: { index: false } };
  const description = cardDescription(card, set.title);
  const title = `${card.title} from ${set.title}`;
  return {
    title,
    description,
    alternates: { canonical: cardPath(set.slug, card.position) },
    openGraph: { title, description, url: cardPath(set.slug, card.position) },
  };
}

export default async function CardPage({ params }: { params: Params }) {
  const { slug, number } = await params;
  const set = await loadSet(slug);
  const card = findCard(set, number);
  if (!set || !card) notFound();
  return <BinderClient slug={slug} initialSet={set} initialCard={card.position + 1} />;
}
