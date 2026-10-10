from datetime import timedelta
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import EmailVerified
from billing.actions import lock_accounts
from cards.models import CardSet
from packs.models import OwnedCard
from social.blocks import blocked_ids
from social.models import Notification
from social.notifications import notify

from . import data
from .data import (
    BINDER_CARDS,
    POST_CARDS,
    REPLY_CARDS,
    SUPPORTER_REPLY_CARDS,
    is_subscriber,
    post_data,
    post_rows,
    reply_data,
    reply_rows,
    subscriber_ids,
    visible_posts,
)
from .models import Attachment, Post, PostRead, Reply, SavedFolder, SavedPost, Vote
from .serializers import (
    FolderSerializer,
    PostEditSerializer,
    PostWriteSerializer,
    ReplyEditSerializer,
    ReplyWriteSerializer,
    SaveSerializer,
    VoteSerializer,
)

MAX_FOLDERS = 20


class Pagination(PageNumberPagination):
    page_size = 20


def require_enabled() -> None:
    if not settings.LOUNGE_ENABLED:
        raise NotFound("The Lounge is not available yet.")


def signed_in(request: Request) -> User:
    assert isinstance(request.user, User)
    return request.user


def active_user(request: Request, *others) -> User:
    assert isinstance(request.user, User)
    user = lock_accounts([request.user.pk, *others])[request.user.pk]
    if not user.is_active:
        raise PermissionDenied("This account is closed.")
    return user


def own_cards(user: User, card_ids: list) -> list:
    cards = list(
        OwnedCard.objects.select_for_update()
        .filter(
            owner=user,
            pk__in=card_ids,
            card__card_set__status__in=[CardSet.Status.PUBLISHED, CardSet.Status.DELETED],
        )
        .order_by("pk")
    )
    if len(cards) != len(card_ids):
        raise ValidationError("Choose cards currently in your own collection.")
    return cards


def notify_mentions(author: User, text: str, already: set, **target) -> None:
    names = data.mentioned_usernames(text)
    if not names:
        return
    for person in User.objects.filter(username__in=names, is_active=True):
        if person.pk != author.pk and person.pk not in already:
            notify(person, author, Notification.Kind.LOUNGE_MENTION, **target)


