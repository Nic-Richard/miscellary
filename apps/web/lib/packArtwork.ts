import type { CardSetSummary } from '@miscellary/shared';

export async function preloadPackArtwork(set: CardSetSummary) {
  const sources = new Set(['/materials/pack-blank.png', '/materials/pack-shading.png']);
  for (const layer of set.pack_layers ?? []) {
    if (layer.kind === 'image' && !layer.hidden && layer.url) sources.add(layer.url);
  }
  const ready = new Set<string>();
  const loading = Promise.all(
    [...sources].map(async (source) => {
      const image = new Image();
      image.src = source;
      try {
        await image.decode();
        ready.add(source);
      } catch {
        // Failed or expired URLs must use the fresh opening response instead.
      }
    }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A slow image must not hold a successful pack opening indefinitely.
  await Promise.race([
    loading,
    new Promise<void>((resolve) => (timer = setTimeout(resolve, 2000))),
  ]);
  clearTimeout(timer);
  return ready;
}

export function reusePackArtwork(
  current: CardSetSummary,
  previous: CardSetSummary,
  ready: Set<string>,
) {
  return {
    ...current,
    pack_layers: current.pack_layers.map((layer) => {
      const cached = previous.pack_layers.find(
        (candidate) => candidate.image_id === layer.image_id,
      );
      if (layer.kind !== 'image' || !cached?.url || !ready.has(cached.url) || !layer.url)
        return layer;
      // Signed URLs change between responses even when the uploaded artwork has not.
      let fresh: URL;
      let known: URL;
      try {
        fresh = new URL(layer.url);
        known = new URL(cached.url);
      } catch {
        return layer;
      }
      return fresh.searchParams.has('X-Amz-Signature') &&
        known.searchParams.has('X-Amz-Signature') &&
        fresh.origin === known.origin &&
        fresh.pathname === known.pathname
        ? { ...layer, url: cached.url }
        : layer;
    }),
  };
}
