from collections.abc import Mapping
from typing import Any, cast

from django.db.models import Count, Exists, OuterRef, Prefetch, Value
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from . import templates
from .models import CardDefinition, CardSet
from .publishing import publish_problems, publish_set
from .serializers import (
    CardSerializer,
    CardSetDetailSerializer,
    CardSetSerializer,
    CardSetWriteSerializer,
    CardWriteSerializer,
    TemplateSerializer,
)


class SetPagination(PageNumberPagination):
    page_size = 24


def with_counts(queryset, user=None):
    """Sets with card/like counts, cards with like counts, and whether `user` liked the set."""
    from social.models import Reaction  # here, not at the top: import cycle

    # Meta.ordering is dropped on GROUP BY queries, so order explicitly.
    cards = (
        CardDefinition.objects.select_related("image")
        .annotate(like_count=Count("reactions"))
        .order_by("position", "created_at")
    )
    queryset = (
        queryset.select_related("creator__profile", "cover")
        .prefetch_related(Prefetch("cards", queryset=cards))
        .annotate(
            card_count=Count("cards", distinct=True),
            like_count=Count("reactions", distinct=True),
            opening_count=Count("pack_openings", distinct=True),
        )
    )
    if user is not None and user.is_authenticated:
        liked = Reaction.objects.filter(user=user, card_set=OuterRef("pk"))
        return queryset.annotate(liked=Exists(liked))
    return queryset.annotate(liked=Value(False))


class TemplateListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        return Response(TemplateSerializer(templates.TEMPLATES, many=True).data)


# ---- public ----


class PublicSetListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        queryset = with_counts(
            CardSet.objects.filter(status=CardSet.Status.PUBLISHED), request.user
        )
        if request.query_params.get("sort") == "popular":
            queryset = queryset.order_by("-like_count", "-opening_count", "-published_at")
        else:
            queryset = queryset.order_by("-published_at")
        paginator = SetPagination()
        page: list[CardSet] = paginator.paginate_queryset(queryset, request) or []
        return paginator.get_paginated_response(CardSetSerializer(page, many=True).data)


class PublicSetDetailView(APIView):
    """Binder view. Drafts are visible to their creator only."""

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request, slug: str) -> Response:
        card_set = get_object_or_404(with_counts(CardSet.objects.all(), request.user), slug=slug)
        visible = card_set.is_published or (
            request.user.is_authenticated and card_set.creator_id == request.user.id
        )
        if not visible:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        data = CardSetDetailSerializer(card_set).data
        data["liked_card_ids"] = liked_card_ids(request.user, card_set)
        return Response(data)


def liked_card_ids(user, card_set: CardSet) -> list[str]:
    from social.models import Reaction  # here, not at the top: import cycle

    if not user.is_authenticated:
        return []
    ids = Reaction.objects.filter(user=user, card__card_set=card_set).values_list(
        "card_id", flat=True
    )
    return [str(i) for i in ids]


# ---- creator ----


def my_set(request: Request, set_id) -> CardSet:
    return get_object_or_404(
        with_counts(CardSet.objects.exclude(status=CardSet.Status.REMOVED), request.user),
        id=set_id,
        creator_id=request.user.id,
    )


def require_draft(card_set: CardSet) -> None:
    if not card_set.is_draft:
        raise ValidationError("Published sets can't be edited.")


class MySetListView(APIView):
    def get(self, request: Request) -> Response:
        queryset = with_counts(
            CardSet.objects.filter(creator_id=request.user.id).exclude(
                status=CardSet.Status.REMOVED
            )
        )
        return Response(CardSetSerializer(queryset, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = CardSetWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        card_set = serializer.save(creator=request.user)
        return Response(
            CardSetSerializer(my_set(request, card_set.id)).data, status=status.HTTP_201_CREATED
        )


class MySetDetailView(APIView):
    def get(self, request: Request, set_id) -> Response:
        return Response(CardSetDetailSerializer(my_set(request, set_id)).data)

    # The mark and pack colour only affect how the set is presented, never a
    # published card's snapshot, so they stay editable after publishing.
    IDENTITY_FIELDS = {
        "mark",
        "pack_colour",
        "pack_finish",
        "pack_layers",
        "binder_colour",
        "emblem_layout",
        "pack_subtitle",
        "pack_text",
        "emblem_shape",
        "emblem_style",
        "emblem_text",
        "emblem_type_scale",
        "mark_scale",
        "pack_size",
    }

    def patch(self, request: Request, set_id) -> Response:
        card_set = my_set(request, set_id)
        data = cast(Mapping[str, Any], request.data)
        if not self.IDENTITY_FIELDS.issuperset(data.keys()):
            require_draft(card_set)
        serializer = CardSetWriteSerializer(
            card_set, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CardSetDetailSerializer(my_set(request, set_id)).data)

    def delete(self, request: Request, set_id) -> Response:
        card_set = my_set(request, set_id)
        if card_set.is_draft:
            card_set.delete()
        else:
            # Collected copies stay in inventories (product plan §8).
            card_set.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublishSetView(APIView):
    def get(self, request: Request, set_id) -> Response:
        """Preview: what would stop this set from publishing right now."""
        return Response({"problems": publish_problems(my_set(request, set_id))})

    def post(self, request: Request, set_id) -> Response:
        card_set = my_set(request, set_id)
        problems = publish_set(card_set)
        if problems:
            return Response({"error": problems[0], "problems": problems}, status=400)
        return Response(CardSetDetailSerializer(my_set(request, set_id)).data)


class MyCardListView(APIView):
    def post(self, request: Request, set_id) -> Response:
        card_set = my_set(request, set_id)
        require_draft(card_set)
        serializer = CardWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        position = card_set.cards.count()
        card = serializer.save(card_set=card_set, position=position)
        return Response(CardSerializer(card).data, status=status.HTTP_201_CREATED)


class MyCardDetailView(APIView):
    def _card(self, request: Request, set_id, card_id) -> CardDefinition:
        card_set = my_set(request, set_id)
        require_draft(card_set)
        return get_object_or_404(card_set.cards.select_related("image"), id=card_id)

    def patch(self, request: Request, set_id, card_id) -> Response:
        card = self._card(request, set_id, card_id)
        serializer = CardWriteSerializer(
            card, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CardSerializer(card).data)

    def delete(self, request: Request, set_id, card_id) -> Response:
        self._card(request, set_id, card_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
