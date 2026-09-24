from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from cards.models import CardSet
from packs.models import OwnedCard, SetPoints
from social.models import Follow, Notification, Reaction, SetFollow, ShowcaseSlot
from trades.models import TradeOffer

from .models import ReservedUsername, User


def revoke_sessions(user: User) -> None:
    live = OutstandingToken.objects.filter(user=user, blacklistedtoken__isnull=True)
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in live], ignore_conflicts=True
    )


@transaction.atomic
def delete_account(user: User) -> None:
    """Close an account while keeping what other collectors rely on.

    Published sets stay in the catalogue because other people own their cards,
    and comments keep their place in threads. Both are shown under a deleted
    user instead of the collector's name. Everything private to the account goes.
    """
    now = timezone.now()
    TradeOffer.objects.filter(
        Q(sender=user) | Q(recipient=user), status=TradeOffer.Status.PENDING
    ).update(status=TradeOffer.Status.CANCELLED, resolved_at=now)
    ShowcaseSlot.objects.filter(user=user).delete()
    OwnedCard.objects.filter(owner=user).delete()
    SetPoints.objects.filter(user=user).delete()
    CardSet.objects.filter(creator=user, status=CardSet.Status.DRAFT).delete()
    Follow.objects.filter(Q(follower=user) | Q(following=user)).delete()
    SetFollow.objects.filter(user=user).delete()
    Reaction.objects.filter(user=user).delete()
    Notification.objects.filter(Q(recipient=user) | Q(actor=user)).delete()
    ReservedUsername.objects.filter(user=user).delete()
    revoke_sessions(user)

    user.username = f"deleted_{user.pk.hex[:12]}"
    user.email = f"{user.pk.hex}@deleted.invalid"
    user.set_unusable_password()
    user.email_verified = False
    user.is_active = False
    user.deleted_at = now
    user.save()

    profile = user.profile
    profile.display_name = ""
    profile.bio = ""
    profile.showcase_title = ""
    profile.binder_colour = ""
    profile.avatar_key = ""
    profile.save()
