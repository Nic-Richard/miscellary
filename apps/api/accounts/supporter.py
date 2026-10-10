from django.conf import settings
from django.utils import timezone

# Months supported in total, counted across breaks, for each emblem tier.
TIERS = ((24, "legendary"), (12, "epic"), (6, "rare"), (3, "uncommon"), (1, "common"))


def tier_for(months: int) -> str | None:
    return next((name for least, name in TIERS if months >= least), None)


def supporter_tier(user) -> str | None:
    """The emblem shown after someone's name, or None when they aren't a visible supporter."""
    profile = getattr(user, "profile", None)
    if (
        not settings.MONETIZATION_ENABLED
        or profile is None
        or not user.is_active
        or not profile.supporter_shown
        or profile.supporter_until is None
        or profile.supporter_until <= timezone.now()
    ):
        return None
    return tier_for(max(profile.supporter_months, 1))
