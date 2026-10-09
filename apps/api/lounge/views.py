from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import EmailVerified
from billing.actions import active_period, lock_accounts
from cards.models import CardSet
from cards.serializers import CardSerializer, CreatorSerializer
from packs.models import OwnedCard

from .models import Attachment, Block, Post, Reply, Vote
from .serializers import PostWriteSerializer, ReplyWriteSerializer


def blocked_ids(user) -> set:
    if not user.is_authenticated:
        return set()
    links = Block.objects.filter(Q(user=user) | Q(blocked=user)).values_list(
        "user_id", "blocked_id"
    )
    return {other if owner == user.pk else owner for owner, other in links}


def visible_posts(user):
    return Post.objects.exclude(author_id__in=blocked_ids(user))


def is_subscriber(user) -> bool:
    return bool(settings.MONETIZATION_ENABLED and active_period(user))


def author_badge(author, subscribers: set) -> bool:
    return author.pk in subscribers and getattr(
        getattr(author, "membershipsettings", None), "show_badge", True
    )


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


def post_data(post, viewer, subscriber_authors: set) -> dict:
    removed = post.deleted_at is not None
    return {
        "id": str(post.pk),
        "title": "Removed post" if removed else post.title,
        "body": "" if removed else post.body,
        "author": None if removed else CreatorSerializer(post.author).data,
        "author_badge": not removed and author_badge(post.author, subscriber_authors),
        "created_at": post.created_at,
        "removed": removed,
        "style": "binder"
        if post.style == Post.Style.BINDER and post.author_id in subscriber_authors
        else "plain",
        "can_delete": viewer.is_authenticated and (viewer.pk == post.author_id or viewer.is_staff),
        "likes": post.like_count,
        "liked": post.liked,
        "reply_count": post.reply_count,
        "cards": []
        if removed
        else [
            showcase_card(attachment.owned_card.card)
            if attachment.owned_card
            and attachment.owned_card.owner_id == post.author_id
            and attachment.owned_card.card.card_set.status
            in {CardSet.Status.PUBLISHED, CardSet.Status.DELETED}
            else None
            for attachment in post.attachments.all()
        ],
    }


def post_rows(user):
    attachments = Attachment.objects.select_related(
        "owned_card__card__image", "owned_card__card__card_set__creator__profile"
    ).prefetch_related("owned_card__card__card_tags__tag")
    votes = (
        Vote.objects.filter(post=OuterRef("pk"), user=user)
        if user.is_authenticated
        else Vote.objects.none()
    )
    return (
        visible_posts(user)
        .select_related("author__profile", "author__membershipsettings")
        .prefetch_related(Prefetch("attachments", queryset=attachments))
        .annotate(
            like_count=Count("votes", distinct=True),
            reply_count=Count(
                "replies",
                filter=Q(replies__deleted_at__isnull=True)
                & ~Q(replies__author_id__in=blocked_ids(user)),
                distinct=True,
            ),
            liked=Exists(votes),
        )
    )


def subscriber_ids(posts) -> set:
    from billing.models import SubscriptionPeriod

    if not settings.MONETIZATION_ENABLED:
        return set()
    now = timezone.now()
    return set(
        SubscriptionPeriod.objects.filter(
            subscription__user_id__in=[post.author_id for post in posts],
            subscription__user__is_active=True,
            starts_at__lte=now,
            ends_at__gt=now,
        ).values_list("subscription__user_id", flat=True)
    )


class Pagination(PageNumberPagination):
    page_size = 20


