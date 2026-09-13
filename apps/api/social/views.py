import contextlib
from datetime import timedelta
from typing import Any

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from cards import tags as tagging
from cards.models import CardDefinition, CardSet, Tag
from cards.serializers import CardSerializer, CardSetSerializer, CreatorSerializer
from cards.views import with_counts
from packs import actions
from packs.models import OwnedCard, PackOpening, SetPoints
from packs.views import with_copies

from .models import (
    SHOWCASE_SLOTS,
    Comment,
    Follow,
    Notification,
    Reaction,
    Report,
    SetFollow,
    ShowcaseSlot,
)
from .notifications import notify, unread_count, withdraw
from .serializers import (
    CommentSerializer,
    CommentWriteSerializer,
    NotificationSerializer,
    PackEntrySerializer,
    ProfilePageSerializer,
    ReportWriteSerializer,
    ShowcaseSlotSerializer,
    ShowcaseWriteSerializer,
)


def me(request: Request) -> User:
    assert isinstance(request.user, User)
    return request.user


def public_user(username: str) -> User:
    return get_object_or_404(
        User.objects.select_related("profile"), username=username.lower(), is_active=True
    )


def showcase_for(user):
    # Only slots whose card the user still owns (trades move cards, recycling deletes them).
    return ShowcaseSlot.objects.filter(user=user, owned_card__owner=user).select_related(
        "owned_card"
    )


class ProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request, username: str) -> Response:
        user = public_user(username)
        me = request.user if request.user.is_authenticated else None
        slots = list(showcase_for(user))
        owned = {
            c.pk: c
            for c in with_copies(OwnedCard.objects.filter(pk__in=[s.owned_card_id for s in slots]))
        }
        for slot in slots:
            slot.owned_card = owned[slot.owned_card_id]
        sets = with_counts(
            CardSet.objects.filter(creator=user, status=CardSet.Status.PUBLISHED), me
        ).order_by("-published_at")
        data = {
            "username": user.username,
            "display_name": user.profile.display_name,
            "bio": user.profile.bio,
            "showcase_title": user.profile.showcase_title,
            "binder_colour": user.profile.binder_colour,
            "avatar_url": user.profile.avatar_url,
            "is_demo": user.is_demo,
            "created_at": user.created_at,
            "follower_count": user.followers.count(),
            "following_count": user.following.count(),
            "set_count": sets.count(),
            "card_count": OwnedCard.objects.filter(owner=user).count(),
            "is_following": bool(me)
            and Follow.objects.filter(follower=me, following=user).exists(),
            "is_me": me == user,
            "showcase": slots,
            "sets": sets,
        }
        return Response(ProfilePageSerializer(data).data)


class FollowView(APIView):
    def post(self, request: Request, username: str) -> Response:
        target = public_user(username)
        if target == request.user:
            raise ValidationError("You can't follow yourself.")
        _, created = Follow.objects.get_or_create(follower=me(request), following=target)
        if created:
            notify(target, me(request), Notification.Kind.FOLLOW)
        return Response({"following": True, "follower_count": target.followers.count()})

    def delete(self, request: Request, username: str) -> Response:
        target = public_user(username)
        Follow.objects.filter(follower=me(request), following=target).delete()
        withdraw(target, me(request), Notification.Kind.FOLLOW)
        return Response({"following": False, "follower_count": target.followers.count()})


class PeoplePagination(PageNumberPagination):
    page_size = 50


class NotificationPagination(PageNumberPagination):
    page_size = 30


class FollowListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request, username: str, direction: str) -> Response:
        user = public_user(username)
        if direction == "followers":
            people = User.objects.filter(following__following=user)
        else:
            people = User.objects.filter(followers__follower=user)
        people = people.select_related("profile").order_by("username")
        paginator = PeoplePagination()
        page = paginator.paginate_queryset(people, request) or []
        return paginator.get_paginated_response(CreatorSerializer(page, many=True).data)


class ShowcaseView(APIView):
    def get(self, request: Request) -> Response:
        return Response(ShowcaseSlotSerializer(showcase_for(me(request)), many=True).data)

    def put(self, request: Request) -> Response:
        user = me(request)
        serializer = ShowcaseWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slots = serializer.validated_data["slots"]
        ids = [s.get("owned_card_id") for s in slots]
        owned = set(OwnedCard.objects.filter(pk__in=ids, owner=user).values_list("pk", flat=True))
        if len(owned) != len(set(ids)):
            raise ValidationError("You can only showcase cards you own.")
        positions = [int(s.get("position", 0)) - 1 for s in slots]
        if any(p < 0 or p >= SHOWCASE_SLOTS for p in positions) or len(set(positions)) != len(
            positions
        ):
            raise ValidationError(f"Positions must be unique and between 1 and {SHOWCASE_SLOTS}.")
        with transaction.atomic():
            ShowcaseSlot.objects.filter(user=user).delete()
            ShowcaseSlot.objects.bulk_create(
                [
                    ShowcaseSlot(user=user, position=p, owned_card_id=i)
                    for p, i in zip(positions, ids, strict=True)
                ]
            )
        return Response(ShowcaseSlotSerializer(showcase_for(user), many=True).data)


