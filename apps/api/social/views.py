import contextlib
from typing import Any

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from cards.models import CardDefinition, CardSet
from cards.serializers import CardSerializer, CardSetSerializer, CreatorSerializer
from cards.views import with_counts
from packs.models import OwnedCard
from packs.views import with_copies

from .models import SHOWCASE_SLOTS, Comment, Follow, Reaction, Report, ShowcaseSlot
from .serializers import (
    CommentSerializer,
    CommentWriteSerializer,
    ProfilePageSerializer,
    ReportWriteSerializer,
    ShowcaseSlotSerializer,
    ShowcaseWriteSerializer,
)


def me(request: Request) -> User:
    # IsAuthenticated already ran; this just narrows the type.
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
            "avatar_url": user.profile.avatar_url,
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
        Follow.objects.get_or_create(follower=me(request), following=target)
        return Response({"following": True, "follower_count": target.followers.count()})

    def delete(self, request: Request, username: str) -> Response:
        target = public_user(username)
        Follow.objects.filter(follower=me(request), following=target).delete()
        return Response({"following": False, "follower_count": target.followers.count()})


class FollowListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request, username: str, direction: str) -> Response:
        user = public_user(username)
        if direction == "followers":
            people = User.objects.filter(following__following=user)
        else:
            people = User.objects.filter(followers__follower=user)
        people = people.select_related("profile").order_by("username")[:200]
        return Response(CreatorSerializer(people, many=True).data)


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
        positions = [int(s.get("position", -1)) for s in slots]
        if any(p < 0 or p >= SHOWCASE_SLOTS for p in positions) or len(set(positions)) != len(
            positions
        ):
            raise ValidationError(
                f"Positions must be unique and between 0 and {SHOWCASE_SLOTS - 1}."
            )
        with transaction.atomic():
            ShowcaseSlot.objects.filter(user=user).delete()
            ShowcaseSlot.objects.bulk_create(
                [
                    ShowcaseSlot(user=user, position=p, owned_card_id=i)
                    for p, i in zip(positions, ids, strict=True)
                ]
            )
        return Response(ShowcaseSlotSerializer(showcase_for(user), many=True).data)


def _toggle_reaction(request: Request, add: bool, **target) -> Response:
    if add:
        with contextlib.suppress(IntegrityError):
            Reaction.objects.get_or_create(user=me(request), **target)
    else:
        Reaction.objects.filter(user=me(request), **target).delete()
    key = "card_set" if "card_set" in target else "card"
    count = Reaction.objects.filter(**{key: target[key]}).count()
    return Response({"liked": add, "like_count": count})


class LikeSetView(APIView):
    def post(self, request: Request, slug: str) -> Response:
        card_set = get_object_or_404(CardSet, slug=slug, status=CardSet.Status.PUBLISHED)
        return _toggle_reaction(request, True, card_set=card_set)

    def delete(self, request: Request, slug: str) -> Response:
        card_set = get_object_or_404(CardSet, slug=slug)
        return _toggle_reaction(request, False, card_set=card_set)


class LikeCardView(APIView):
    def post(self, request: Request, card_id) -> Response:
        card = get_object_or_404(
            CardDefinition, id=card_id, card_set__status=CardSet.Status.PUBLISHED
        )
        return _toggle_reaction(request, True, card=card)

    def delete(self, request: Request, card_id) -> Response:
        card = get_object_or_404(CardDefinition, id=card_id)
        return _toggle_reaction(request, False, card=card)


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
    """The conversation under a set. Reading is open; writing is not."""

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
        context: dict[str, Any] = {
            "viewer": request.user,
            "creator_id": card_set.creator_id,
            "replies": {},
        }
        return Response(
            CommentSerializer(comment, context=context).data, status=status.HTTP_201_CREATED
        )


class CommentView(APIView):
    """Remove a comment as its author or the set creator."""

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
    """One box, three result lists. Postgres full-text for sets and cards, a
    plain match for usernames. Good enough until the catalogue is much bigger."""

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()[:100]
        if len(q) < 2:
            return Response({"query": q, "users": [], "sets": [], "cards": []})

        query = SearchQuery(q, search_type="websearch")
        set_vector = SearchVector("title", weight="A") + SearchVector("description", weight="B")
        sets = (
            with_counts(CardSet.objects.filter(status=CardSet.Status.PUBLISHED), request.user)
            .annotate(rank=SearchRank(set_vector, query))
            .filter(Q(rank__gt=0) | Q(title__icontains=q))
            .order_by("-rank", "-like_count")[:10]
        )
        card_vector = SearchVector("title", weight="A") + SearchVector("description", weight="B")
        cards = (
            CardDefinition.objects.filter(card_set__status=CardSet.Status.PUBLISHED)
            .select_related("image", "card_set")
            .annotate(rank=SearchRank(card_vector, query))
            .filter(Q(rank__gt=0) | Q(title__icontains=q))
            .order_by("-rank")[:10]
        )
        users = (
            User.objects.filter(is_active=True)
            .filter(Q(username__icontains=q) | Q(profile__display_name__icontains=q))
            .select_related("profile")
            .order_by("username")[:10]
        )
        card_data = CardSerializer(cards, many=True).data
        for row, card in zip(card_data, cards, strict=True):
            row["set_slug"] = card.card_set.slug
            row["set_title"] = card.card_set.title
        return Response(
            {
                "query": q,
                "users": CreatorSerializer(users, many=True).data,
                "sets": CardSetSerializer(sets, many=True).data,
                "cards": card_data,
            }
        )