class LoungeView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, EmailVerified]
    throttle_scope = "lounge.post"

    def get_permissions(self):
        return (
            [permissions.AllowAny()] if self.request.method == "GET" else super().get_permissions()
        )

    def get_throttles(self):
        return [] if self.request.method == "GET" else super().get_throttles()

    def get(self, request: Request) -> Response:
        if not settings.LOUNGE_ENABLED:
            return Response(
                {
                    "enabled": False,
                    "count": 0,
                    "next": None,
                    "previous": None,
                    "results": [],
                    "subscriber": False,
                }
            )
        sort = request.query_params.get("sort", "new")
        window = request.query_params.get("window", "week")
        if sort not in {"new", "top", "active"} or window not in {"today", "week", "month", "all"}:
            raise ValidationError("Choose New, Top or Active and a valid time window.")
        rows = post_rows(request.user).filter(deleted_at__isnull=True)
        if sort == "top" and window != "all":
            since = timezone.now() - timedelta(days={"today": 1, "week": 7, "month": 30}[window])
            rows = rows.filter(created_at__gte=since)
        rows = rows.order_by(
            *{
                "new": ["-created_at", "-id"],
                "top": ["-like_count", "-created_at", "-id"],
                "active": ["-active_at", "-id"],
            }[sort]
        )
        paginator = Pagination()
        page: list[Any] = paginator.paginate_queryset(rows, request) or []
        authors = subscriber_ids(page)
        response = paginator.get_paginated_response(
            [post_data(post, request.user, authors) for post in page]
        )
        response.data.update(
            enabled=True, subscriber=request.user.is_authenticated and is_subscriber(request.user)
        )
        return response

    @transaction.atomic
    def post(self, request: Request) -> Response:
        require_enabled()
        serializer = PostWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assert isinstance(request.user, User)
        user = lock_accounts([request.user.pk])[request.user.pk]
        if not user.is_active:
            raise PermissionDenied("This account is closed.")
        data = serializer.validated_data
        if not is_subscriber(user) and (len(data["card_ids"]) > 1 or data["style"] != "plain"):
            raise PermissionDenied(
                "Multiple-card layouts and display styles need an active membership."
            )
        cards = list(
            OwnedCard.objects.select_for_update()
            .filter(
                owner=user,
                pk__in=data["card_ids"],
                card__card_set__status__in=[CardSet.Status.PUBLISHED, CardSet.Status.DELETED],
            )
            .order_by("pk")
        )
        if len(cards) != len(data["card_ids"]):
            raise ValidationError("Choose cards currently in your own collection.")
        post = Post.objects.create(
            author=user, title=data["title"], body=data["body"], style=data["style"]
        )
        Attachment.objects.bulk_create(
            [
                Attachment(post=post, owned_card_id=pk, position=position)
                for position, pk in enumerate(data["card_ids"])
            ]
        )
        row = post_rows(user).get(pk=post.pk)
        return Response(post_data(row, user, subscriber_ids([row])), status=201)


def require_enabled() -> None:
    if not settings.LOUNGE_ENABLED:
        raise NotFound("The Lounge is not available yet.")


class PostView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request: Request, post_id) -> Response:
        require_enabled()
        post = get_object_or_404(post_rows(request.user), pk=post_id)
        return Response(post_data(post, request.user, subscriber_ids([post])))

    @transaction.atomic
    def delete(self, request: Request, post_id) -> Response:
        require_enabled()
        post = get_object_or_404(Post.objects.select_for_update(), pk=post_id)
        if post.author_id != request.user.pk and not request.user.is_staff:
            raise PermissionDenied("That post is not yours to remove.")
        Post.objects.filter(pk=post.pk).update(deleted_at=timezone.now())
        return Response(status=204)


class RepliesView(APIView):
    permission_classes = [EmailVerified]
    throttle_scope = "lounge.reply"

    def get_permissions(self):
        return (
            [permissions.AllowAny()] if self.request.method == "GET" else super().get_permissions()
        )

    def get_throttles(self):
        return [] if self.request.method == "GET" else super().get_throttles()

    def get(self, request: Request, post_id) -> Response:
        require_enabled()
        post = get_object_or_404(visible_posts(request.user), pk=post_id)
        parent_id = request.query_params.get("parent_id")
        if parent_id:
            try:
                from uuid import UUID

                parent = UUID(parent_id)
            except ValueError as exc:
                raise ValidationError("Invalid reply thread.") from exc
            get_object_or_404(Reply, pk=parent, post=post, parent__isnull=True)
        else:
            parent = None
        blocked = blocked_ids(request.user)
        votes = (
            Vote.objects.filter(reply=OuterRef("pk"), user=request.user)
            if request.user.is_authenticated
            else Vote.objects.none()
        )
        rows = (
            Reply.objects.filter(post=post, parent_id=parent)
            .select_related("author__profile", "author__membershipsettings")
            .annotate(
                like_count=Count("votes", distinct=True),
                child_count=Count(
                    "children", filter=~Q(children__author_id__in=blocked), distinct=True
                ),
                liked=Exists(votes),
            )
        )
        rows = rows.order_by("created_at", "id")
        if parent:
            rows = rows.exclude(author_id__in=blocked)
        paginator = Pagination()
        page = paginator.paginate_queryset(rows, request) or []
        subscribers = subscriber_ids(page)

        return paginator.get_paginated_response(
            [reply_data(reply, request.user, subscribers, blocked) for reply in page]
        )

    @transaction.atomic
    def post(self, request: Request, post_id) -> Response:
        require_enabled()
        assert isinstance(request.user, User)
        serializer = ReplyWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post_owner = get_object_or_404(Post, pk=post_id).author_id
        actors = [request.user.pk, post_owner]
        if serializer.validated_data.get("parent_id"):
            actors.append(
                get_object_or_404(
                    Reply, pk=serializer.validated_data["parent_id"], post_id=post_id
                ).author_id
            )
        user = lock_accounts(actors)[request.user.pk]
        if not user.is_active:
            raise PermissionDenied("This account is closed.")
        post = get_object_or_404(
            visible_posts(request.user).select_for_update(), pk=post_id, deleted_at__isnull=True
        )
        parent = None
        if serializer.validated_data.get("parent_id"):
            parent = get_object_or_404(
                Reply,
                pk=serializer.validated_data["parent_id"],
                post=post,
                parent__isnull=True,
                deleted_at__isnull=True,
            )
            if parent.author_id in blocked_ids(request.user):
                raise PermissionDenied("You cannot reply to a blocked collector.")
        reply = Reply.objects.create(
            post=post, author=request.user, parent=parent, body=serializer.validated_data["body"]
        )
        Post.objects.filter(pk=post.pk).update(active_at=timezone.now())
        return Response(reply_data(reply, user, subscriber_ids([reply]), set()), status=201)