def page_of(rows, request: Request, build) -> Response:
    paginator = Pagination()
    page: list[Any] = paginator.paginate_queryset(rows, request) or []
    return paginator.get_paginated_response(build(page))


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
        params = request.query_params
        sort = params.get("sort", "new")
        window = params.get("window", "week")
        topic = params.get("topic", "")
        if sort not in {"new", "top", "active"} or window not in {"today", "week", "month", "all"}:
            raise ValidationError("Choose New, Top or Active and a valid time window.")
        if topic and topic not in Post.Topic.values:
            raise ValidationError("Choose a Lounge topic.")
        if "new_since" in params:
            try:
                since = parse_datetime(params["new_since"])
            except ValueError:
                since = None
            if since is None or timezone.is_naive(since):
                raise ValidationError("Use a full timestamp for new discussions.")
            rows = visible_posts(request.user).filter(
                deleted_at__isnull=True, draft=False, created_at__gt=since
            )
            if topic:
                rows = rows.filter(topic=topic)
            return Response({"new_count": rows.count()})
        rows = post_rows(request.user).filter(deleted_at__isnull=True, draft=False)
        if params.get("saved"):
            if not request.user.is_authenticated:
                raise PermissionDenied("Log in to see saved discussions.")
            saved = Q(saves__user=request.user)
            folder = params.get("folder")
            if folder == "none":
                saved &= Q(saves__folder__isnull=True)
            elif folder:
                if not folder.isdigit():
                    raise ValidationError("Choose a saved folder.")
                saved &= Q(saves__folder_id=int(folder))
            rows = rows.filter(saved)
        if topic:
            rows = rows.filter(topic=topic)
        query = params.get("q", "").strip()[:100]
        for word in query.split()[:6]:
            rows = rows.filter(
                Q(title__icontains=word)
                | Q(body__icontains=word)
                | Q(author__username__icontains=word)
            )
        if sort == "top" and window != "all":
            since = timezone.now() - timedelta(days={"today": 1, "week": 7, "month": 30}[window])
            rows = rows.filter(created_at__gte=since)
        rows = rows.order_by(
            *{
                "new": ["-created_at", "-id"],
                "top": ["-score", "-created_at", "-id"],
                "active": ["-active_at", "-id"],
            }[sort]
        )
        response = page_of(
            rows,
            request,
            lambda page: [post_data(post, request.user, subscriber_ids(page)) for post in page],
        )
        response.data.update(enabled=True, subscriber=is_subscriber(request.user))
        return response

    @transaction.atomic
    def post(self, request: Request) -> Response:
        require_enabled()
        serializer = PostWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = active_user(request)
        values = serializer.validated_data
        supporter = is_subscriber(user)
        if values["style"] == "binder" and not supporter:
            raise PermissionDenied("Binder layouts are for supporters.")
        if values["draft"] and not supporter:
            raise PermissionDenied("Drafts are for supporters.")
        limit = BINDER_CARDS if values["style"] == "binder" else POST_CARDS
        if len(values["card_ids"]) > limit:
            raise ValidationError(f"Choose up to {limit} cards.")
        own_cards(user, values["card_ids"])
        post = Post.objects.create(
            author=user,
            title=values["title"],
            body=values["body"],
            style=values["style"],
            topic=values["topic"],
            draft=values["draft"],
        )
        Attachment.objects.bulk_create(
            [
                Attachment(post=post, owned_card_id=pk, position=position)
                for position, pk in enumerate(values["card_ids"])
            ]
        )
        if not post.draft:
            notify_mentions(user, f"{post.title} {post.body}", set(), lounge_post=post)
        row = post_rows(user).get(pk=post.pk)
        return Response(post_data(row, user, subscriber_ids([row])), status=201)


class PostView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request: Request, post_id) -> Response:
        require_enabled()
        post = get_object_or_404(post_rows(request.user), pk=post_id)
        if request.user.is_authenticated and not post.draft:
            PostRead.objects.update_or_create(
                user=request.user, post=post, defaults={"read_at": timezone.now()}
            )
        return Response(post_data(post, request.user, subscriber_ids([post])))

    @transaction.atomic
    def patch(self, request: Request, post_id) -> Response:
        require_enabled()
        serializer = PostEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = active_user(request)
        post = get_object_or_404(
            Post.objects.select_for_update(), pk=post_id, author=user, deleted_at__isnull=True
        )
        values = serializer.validated_data
        changes = {key: values[key] for key in ("title", "body", "topic") if key in values}
        now = timezone.now()
        publishing = values["publish"] and post.draft
        if publishing:
            # A published draft enters the feed as new, not at the time it was started.
            changes.update(draft=False, created_at=now, active_at=now)
        elif changes and not post.draft:
            changes["edited_at"] = now
        if changes:
            Post.objects.filter(pk=post.pk).update(**changes)
        row = post_rows(user).get(pk=post.pk)
        if publishing:
            notify_mentions(user, f"{row.title} {row.body}", set(), lounge_post=row)
        return Response(post_data(row, user, subscriber_ids([row])))

    @transaction.atomic
    def delete(self, request: Request, post_id) -> Response:
        require_enabled()
        post = get_object_or_404(Post.objects.select_for_update(), pk=post_id)
        if post.author_id != request.user.pk and not request.user.is_staff:
            raise PermissionDenied("That post is not yours to remove.")
        if post.draft:
            post.delete()
        else:
            Post.objects.filter(pk=post.pk).update(deleted_at=timezone.now())
        return Response(status=204)


