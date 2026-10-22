import { setEntries, setsForFile, urlSet, xmlResponse } from '@/lib/sitemap';

export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file === 'core.xml') {
    return xmlResponse(
      urlSet([
        { path: '/', priority: 1 },
        { path: '/sets', priority: 0.9 },
      ]),
    );
  }
  const match = /^sets-([1-9]\d{0,4})\.xml$/.exec(file);
  if (!match) return new Response('Not found', { status: 404 });
  // The sets API answers 404 for pages past the end, so a stale file number is simply gone.
  const sets = await setsForFile(Number(match[1]) - 1).catch(() => []);
  if (!sets.length) return new Response('Not found', { status: 404 });
  return xmlResponse(urlSet(setEntries(sets)));
}
