import { describe, expect, it } from 'vitest';
import { creatorActivity, packOdds, packPrice, starAmount } from './membership';
import type { CreatorStats, PaidPackQuote } from './membership';

describe('Ticket pack confirmation', () => {
  it('shows the exact mixed price, including fractions', () => {
    const quote: PaidPackQuote = {
      request_key: 'request',
      points_spent: 17,
      stars_spent_units: 33000,
      star_units: 125000,
      units_per_star: 1000,
      bonus_packs_remaining: 0,
      odds: [{ rarity: 'common', basis_points: 10000, card_count: 5 }],
    };
    expect(packPrice(quote)).toBe('17 set points + 33 tickets');
    expect(packPrice({ ...quote, points_spent: 50, stars_spent_units: 0 })).toBe('50 set points');
    expect(starAmount(1200, 1000)).toBe((1.2).toLocaleString());
    expect(packOdds(quote)).toBe('Common 100% (20% per card)');
  });
});

it('fills the 30-day activity window in UTC, including quiet days and month boundaries', () => {
  const activity = creatorActivity({
    since: '2026-02-20T00:00:00Z',
    daily_openings: [{ day: '2026-03-01', openings: 7 }],
  } as NonNullable<CreatorStats['details']>);
  expect(activity).toHaveLength(30);
  expect(activity[0]).toEqual({ day: '2026-02-20', openings: 0 });
  expect(activity[9]).toEqual({ day: '2026-03-01', openings: 7 });
  expect(activity.at(-1)).toEqual({ day: '2026-03-21', openings: 0 });
});