class DraftsView(APIView):
    def get(self, request: Request) -> Response:
        require_enabled()
        user = signed_in(request)
        rows = post_rows(user).filter(author=user, draft=True, deleted_at=None)
        return page_of(
            rows.order_by("-created_at"),
            request,
            lambda page: [post_data(post, request.user, subscriber_ids(page)) for post in page],
        )


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
        post = get_object_or_404(visible_posts(request.user), pk=post_id, draft=False)
        parent_id = request.query_params.get("parent_id")
        parent = None
        if parent_id:
            try:
                parent = get_object_or_404(
                    Reply, pk=UUID(parent_id), post=post, parent__isnull=True
                )
            except ValueError as exc:
                raise ValidationError("Invalid reply thread.") from exc
        sort = request.query_params.get("sort", "top" if parent is None else "oldest")
        if sort not in {"top", "new", "oldest"}:
            raise ValidationError("Sort replies by Top, New or Oldest.")
        blocked = blocked_ids(request.user)
        rows = reply_rows(request.user, post, parent).order_by(
            *{
                "top": ["-score", "created_at", "id"],
                "new": ["-created_at", "-id"],
                "oldest": ["created_at", "id"],
            }[sort]
        )
        if parent:
            rows = rows.exclude(author_id__in=blocked)
        return page_of(
            rows,
            request,
            lambda page: [
                reply_data(reply, request.user, subscriber_ids(page), blocked, post.author_id)
                for reply in page
            ],
        )

    @transaction.atomic
    def post(self, request: Request, post_id) -> Response:
        require_enabled()
        serializer = ReplyWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        target = get_object_or_404(Post, pk=post_id, draft=False)
        actors = [target.author_id]
        if values.get("parent_id"):
            actors.append(get_object_or_404(Reply, pk=values["parent_id"], post=target).author_id)
        user = active_user(request, *actors)
        post = get_object_or_404(
            visible_posts(user).select_for_update(), pk=post_id, deleted_at__isnull=True
        )
        parent = None
        if values.get("parent_id"):
            parent = get_object_or_404(
                Reply, pk=values["parent_id"], post=post, parent__isnull=True, deleted_at=None
            )
            if parent.author_id in blocked_ids(user):
                raise PermissionDenied("You cannot reply to a blocked collector.")
        limit = SUPPORTER_REPLY_CARDS if is_subscriber(user) else REPLY_CARDS
        if len(values["card_ids"]) > limit:
            raise ValidationError(f"Choose up to {limit} cards for a reply.")
        own_cards(user, values["card_ids"])
        reply = Reply.objects.create(post=post, author=user, parent=parent, body=values["body"])
        Attachment.objects.bulk_create(
            [
                Attachment(reply=reply, owned_card_id=pk, position=position)
                for position, pk in enumerate(values["card_ids"])
            ]
        )
        Post.objects.filter(pk=post.pk).update(active_at=timezone.now())
        recipient = parent.author if parent else post.author
        notify(
            recipient, user, Notification.Kind.LOUNGE_REPLY, lounge_post=post, lounge_reply=reply
        )
        notify_mentions(user, reply.body, {recipient.pk}, lounge_post=post, lounge_reply=reply)
        row = reply_rows(user, post, parent).get(pk=reply.pk)
        return Response(
            reply_data(row, user, subscriber_ids([row]), set(), post.author_id), status=201
        )