def _toggle_reaction(request: Request, add: bool, **target) -> tuple[Response, bool]:
    """Returns the response and whether this request is what changed the like.

    The caller needs to know: a repeated POST is a no-op here, and notifying on
    one would let anyone refill a creator's notifications by liking in a loop.
    """
    changed = False
    if add:
        with contextlib.suppress(IntegrityError):
            _, changed = Reaction.objects.get_or_create(user=me(request), **target)
    else:
        deleted, _ = Reaction.objects.filter(user=me(request), **target).delete()
        changed = bool(deleted)
    key = "card_set" if "card_set" in target else "card"
    count = Reaction.objects.filter(**{key: target[key]}).count()
    return Response({"liked": add, "like_count": count}), changed


class LikeSetView(APIView):
    def post(self, request: Request, slug: str) -> Response:
        card_set = get_object_or_404(CardSet, slug=slug, status=CardSet.Status.PUBLISHED)
        response, liked = _toggle_reaction(request, True, card_set=card_set)
        if liked:
            notify(card_set.creator, me(request), Notification.Kind.SET_LIKE, card_set=card_set)
        return response

    def delete(self, request: Request, slug: str) -> Response:
        card_set = get_object_or_404(CardSet, slug=slug)
        response, _ = _toggle_reaction(request, False, card_set=card_set)
        withdraw(card_set.creator, me(request), Notification.Kind.SET_LIKE, card_set=card_set)
        return response


class LikeCardView(APIView):
    def post(self, request: Request, card_id) -> Response:
        card = get_object_or_404(
            CardDefinition.objects.select_related("card_set__creator"),
            id=card_id,
            card_set__status=CardSet.Status.PUBLISHED,
        )
        response, liked = _toggle_reaction(request, True, card=card)
        if liked:
            notify(
                card.card_set.creator,
                me(request),
                Notification.Kind.CARD_LIKE,
                card_set=card.card_set,
                card=card,
            )
        return response

    def delete(self, request: Request, card_id) -> Response:
        card = get_object_or_404(
            CardDefinition.objects.select_related("card_set__creator"), id=card_id
        )
        response, _ = _toggle_reaction(request, False, card=card)
        withdraw(
            card.card_set.creator,
            me(request),
            Notification.Kind.CARD_LIKE,
            card_set=card.card_set,
            card=card,
        )
        return response


class FollowSetView(APIView):
    def post(self, request: Request, slug: str) -> Response:
        card_set = visible_set(slug)
        SetFollow.objects.get_or_create(user=me(request), card_set=card_set)
        return Response({"following": True, "follower_count": card_set.set_followers.count()})

    def delete(self, request: Request, slug: str) -> Response:
        card_set = get_object_or_404(CardSet, slug=slug)
        SetFollow.objects.filter(user=me(request), card_set=card_set).delete()
        return Response({"following": False, "follower_count": card_set.set_followers.count()})


def visible_set(slug: str) -> CardSet:
    return get_object_or_404(CardSet, slug=slug, status=CardSet.Status.PUBLISHED)


def thread(card_set: CardSet, viewer) -> tuple[list[Comment], dict[str, Any]]:
    """The whole thread for a set, in two passes.

    Top-level comments come back oldest first with their replies attached, which
    is one query for each level rather than one per comment. A removed comment
    is only worth keeping when something hangs off it, so childless tombstones
    are dropped here rather than shown as gaps.
    """
    rows = list(Comment.objects.filter(card_set=card_set).select_related("author__profile"))
    replies: dict[Any, list[Comment]] = {}
    for row in rows:
        if row.parent_id:
            replies.setdefault(row.parent_id, []).append(row)
    tops = [
        row for row in rows if row.parent_id is None and (not row.removed or replies.get(row.pk))
    ]
    context: dict[str, Any] = {
        "viewer": viewer,
        "creator_id": card_set.creator_id,
        "replies": replies,
        # Tombstones are scaffolding, not comments, so they are not counted.
        "count": sum(1 for row in rows if not row.removed),
    }
    return tops, context


