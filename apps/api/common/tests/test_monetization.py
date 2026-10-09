import pytest

from common.monetization import (
    CREDIT_BUNDLES,
    CREDIT_UNITS_PER_CREDIT,
    FREE_MONTHLY_PUBLICATIONS,
    SUBSCRIBER_MONTHLY_PUBLICATIONS,
    SUBSCRIPTION_BONUS_CREDITS,
    SUBSCRIPTION_BONUS_PACKS,
    SUBSCRIPTION_PRICE_CENTS,
    creator_reward,
)


def test_agreed_products_and_allowances():
    assert [
        (bundle.price_cents, bundle.total_credits, bundle.credit_units)
        for bundle in CREDIT_BUNDLES.values()
    ] == [(500, 125, 125000), (1000, 275, 275000), (2000, 600, 600000), (5000, 1500, 1500000)]
    assert SUBSCRIPTION_PRICE_CENTS == 499
    assert (SUBSCRIPTION_BONUS_PACKS, SUBSCRIPTION_BONUS_CREDITS) == (10, 100)
    assert (FREE_MONTHLY_PUBLICATIONS, SUBSCRIBER_MONTHLY_PUBLICATIONS) == (3, 10)


def test_rewards_carry_fractions_and_keep_the_chain_bounded():
    assert creator_reward(50 * CREDIT_UNITS_PER_CREDIT) == (10000, 0)
    assert creator_reward(30 * CREDIT_UNITS_PER_CREDIT) == (6000, 0)
    remainder = earned = 0
    for _ in range(5):
        reward, remainder = creator_reward(1, remainder)
        earned += reward
    assert (earned, remainder) == creator_reward(5)

    original = spend = 100 * CREDIT_UNITS_PER_CREDIT
    total_rewards = 0
    while spend:
        spend, _ = creator_reward(spend)
        total_rewards += spend
    assert total_rewards <= original // 4
    for spent, carry in [(-1, 0), (1.5, 0), (True, 0), (0, -1), (0, 100), (0, 0.5)]:
        with pytest.raises(ValueError):
            creator_reward(spent, carry)
