import { fetchSetPage, setFileCount, sitemapIndex, xmlResponse } from '@/lib/sitemap';

export const revalidate = 3600;

export async function GET() {
  const { count } = await fetchSetPage(1);
  const files = [
    'core.xml',
    ...Array.from({ length: setFileCount(count) }, (_, i) => `sets-${i + 1}.xml`),
  ];
  return xmlResponse(sitemapIndex(files));
}