class SetCommentsView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    throttle_scope = "comments"

    def get_throttles(self):
        # Reading a thread should not spend anyone's write budget.
        return [] if self.request.method == "GET" else super().get_throttles()

    def get(self, request: Request, slug: str) -> Response:
        card_set = visible_set(slug)
        viewer = request.user if request.user.is_authenticated else None
        tops, context = thread(card_set, viewer)
        return Response(
            {
                "count": context["count"],
                "results": CommentSerializer(tops, many=True, context=context).data,
            }
        )

    def post(self, request: Request, slug: str) -> Response:
        card_set = visible_set(slug)
        serializer = CommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        body = serializer.validated_data["body"].strip()
        if not body:
            raise ValidationError("Write something first.")

        parent = None
        if serializer.validated_data.get("parent_id"):
            parent = get_object_or_404(
                Comment, id=serializer.validated_data["parent_id"], card_set=card_set
            )
            # Replies stop at one level: a reply to a reply joins the same run.
            if parent.parent is not None:
                parent = parent.parent
            if parent.removed:
                raise ValidationError("That comment was removed.")

        comment = Comment.objects.create(
            card_set=card_set, author=me(request), parent=parent, body=body
        )
        if parent is None:
            notify(
                card_set.creator,
                me(request),
                Notification.Kind.SET_COMMENT,
                card_set=card_set,
                comment=comment,
            )
        else:
            notify(
                parent.author,
                me(request),
                Notification.Kind.COMMENT_REPLY,
                card_set=card_set,
                comment=comment,
            )
        context: dict[str, Any] = {
            "viewer": request.user,
            "creator_id": card_set.creator_id,
            "replies": {},
        }
        return Response(
            CommentSerializer(comment, context=context).data, status=status.HTTP_201_CREATED
        )


class CommentView(APIView):
    def delete(self, request: Request, comment_id) -> Response:
        comment = get_object_or_404(
            Comment.objects.select_related("card_set"), id=comment_id, deleted_at__isnull=True
        )
        user = me(request)
        if comment.author_id != user.pk and comment.card_set.creator_id != user.pk:
            raise PermissionDenied("That is not yours to remove.")
        if comment.replies.exists():
            # Something hangs off it, so it stays as a tombstone.
            comment.deleted_at = timezone.now()
            comment.save(update_fields=["deleted_at"])
        else:
            comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportView(APIView):
    throttle_scope = "reports"

    def post(self, request: Request) -> Response:
        serializer = ReportWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        report = Report(reporter=me(request), reason=data["reason"], details=data["details"])
        if data.get("set_slug"):
            report.card_set = get_object_or_404(CardSet, slug=data["set_slug"])
        elif data.get("card_id"):
            report.card = get_object_or_404(CardDefinition, id=data["card_id"])
        elif data.get("comment_id"):
            report.comment = get_object_or_404(Comment, id=data["comment_id"])
        else:
            report.reported_user = public_user(data["username"])
        report.save()
        return Response({"id": str(report.id)}, status=status.HTTP_201_CREATED)


class SearchView(APIView):
    """One box, four result lists. Postgres full-text for sets and cards, a plain
    match for usernames, and tags, which match either way: a tag is a result in
    its own right and it also pulls in the sets and cards carrying it."""

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()[:100]
        if len(q) < 2:
            return Response({"query": q, "users": [], "sets": [], "cards": [], "tags": []})

        slug = tagging.slugify_tag(q)
        tags = (
            Tag.objects.filter(Q(slug__icontains=slug or q) | Q(label__icontains=q))
            .annotate(
                set_count=Count(
                    "set_tags", filter=Q(set_tags__card_set__status=CardSet.Status.PUBLISHED)
                )
            )
            .order_by("-set_count", "slug")[:10]
        )
        tag_slugs = [t.slug for t in tags]

        query = SearchQuery(q, search_type="websearch")
        set_vector = SearchVector("title", weight="A") + SearchVector("description", weight="B")
        sets = (
            with_counts(CardSet.objects.filter(status=CardSet.Status.PUBLISHED), request.user)
            .annotate(rank=SearchRank(set_vector, query))
            .filter(Q(rank__gt=0) | Q(title__icontains=q) | Q(set_tags__tag__slug__in=tag_slugs))
            .distinct()
            .order_by("-rank", "-like_count")[:10]
        )
        card_vector = SearchVector("title", weight="A") + SearchVector("description", weight="B")
        cards = (
            CardDefinition.objects.filter(card_set__status=CardSet.Status.PUBLISHED)
            .select_related("image", "card_set")
            .prefetch_related("card_tags__tag")
            .annotate(rank=SearchRank(card_vector, query))
            .filter(Q(rank__gt=0) | Q(title__icontains=q) | Q(card_tags__tag__slug__in=tag_slugs))
            .distinct()
            .order_by("-rank")[:10]
        )
        users = (
            User.objects.filter(is_active=True)
            .filter(Q(username__icontains=q) | Q(profile__display_name__icontains=q))
            .select_related("profile")
            .order_by("username")[:10]
        )
        found = list(cards)
        card_data = CardSerializer(found, many=True).data
        for row, card in zip(card_data, found, strict=True):
            row["set_slug"] = card.card_set.slug
            row["set_title"] = card.card_set.title
        return Response(
            {
                "query": q,
                "users": CreatorSerializer(users, many=True).data,
                "sets": CardSetSerializer(sets, many=True).data,
                "cards": card_data,
                "tags": [
                    {"slug": t.slug, "label": t.label, "set_count": t.set_count} for t in tags
                ],
            }
        )


