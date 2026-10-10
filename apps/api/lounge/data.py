"""What the Lounge sends back: post and reply payloads, card limits and mentions."""

import re
from typing import Any

from django.conf import settings
from django.db.models import (
    Count,
    Exists,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from billing.actions import active_period
from cards.models import CardSet
from cards.serializers import CardSerializer, CreatorSerializer
from social.blocks import blocked_ids

from .models import Attachment, Post, PostRead, Reply, SavedPost, Vote

# Everyone can show six cards in a post; supporters can fill a binder page set with up to 40.
POST_CARDS = 6
BINDER_CARDS = 40
REPLY_CARDS = 3
SUPPORTER_REPLY_CARDS = 6
MENTION = re.compile(r"(?<![\w@])@([a-z0-9_]{3,20})\b")
MAX_MENTIONS = 5


def is_subscriber(user) -> bool:
    return bool(settings.MONETIZATION_ENABLED and user.is_authenticated and active_period(user))


def visible_posts(user):
    rows = Post.objects.exclude(author_id__in=blocked_ids(user))
    # Drafts are only ever visible to the person writing them.
    if user.is_authenticated:
        return rows.filter(Q(draft=False) | Q(author=user))
    return rows.filter(draft=False)


def subscriber_ids(rows) -> set:
    from billing.models import SubscriptionPeriod

    if not settings.MONETIZATION_ENABLED:
        return set()
    now = timezone.now()
    return set(
        SubscriptionPeriod.objects.filter(
            subscription__user_id__in={row.author_id for row in rows},
            subscription__user__is_active=True,
            starts_at__lte=now,
            ends_at__gt=now,
        ).values_list("subscription__user_id", flat=True)
    )


def badge(author, subscribers: set) -> str | None:
    """The supporter badge style, such as "gold-foil", or None when not shown."""
    if author.pk not in subscribers:
        return None
    options = getattr(author, "membershipsettings", None)
    if options is None:
        return "gold-foil"
    if not options.show_badge:
        return None
    return f"{options.badge_colour}-{options.badge_finish}"


def showcase_card(card) -> dict:
    card_set = card.card_set
    return {
        **CardSerializer(card).data,
        "set_title": card_set.title,
        "set_slug": card_set.slug,
        "set_mark": card_set.mark,
        "set_pack_colour": card_set.pack_colour,
        "set_creator": CreatorSerializer(card_set.creator).data,
    }


def attached_cards(attachments, owner_id) -> list:
    # Cards traded away or recycled since become placeholders, keeping the post's layout.
    return [
        showcase_card(attachment.owned_card.card)
        if attachment.owned_card
        and attachment.owned_card.owner_id == owner_id
        and attachment.owned_card.card.card_set.status
        in {CardSet.Status.PUBLISHED, CardSet.Status.DELETED}
        else None
        for attachment in attachments
    ]


def _attachments():
    return Attachment.objects.select_related(
        "owned_card__card__image", "owned_card__card__card_set__creator__profile"
    ).prefetch_related("owned_card__card__card_tags__tag")


def _score(**target):
    return Coalesce(
        Subquery(
            Vote.objects.filter(**target)
            .values(next(iter(target)))
            .annotate(total=Sum("value"))
            .values("total"),
            output_field=IntegerField(),
        ),
        0,
    )


def _my_vote(user, **target):
    if not user.is_authenticated:
        return Value(0, output_field=IntegerField())
    return Coalesce(
        Subquery(Vote.objects.filter(user=user, **target).values("value")[:1]),
        0,
        output_field=IntegerField(),
    )


def post_rows(user):
    blocked = blocked_ids(user)
    rows = (
        visible_posts(user)
        .select_related("author__profile", "author__membershipsettings")
        .prefetch_related(Prefetch("attachments", queryset=_attachments()))
        .annotate(
            score=_score(post=OuterRef("pk")),
            my_vote=_my_vote(user, post=OuterRef("pk")),
            reply_count=Count(
                "replies",
                filter=Q(replies__deleted_at__isnull=True) & ~Q(replies__author_id__in=blocked),
                distinct=True,
            ),
        )
    )
    if user.is_authenticated:
        rows = rows.annotate(
            saved=Exists(SavedPost.objects.filter(user=user, post=OuterRef("pk"))),
            saved_folder=Subquery(
                SavedPost.objects.filter(user=user, post=OuterRef("pk")).values("folder_id")[:1]
            ),
            read_at=Subquery(
                PostRead.objects.filter(user=user, post=OuterRef("pk")).values("read_at")[:1]
            ),
        )
    return rows


def post_data(post, viewer, subscribers: set) -> dict[str, Any]:
    removed = post.deleted_at is not None
    own = viewer.is_authenticated and viewer.pk == post.author_id
    read_at = getattr(post, "read_at", None)
    return {
        "id": str(post.pk),
        "title": "Removed post" if removed else post.title,
        "body": "" if removed else post.body,
        "author": None if removed else CreatorSerializer(post.author).data,
        "author_badge": None if removed else badge(post.author, subscribers),
        "created_at": post.created_at,
        "edited": post.edited_at is not None and not post.draft,
        "draft": post.draft,
        "removed": removed,
        "topic": post.topic,
        "style": "binder"
        if post.style == Post.Style.BINDER and post.author_id in subscribers
        else "plain",
        "can_edit": own and not removed,
        "can_delete": viewer.is_authenticated and (own or viewer.is_staff),
        "score": post.score,
        "my_vote": post.my_vote,
        "saved": getattr(post, "saved", False),
        "saved_folder": getattr(post, "saved_folder", None),
        # New replies since this person last opened the discussion.
        "unread": bool(read_at and post.active_at > read_at and not removed),
        "reply_count": post.reply_count,
        "cards": [] if removed else attached_cards(post.attachments.all(), post.author_id),
    }


def reply_rows(user, post, parent):
    blocked = blocked_ids(user)
    return (
        Reply.objects.filter(post=post, parent=parent)
        .select_related("author__profile", "author__membershipsettings")
        .prefetch_related(Prefetch("attachments", queryset=_attachments()))
        .annotate(
            score=_score(reply=OuterRef("pk")),
            my_vote=_my_vote(user, reply=OuterRef("pk")),
            child_count=Count(
                "children",
                filter=Q(children__deleted_at__isnull=True) & ~Q(children__author_id__in=blocked),
                distinct=True,
            ),
        )
    )


def reply_data(reply, viewer, subscribers: set, blocked: set, op_id) -> dict[str, Any]:
    removed = reply.deleted_at is not None or reply.author_id in blocked
    own = viewer.is_authenticated and viewer.pk == reply.author_id
    return {
        "id": str(reply.pk),
        "body": "" if removed else reply.body,
        "author": None if removed else CreatorSerializer(reply.author).data,
        "author_badge": None if removed else badge(reply.author, subscribers),
        "is_op": not removed and reply.author_id == op_id,
        "parent_id": str(reply.parent_id) if reply.parent_id else None,
        "created_at": reply.created_at,
        "edited": reply.edited_at is not None,
        "removed": removed,
        "can_edit": own and not removed,
        "can_delete": viewer.is_authenticated and (own or viewer.is_staff),
        "score": 0 if removed else getattr(reply, "score", 0),
        "my_vote": 0 if removed else getattr(reply, "my_vote", 0),
        "child_count": getattr(reply, "child_count", 0),
        "cards": [] if removed else attached_cards(reply.attachments.all(), reply.author_id),
    }


def mentioned_usernames(text: str) -> list[str]:
    names: list[str] = []
    for name in MENTION.findall(text.lower()):
        if name not in names:
            names.append(name)
    return names[:MAX_MENTIONS]
