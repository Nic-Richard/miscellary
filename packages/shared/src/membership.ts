import type { Rarity } from './rarity';

export interface PublishingAllowance {
  enabled: boolean;
  used: number;
  limit: number | null;
  resets_at: string;
  creator_reward_percent: number;
}

export interface PublishCheck {
  problems: string[];
  publishing: PublishingAllowance;
}

export interface Membership {
  enabled: boolean;
  preview?: boolean;
  show_badge?: boolean;
  currency_name: string;
  star_units: number;
  units_per_star: number;
  pending_checkouts?: { product: string; request_key: string }[];
  subscription: {
    checkout_available?: boolean;
    management_available?: boolean;
    active: boolean;
    provider?: 'web' | 'play' | null;
    paid_through: string | null;
    auto_renews: boolean;
    bonus_packs_remaining: number;
    price_cents: number;
    currency: string;
    monthly_bonus_packs: number;
    monthly_stars: number;
  };
  publishing: PublishingAllowance;
  play?: { available: boolean; subscription_id: string; account_id: string | null };
  blocked_countries?: string[];
  bundles: {
    id: string;
    price_cents: number;
    currency: string;
    base_stars: number;
    bonus_stars: number;
    total_stars: number;
    checkout_available?: boolean;
  }[];
}

export interface PaidPackQuote {
  request_key: string;
  points_spent: number;
  stars_spent_units: number;
  star_units: number;
  units_per_star: number;
  bonus_packs_remaining: number;
  odds: { rarity: Rarity; basis_points: number; card_count: number }[];
}

export interface CreatorStats {
  enabled: boolean;
  advanced: boolean;
  publishing: PublishingAllowance;
  totals: { sets: number; openings: number; collectors: number; follows: number };
  details?: {
    since: string;
    includes_own_activity: boolean;
    stars_earned_units: number;
    recent_stars_earned_units: number;
    recent_openings: number;
    daily_openings: { day: string; openings: number }[];
    opening_types: { kind: string; openings: number }[];
    popular_cards: {
      id: string;
      title: string;
      position: number;
      set_slug: string;
      set_title: string;
      likes: number;
    }[];
    sets: {
      id: string;
      title: string;
      slug: string;
      deleted: boolean;
      openings: number;
      collectors: number;
      follows: number;
      stars_spent_units: number;
      stars_earned_units: number;
      holders: number;
      completed: number;
      average_completion_percent: number;
    }[];
  };
}

export const OPENING_LABELS: Record<string, string> = {
  free: 'Daily free',
  points: 'Set points',
  stars: 'Tickets + points',
  bonus: 'Bonus packs',
};

export function creatorActivity(details: NonNullable<CreatorStats['details']>) {
  const counts = new Map(details.daily_openings.map(({ day, openings }) => [day, openings]));
  const start = new Date(details.since);
  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    const key = day.toISOString().slice(0, 10);
    return { day: key, openings: counts.get(key) ?? 0 };
  });
}

export type PackPayment =
  | boolean
  | {
      payment: 'stars' | 'bonus';
      request_key: string;
      max_stars_units?: number;
    };

export function starAmount(units: number, unitsPerStar: number): string {
  return (units / unitsPerStar).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function packPrice(quote: PaidPackQuote): string {
  const parts: string[] = [];
  if (quote.points_spent) parts.push(`${quote.points_spent} set points`);
  if (quote.stars_spent_units) {
    parts.push(`${starAmount(quote.stars_spent_units, quote.units_per_star)} tickets`);
  }
  return parts.join(' + ');
}

export function packOdds(quote: PaidPackQuote): string {
  return quote.odds
    .map(
      ({ rarity, basis_points, card_count }) =>
        `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)} ${basis_points / 100}% (${(basis_points / 100 / card_count).toLocaleString(undefined, { maximumFractionDigits: 3 })}% per card)`,
    )
    .join(' · ');
}