class ReplyView(APIView):
    @transaction.atomic
    def patch(self, request: Request, reply_id) -> Response:
        require_enabled()
        serializer = ReplyEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = active_user(request)
        reply = get_object_or_404(
            Reply.objects.select_for_update(), pk=reply_id, author=user, deleted_at__isnull=True
        )
        Reply.objects.filter(pk=reply.pk).update(
            body=serializer.validated_data["body"], edited_at=timezone.now()
        )
        row = reply_rows(user, reply.post, reply.parent).get(pk=reply.pk)
        return Response(reply_data(row, user, subscriber_ids([row]), set(), reply.post.author_id))

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
        serializer = VoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.change(request, serializer.validated_data["value"], post_id, reply_id)

    @transaction.atomic
    def delete(self, request: Request, post_id=None, reply_id=None) -> Response:
        return self.change(request, 0, post_id, reply_id)

    def change(self, request, value: int, post_id, reply_id):
        require_enabled()
        initial: Any = get_object_or_404(Reply if reply_id else Post, pk=reply_id or post_id)
        actors = [initial.author_id]
        if reply_id:
            actors.append(initial.post.author_id)
        user = active_user(request, *actors)
        fields: dict[str, Any]
        if reply_id:
            reply = get_object_or_404(
                Reply.objects.select_for_update(), pk=reply_id, deleted_at__isnull=True
            )
            get_object_or_404(
                visible_posts(user), pk=reply.post_id, deleted_at__isnull=True, draft=False
            )
            if reply.author_id in blocked_ids(user):
                raise NotFound()
            fields = {"reply": reply}
        else:
            fields = {
                "post": get_object_or_404(
                    visible_posts(user).select_for_update(),
                    pk=post_id,
                    deleted_at__isnull=True,
                    draft=False,
                )
            }
        if value:
            Vote.objects.update_or_create(user=user, **fields, defaults={"value": value})
        else:
            Vote.objects.filter(user=user, **fields).delete()
        votes = Vote.objects.filter(**fields)
        return Response({"score": sum(votes.values_list("value", flat=True)), "my_vote": value})


class SaveView(APIView):
    @transaction.atomic
    def post(self, request: Request, post_id) -> Response:
        require_enabled()
        serializer = SaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = active_user(request)
        post = get_object_or_404(visible_posts(user), pk=post_id, draft=False)
        folder = None
        if serializer.validated_data.get("folder_id"):
            if not is_subscriber(user):
                raise PermissionDenied("Folders are for supporters.")
            folder = get_object_or_404(
                SavedFolder, pk=serializer.validated_data["folder_id"], user=user
            )
        SavedPost.objects.update_or_create(user=user, post=post, defaults={"folder": folder})
        return Response({"saved": True, "folder_id": folder.pk if folder else None})

    def delete(self, request: Request, post_id) -> Response:
        require_enabled()
        SavedPost.objects.filter(user=signed_in(request), post_id=post_id).delete()
        return Response({"saved": False, "folder_id": None})


def folder_data(folder) -> dict:
    return {"id": folder.pk, "name": folder.name, "count": getattr(folder, "count", 0)}


class FoldersView(APIView):
    def get(self, request: Request) -> Response:
        require_enabled()
        rows = SavedFolder.objects.filter(user=signed_in(request)).annotate(
            count=Count("savedpost")
        )
        return Response([folder_data(folder) for folder in rows])

    @transaction.atomic
    def post(self, request: Request) -> Response:
        require_enabled()
        serializer = FolderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = active_user(request)
        if not is_subscriber(user):
            raise PermissionDenied("Folders are for supporters.")
        if SavedFolder.objects.filter(user=user).count() >= MAX_FOLDERS:
            raise ValidationError(f"You can have up to {MAX_FOLDERS} folders.")
        folder, _ = SavedFolder.objects.get_or_create(
            user=user, name=serializer.validated_data["name"]
        )
        return Response(folder_data(folder), status=201)


class FolderView(APIView):
    def patch(self, request: Request, folder_id) -> Response:
        require_enabled()
        serializer = FolderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        folder = get_object_or_404(SavedFolder, pk=folder_id, user=signed_in(request))
        name = serializer.validated_data["name"]
        if SavedFolder.objects.filter(user=folder.user, name=name).exclude(pk=folder.pk).exists():
            raise ValidationError("You already have a folder with that name.")
        folder.name = name
        folder.save(update_fields=["name"])
        return Response(folder_data(folder))

    def delete(self, request: Request, folder_id) -> Response:
        require_enabled()
        get_object_or_404(SavedFolder, pk=folder_id, user=signed_in(request)).delete()
        return Response(status=204)
