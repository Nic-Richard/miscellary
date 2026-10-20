import type { Metadata } from 'next';
import BrowseClient from './BrowseClient';
import { listPublicSets } from '@/lib/sets';

export const revalidate = 300;

const TITLE = 'Browse Trading Card Sets';
const DESCRIPTION =
  'Explore community-made trading card sets on Miscellary. Find a collection, browse its cards, and open free packs to start collecting.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/sets' },
  openGraph: {
    siteName: 'Miscellary',
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: '/sets',
  },
};

export default async function BrowsePage() {
  const [newest, popular] = await Promise.all([listPublicSets('new'), listPublicSets('popular')]);

  return <BrowseClient newest={newest.results} popular={popular.results} />;
}
