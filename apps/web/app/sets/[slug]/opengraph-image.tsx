import { personName } from '@miscellary/shared';
import { OG_SIZE, Pack, pngFrom, shareImage } from '@/lib/og';
import { loadSet } from '@/lib/publicPages';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'A Miscellary card set';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const set = await loadSet(slug);
  const pack = await pngFrom(set?.render_pack?.image?.url, 800);
  return shareImage({
    object: pack ? <Pack src={pack} width={384} /> : null,
    title: set?.title ?? 'Miscellary',
    lines: set
      ? [`${set.card_count} cards by ${personName(set.creator)}`, 'Open a free pack every day']
      : [],
  });
}
