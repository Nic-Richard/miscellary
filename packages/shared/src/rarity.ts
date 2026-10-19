// Rarity tiers are fixed at launch and mirrored in apps/api/cards/rarity.py.
// Keep both files in sync; the API test suite compares them against this file.
//
// Caps, odds, and recycle values can be tuned through playtesting.

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

// Maximum share of a published set each tier may occupy. Common has no cap
// but the set must be at least COMMON_MIN_SHARE common so packs stay open-able.
export const RARITY_MAX_SHARE: Record<Exclude<Rarity, 'common'>, number> = {
  uncommon: 0.3,
  rare: 0.25,
  epic: 0.15,
  legendary: 0.1,
};
export const COMMON_MIN_SHARE = 0.4;

// Per-card pull probability inside a pack. Must sum to 1.
export const PULL_ODDS: Record<Rarity, number> = {
  common: 0.68,
  uncommon: 0.22,
  rare: 0.07,
  epic: 0.0225,
  legendary: 0.0075,
};

// Set-specific points granted when a duplicate of this rarity is recycled.
export const RECYCLE_VALUE: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 5,
  epic: 10,
  legendary: 20,
};

export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && (RARITIES as readonly string[]).includes(value);
}
