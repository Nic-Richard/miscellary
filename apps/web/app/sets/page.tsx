import BrowseClient from './BrowseClient';
import { listPublicSets } from '@/lib/sets';

export const revalidate = 300;

export default async function BrowsePage() {
  const [newest, popular] = await Promise.all([listPublicSets('new'), listPublicSets('popular')]);

  return <BrowseClient newest={newest.results} popular={popular.results} />;
}
