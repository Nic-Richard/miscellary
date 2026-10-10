from dataclasses import dataclass

CURRENCY = "USD"
CURRENCY_NAME = "Tickets"
CREDIT_UNITS_PER_CREDIT = 1000
CREATOR_REWARD_PERCENT = 20
SUBSCRIPTION_PRICE_CENTS = 499
SUBSCRIPTION_BONUS_PACKS = 10
SUBSCRIPTION_BONUS_CREDITS = 100
FREE_MONTHLY_PUBLICATIONS = 3
SUBSCRIBER_MONTHLY_PUBLICATIONS = 10
# Paid random packs count as gambling in Belgium and are barred for minors in Brazil, whose
# ages we can't verify, so neither country can buy tickets or memberships.
PURCHASE_BLOCKED_COUNTRIES = frozenset({"BE", "BR"})


@dataclass(frozen=True)
class CreditBundle:
    price_cents: int
    base_credits: int
    bonus_credits: int = 0

    @property
    def total_credits(self) -> int:
        return self.base_credits + self.bonus_credits

    @property
    def credit_units(self) -> int:
        return self.total_credits * CREDIT_UNITS_PER_CREDIT


CREDIT_BUNDLES = {
    "credits_125": CreditBundle(500, 125),
    "credits_275": CreditBundle(1000, 250, 25),
    "credits_600": CreditBundle(2000, 500, 100),
    "credits_1500": CreditBundle(5000, 1250, 250),
}


def creator_reward(credit_units_spent: int, remainder: int = 0) -> tuple[int, int]:
    if type(credit_units_spent) is not int or credit_units_spent < 0:
        raise ValueError("Credit spending must be a nonnegative integer.")
    if type(remainder) is not int or not 0 <= remainder < 100:
        raise ValueError("Reward remainder must be between 0 and 99.")
    # Carry fractions of a credit unit rather than rounding each reward up or away.
    return divmod(credit_units_spent * CREATOR_REWARD_PERCENT + remainder, 100)
