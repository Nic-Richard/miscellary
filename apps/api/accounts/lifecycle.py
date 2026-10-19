from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from cards.models import CardDefinition, CardSet
from packs.models import OwnedCard, SetPoints
from social.models import Feedback, Follow, Notification, Reaction, Report, SetFollow, ShowcaseSlot
from trades.models import TradeOffer

from .models import AccountCleanup, GoogleChallenge, GoogleIdentity, ReservedUsername, User
from .themes import DEFAULT_THEME


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
    user = User.objects.select_for_update().get(pk=user.pk)
    if user.deleted_at is not None:
        return
    from billing import play
    from billing.actions import record_entry
    from billing.models import StarBalance, StarEntry, StarGrant, StripeCustomer, Subscription
    from billing.stripe import cancel_for_closure
    from lounge.models import Post, PostRead, Vote
    from social.models import Block
    from uploads.models import Image

    cancel_for_closure(user)
    play.cancel_for_closure(user)
    references = {
        str(user.pk),
        user.email,
        *StripeCustomer.objects.filter(user=user).values_list("reference", flat=True),
        *StarGrant.objects.filter(user=user).values_list("reference", flat=True),
        *Subscription.objects.filter(user=user).values_list("reference", flat=True),
        *[
            str(pk)
            for pk in Report.objects.filter(
                Q(reporter=user)
                | Q(reported_user=user)
                | Q(comment__author=user)
                | Q(card_set__creator=user)
                | Q(card__card_set__creator=user)
                | Q(lounge_post__author=user)
                | Q(lounge_reply__author=user)
            ).values_list("pk", flat=True)
        ],
        *[str(pk) for pk in Feedback.objects.filter(user=user).values_list("pk", flat=True)],
    }
    drafts = CardSet.objects.filter(creator=user, status=CardSet.Status.DRAFT)
    storage_keys: set[str] = set()
    for card in CardDefinition.objects.filter(card_set__in=drafts):
        storage_keys.update(
            getattr(card, field.name)
            for field in card._meta.fields
            if field.name.startswith("render_")
            and field.name.endswith("_key")
            and getattr(card, field.name)
        )
    for draft in drafts:
        storage_keys.update(key for key in [draft.render_back_key, draft.render_pack_key] if key)
    balance = StarBalance.objects.filter(user=user).first()
    if balance and (balance.units or balance.reward_remainder):
        balance.reward_remainder = 0
        record_entry(balance, StarEntry.Kind.CLOSURE, -balance.units)
    Subscription.objects.filter(user=user).update(auto_renews=False)
    now = timezone.now()
    TradeOffer.objects.filter(
        Q(sender=user) | Q(recipient=user), status=TradeOffer.Status.PENDING
    ).update(status=TradeOffer.Status.CANCELLED, resolved_at=now)
    ShowcaseSlot.objects.filter(user=user).delete()
    OwnedCard.objects.filter(owner=user).delete()
    SetPoints.objects.filter(user=user).delete()
    CardSet.objects.filter(creator=user, status=CardSet.Status.DRAFT).delete()
    pack_images = [
        layer["image_id"]
        for layers in CardSet.objects.filter(creator=user).values_list("pack_layers", flat=True)
        for layer in layers
        if layer.get("kind") == "image" and layer.get("image_id")
    ]
    unused_images = (
        Image.objects.filter(owner=user)
        .exclude(pk__in=CardDefinition.objects.values("image_id"))
        .exclude(pk__in=CardSet.objects.filter(cover__isnull=False).values("cover_id"))
        .exclude(pk__in=pack_images)
    )
    storage_keys.update(unused_images.values_list("key", flat=True))
    unused_images.delete()
    AccountCleanup.objects.create(
        user_id=user.pk,
        references=sorted(value for value in references if 6 <= len(value) <= 256),
        storage_keys=sorted(storage_keys),
        next_attempt_at=timezone.now() + timedelta(minutes=1),
    )
    Feedback.objects.filter(user=user).delete()
    Report.objects.filter(reporter=user).delete()
    Post.objects.filter(author=user, draft=True).delete()
    PostRead.objects.filter(user=user).delete()
    Follow.objects.filter(Q(follower=user) | Q(following=user)).delete()
    SetFollow.objects.filter(user=user).delete()
    Reaction.objects.filter(user=user).delete()
    Vote.objects.filter(user=user).delete()
    Block.objects.filter(Q(user=user) | Q(blocked=user)).delete()
    Notification.objects.filter(Q(recipient=user) | Q(actor=user)).delete()
    ReservedUsername.objects.filter(user=user).delete()
    GoogleChallenge.objects.filter(user=user).delete()
    GoogleIdentity.objects.filter(user=user).delete()
    revoke_sessions(user)

    user.username = f"deleted_{user.pk.hex[:12]}"
    user.email = f"{user.pk.hex}@deleted.invalid"
    user.set_unusable_password()
    user.email_verified = False
    user.theme = DEFAULT_THEME
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