def reply_data(reply, viewer, subscribers: set, blocked: set) -> dict[str, Any]:
    removed = reply.deleted_at is not None or reply.author_id in blocked
    return {
        "id": str(reply.pk),
        "body": "" if removed else reply.body,
        "author": None if removed else CreatorSerializer(reply.author).data,
        "author_badge": not removed and author_badge(reply.author, subscribers),
        "parent_id": str(reply.parent_id) if reply.parent_id else None,
        "created_at": reply.created_at,
        "removed": removed,
        "can_delete": viewer.is_authenticated and (viewer.pk == reply.author_id or viewer.is_staff),
        "likes": 0 if removed else getattr(reply, "like_count", 0),
        "liked": False if removed else getattr(reply, "liked", False),
        "child_count": getattr(reply, "child_count", 0),
    }


class ReplyView(APIView):
    @transaction.atomic
    def delete(self, request: Request, reply_id) -> Response:
        require_enabled()
        reply = get_object_or_404(Reply.objects.select_for_update(), pk=reply_id)
        if reply.author_id != request.user.pk and not request.user.is_staff:
            raise PermissionDenied("That reply is not yours to remove.")
        Reply.objects.filter(pk=reply.pk).update(deleted_at=timezone.now())
        return Response(status=204)


class VoteView(APIView):
    permission_classes = [EmailVerified]
    throttle_scope = "lounge.vote"

    @transaction.atomic
    def post(self, request: Request, post_id=None, reply_id=None) -> Response:
        return self.change(request, True, post_id, reply_id)

    @transaction.atomic
    def delete(self, request: Request, post_id=None, reply_id=None) -> Response:
        return self.change(request, False, post_id, reply_id)

    def change(self, request, liked, post_id, reply_id):
        require_enabled()
        initial = get_object_or_404(Reply if reply_id else Post, pk=reply_id or post_id)
        actors = [request.user.pk, initial.author_id]
        if reply_id:
            actors.append(initial.post.author_id)
        user = lock_accounts(actors)[request.user.pk]
        if not user.is_active:
            raise PermissionDenied("This account is closed.")
        if reply_id:
            target = get_object_or_404(
                Reply.objects.select_for_update(), pk=reply_id, deleted_at__isnull=True
            )
            get_object_or_404(
                visible_posts(request.user), pk=target.post_id, deleted_at__isnull=True
            )
            if target.author_id in blocked_ids(request.user):
                raise NotFound()
            fields = {"reply": target}
        else:
            target = get_object_or_404(
                visible_posts(request.user).select_for_update(), pk=post_id, deleted_at__isnull=True
            )
            fields = {"post": target}
        if liked:
            Vote.objects.get_or_create(user=request.user, **fields)
        else:
            Vote.objects.filter(user=request.user, **fields).delete()
        return Response({"liked": liked, "likes": Vote.objects.filter(**fields).count()})


class BlocksView(APIView):
    throttle_scope = "lounge.block"

    def get(self, request: Request) -> Response:
        require_enabled()
        assert isinstance(request.user, User)
        return Response(
            CreatorSerializer(
                [
                    link.blocked
                    for link in Block.objects.filter(user=request.user).select_related(
                        "blocked__profile"
                    )
                ],
                many=True,
            ).data
        )

    @transaction.atomic
    def post(self, request: Request, username: str) -> Response:
        require_enabled()
        assert isinstance(request.user, User)
        target = get_object_or_404(User, username=username.lower(), is_active=True)
        if target.pk == request.user.pk:
            raise ValidationError("You cannot block yourself.")
        user = lock_accounts([request.user.pk, target.pk])[request.user.pk]
        if not user.is_active:
            raise PermissionDenied("This account is closed.")
        Block.objects.get_or_create(user=request.user, blocked=target)
        return Response(status=204)

    @transaction.atomic
    def delete(self, request: Request, username: str) -> Response:
        require_enabled()
        assert isinstance(request.user, User)
        target = User.objects.filter(username=username.lower()).first()
        lock_accounts([request.user.pk, *([target.pk] if target else [])])
        Block.objects.filter(user=request.user, blocked__username=username.lower()).delete()
        return Response(status=204)
