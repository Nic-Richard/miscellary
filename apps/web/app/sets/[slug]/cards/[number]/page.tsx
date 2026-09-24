import type { Metadata } from 'next';
import { cardCode, cardPath, RARITY_LABELS } from '@miscellary/shared';
import BinderClient from '../../BinderClient';
import { findCard, loadSet } from '@/lib/publicPages';
import { snippet } from '@/lib/seo';

export const revalidate = 300;

type Params = Promise<{ slug: string; number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, number } = await params;
  const set = await loadSet(slug);
  const card = findCard(set, number);
  if (!set || !card) return { title: 'Card not found', robots: { index: false } };
  const code = cardCode(card.printed_set_code, card.position, card.set_total);
  const description = card.description
    ? snippet(card.description)
    : `${RARITY_LABELS[card.rarity]} card ${code} from ${set.title}.`;
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
  return (
    <BinderClient slug={slug} initialSet={set} initialCard={card ? card.position + 1 : null} />
  );
}
