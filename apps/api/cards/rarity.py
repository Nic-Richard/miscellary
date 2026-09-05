"""Rarity tiers and the rules attached to them.

Mirrors packages/shared/src/rarity.ts. A test in cards/tests/test_rarity.py
reads the TypeScript file and fails if the two drift apart.

Caps, odds, and recycle values can be tuned through playtesting.
"""

from collections import Counter

COMMON = "common"
UNCOMMON = "uncommon"
RARE = "rare"
EPIC = "epic"
LEGENDARY = "legendary"

RARITIES = [COMMON, UNCOMMON, RARE, EPIC, LEGENDARY]
RARITY_CHOICES = [(r, r.capitalize()) for r in RARITIES]

# Maximum share of a published set each tier may occupy.
RARITY_MAX_SHARE = {UNCOMMON: 0.30, RARE: 0.20, EPIC: 0.10, LEGENDARY: 0.05}
COMMON_MIN_SHARE = 0.40

PULL_ODDS = {COMMON: 0.60, UNCOMMON: 0.25, RARE: 0.10, EPIC: 0.04, LEGENDARY: 0.01}
RECYCLE_VALUE = {COMMON: 1, UNCOMMON: 3, RARE: 10, EPIC: 30, LEGENDARY: 100}

# Smallest set that can be published.
MIN_CARDS_TO_PUBLISH = 5


def rarity_problems(rarities: list[str]) -> list[str]:
    """Return human-readable reasons a set's rarity mix can't be published."""
    total = len(rarities)
    if total == 0:
        return ["Add at least one card."]
    counts = Counter(rarities)
    problems = []

    common_share = counts[COMMON] / total
    if common_share < COMMON_MIN_SHARE:
        problems.append(
            f"At least {COMMON_MIN_SHARE:.0%} of cards must be Common "
            f"(currently {common_share:.0%})."
        )
    for rarity, max_share in RARITY_MAX_SHARE.items():
        share = counts[rarity] / total
        # Allow a single card of any tier so small sets can still have one Legendary.
        if share > max_share and counts[rarity] > 1:
            problems.append(
                f"No more than {max_share:.0%} of cards can be {rarity.capitalize()} "
                f"(currently {share:.0%})."
            )
    return problems
