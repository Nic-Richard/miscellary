import type { CardSetSummary } from '@miscellary/shared';
import { describe, expect, it } from 'vitest';
import { reusePackArtwork } from './packArtwork';

function pack(url: string) {
  return {
    pack_layers: [{ kind: 'image', image_id: 'art', url, scale: 70 }],
  } as CardSetSummary;
}

describe('pack artwork reuse', () => {
  it('reuses the signed image URL without replacing the current design', () => {
    const previous = pack('https://media.test/art.png?X-Amz-Signature=old');
    const current = pack('https://media.test/art.png?X-Amz-Signature=new');
    current.pack_layers[0]!.scale = 120;
    const result = reusePackArtwork(current, previous, new Set([previous.pack_layers[0]!.url]));
    expect(result.pack_layers[0]).toMatchObject({ url: previous.pack_layers[0]!.url, scale: 120 });
    expect(current.pack_layers[0]!.url).toContain('Signature=new');
  });

  it('keeps new assets and unsigned image variations', () => {
    const previous = pack('https://media.test/art.png?X-Amz-Signature=old');
    for (const url of [
      'https://media.test/other.png?X-Amz-Signature=new',
      'https://other.test/art.png?X-Amz-Signature=new',
      'https://media.test/art.png?width=500',
      'invalid-url',
    ]) {
      const current = pack(url);
      expect(
        reusePackArtwork(current, previous, new Set([previous.pack_layers[0]!.url])).pack_layers,
      ).toEqual(current.pack_layers);
    }
    const current = pack('https://media.test/art.png?X-Amz-Signature=new');
    expect(reusePackArtwork(current, previous, new Set()).pack_layers).toEqual(current.pack_layers);
  });
});