RECENT_PULLS = 6


class MyPacksView(APIView):
    """The packs page: every set this collector follows, with what is waiting.

    Sets with a free pack come first, then ones the collector has enough points
    for, then the most recently followed. Everything is fetched in a handful of
    queries regardless of how many sets are followed.
    """

    def get(self, request: Request) -> Response:
        user = me(request)
        followed = dict(
            SetFollow.objects.filter(
                user=user, card_set__status=CardSet.Status.PUBLISHED
            ).values_list("card_set_id", "created_at")
        )
        if not followed:
            return Response({"results": [], "free_count": 0})

        sets = with_counts(CardSet.objects.filter(id__in=followed), user)
        unlimited = actions.has_unlimited_packs(user)
        used_today = set(
            PackOpening.objects.filter(
                user=user,
                card_set_id__in=followed,
                kind=PackOpening.Kind.FREE,
                opened_on=timezone.now().date(),
            ).values_list("card_set_id", flat=True)
        )
        points = dict(
            SetPoints.objects.filter(user=user, card_set_id__in=followed).values_list(
                "card_set_id", "balance"
            )
        )
        holdings: dict = {
            row["card__card_set_id"]: (row["distinct_cards"], row["copies"])
            for row in OwnedCard.objects.filter(owner=user, card__card_set_id__in=followed)
            .values("card__card_set_id")
            .annotate(distinct_cards=Count("card_id", distinct=True), copies=Count("id"))
        }
        # Choose recent cards per set so activity in one set cannot starve another.
        newest: dict = {}
        for row in (
            OwnedCard.objects.filter(owner=user, card__card_set_id__in=followed)
            .values("card__card_set_id", "card_id")
            .annotate(last=Max("acquired_at"))
        ):
            newest.setdefault(row["card__card_set_id"], []).append((row["last"], row["card_id"]))
        wanted: dict = {}
        for set_id, rows in newest.items():
            rows.sort(key=lambda r: r[0], reverse=True)
            wanted[set_id] = [card_id for _, card_id in rows[:RECENT_PULLS]]

        faces = {
            card.id: card
            for card in CardDefinition.objects.filter(
                id__in=[c for ids in wanted.values() for c in ids]
            )
            .select_related("image", "card_set")
            .prefetch_related("card_tags__tag")
        }
        latest = {set_id: [faces[c] for c in ids if c in faces] for set_id, ids in wanted.items()}
        resets_at = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
            days=1
        )

        rows = []
        for card_set in sets:
            free = unlimited or card_set.id not in used_today
            distinct, copies = holdings.get(card_set.id, (0, 0))
            rows.append(
                {
                    "card_set": card_set,
                    "free_available": free,
                    "resets_at": resets_at,
                    "points": points.get(card_set.id, 0),
                    "pack_cost": actions.EXTRA_PACK_POINT_COST,
                    "owned_count": distinct,
                    "card_count": card_set.card_count,
                    "duplicate_count": max(copies - distinct, 0),
                    "recent_cards": latest.get(card_set.id, []),
                    "followed_at": followed[card_set.id],
                }
            )
        rows.sort(
            key=lambda r: (
                not r["free_available"],
                r["points"] < r["pack_cost"],
                -r["followed_at"].timestamp(),
            )
        )
        return Response(
            {
                "results": PackEntrySerializer(rows, many=True).data,
                "free_count": sum(1 for r in rows if r["free_available"]),
            }
        )


class NotificationsView(APIView):
    def get(self, request: Request) -> Response:
        user = me(request)
        rows = Notification.objects.filter(recipient=user).select_related(
            "actor__profile", "card_set", "card", "comment"
        )
        paginator = NotificationPagination()
        page = paginator.paginate_queryset(rows, request) or []
        response = paginator.get_paginated_response(NotificationSerializer(page, many=True).data)
        response.data["unread"] = unread_count(user)
        return response

    def post(self, request: Request) -> Response:
        user = me(request)
        rows = Notification.objects.filter(recipient=user, read_at__isnull=True)
        wanted = request.data.get("id") if isinstance(request.data, dict) else None
        if wanted:
            rows = rows.filter(id=wanted)
        rows.update(read_at=timezone.now())
        return Response({"unread": unread_count(user)})
