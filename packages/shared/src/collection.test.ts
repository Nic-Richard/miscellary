import { describe, expect, it, vi } from 'vitest';
import type { OwnedCard } from './api';
import { groupOwnedCards, listOwnedCardPages, stackOwnedCards } from './collection';
import { spareCount } from './packs';

function copy(id: string, cardId: string, held = false, setSlug = 'cameras'): OwnedCard {
  return {
    id,
    card: {
      id: cardId,
      title: cardId,
      rarity: 'common',
      description: '',
      printed_text: '',
      image: { id: 'image', kind: 'card', url: '', width: 100, height: 100, ready: true },
      template_key: 'classic',
      template_version: 1,
      template_config: {},
      position: 1,
      printed_set_code: '',
      set_total: 1,
      like_count: 0,
      tags: [],
    },
    set_slug: setSlug,
    set_title: setSlug,
    set_mark: '',
    set_pack_colour: '',
    copies: 1,
    held,
    acquired_at: '2026-10-01T00:00:00Z',
  };
}

it('loads every copy across 60-row pages in order, keeping the set filter', async () => {
  const owned = Array.from({ length: 125 }, (_, i) => copy(`copy-${i}`, `card-${i % 70}`));
  const readPage = vi.fn(async (_slug?: string, page = 1) => ({
    count: owned.length,
    next: page < 3 ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    results: owned.slice((page - 1) * 60, page * 60),
  }));
  expect(await listOwnedCardPages(readPage, 'cameras')).toEqual(owned);
  expect(readPage.mock.calls).toEqual([['cameras'], ['cameras', 2], ['cameras', 3]]);
});

describe('stackOwnedCards', () => {
  it('handles an empty collection', () => {
    expect(stackOwnedCards([])).toEqual([]);
  });

  it('keeps the first free copy and the original card order', () => {
    const first = copy('first', 'a');
    const second = copy('second', 'b');
    expect(stackOwnedCards([first, second, copy('duplicate', 'a')])).toEqual([first, second]);
  });

  it('replaces a held copy with a free one without moving its tile', () => {
    const held = copy('held', 'a', true);
    const second = copy('second', 'b');
    const free = copy('free', 'a');
    expect(stackOwnedCards([held, second, free, copy('later', 'a')])).toEqual([free, second]);
  });

  it('keeps the first copy when every copy is held', () => {
    const first = copy('first', 'a', true);
    expect(stackOwnedCards([first, copy('later', 'a', true)])).toEqual([first]);
  });

  it('does not replace a free copy with a later held copy', () => {
    const free = copy('free', 'a');
    expect(stackOwnedCards([free, copy('held', 'a', true)])).toEqual([free]);
  });

  it('does not mutate rows or their annotated copy counts', () => {
    const held = Object.freeze({ ...copy('held', 'a', true), copies: 2 });
    const free = Object.freeze({ ...copy('free', 'a'), copies: 2 });
    const owned = Object.freeze([held, free]);
    expect(stackOwnedCards(owned)[0]).toBe(free);
    expect(owned).toEqual([held, free]);
    expect(held.copies).toBe(2);
    expect(free.copies).toBe(2);
  });
});

describe('groupOwnedCards', () => {
  it('handles an empty collection', () => {
    expect(groupOwnedCards([]).size).toBe(0);
  });

  it('preserves set order, row order and duplicate copies', () => {
    const camera = copy('first', 'a');
    const bird = copy('bird', 'b', false, 'birds');
    const duplicate = copy('duplicate', 'a');
    const grouped = groupOwnedCards(Object.freeze([camera, bird, duplicate]));
    expect([...grouped.keys()]).toEqual(['cameras', 'birds']);
    expect(grouped.get('cameras')).toEqual([camera, duplicate]);
    expect(grouped.get('birds')).toEqual([bird]);
  });

  it('groups stacked cards without losing free-copy selection', () => {
    const free = copy('free', 'a');
    const grouped = groupOwnedCards(stackOwnedCards([copy('held', 'a', true), free]));
    expect(grouped.get('cameras')).toEqual([free]);
  });
});

describe('spareCount', () => {
  it('counts no spares for an empty collection or one copy of each card', () => {
    expect(spareCount([])).toBe(0);
    expect(spareCount([copy('a', 'a'), copy('b', 'b')])).toBe(0);
  });

  it('keeps one free copy of each card and ignores held copies', () => {
    expect(
      spareCount([
        copy('held-a', 'a', true),
        copy('a1', 'a'),
        copy('a2', 'a'),
        copy('a3', 'a'),
        copy('held-b', 'b', true),
        copy('b1', 'b'),
        copy('b2', 'b'),
      ]),
    ).toBe(3);
  });

  it('does not recycle the only free copy beside held copies', () => {
    expect(spareCount([copy('held', 'a', true), copy('free', 'a')])).toBe(0);
    expect(spareCount([copy('held1', 'a', true), copy('held2', 'a', true)])).toBe(0);
  });

  it('counts actual rows rather than the annotated total', () => {
    const first = { ...copy('first', 'a'), copies: 20 };
    const second = { ...copy('second', 'a'), copies: 20 };
    expect(spareCount([first, second])).toBe(1);
  });
});
