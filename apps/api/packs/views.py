from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from cards.models import CardSet
from cards.rarity import RECYCLE_VALUE
from cards.views import with_counts

from . import actions
from .models import OwnedCard, PackOpening, SetPoints
from .serializers import OwnedCardSerializer, PackOpeningSerializer


def with_copies(queryset):
    """Annotate owned cards with how many copies the owner holds and whether they're in a trade."""
    from trades.models import TradeOfferItem  # here, not at the top: import cycle

    copies = (
        OwnedCard.objects.filter(owner=OuterRef("owner"), card=OuterRef("card"))
        .values("card")
        .annotate(n=Count("id"))
        .values("n")
    )
    held = TradeOfferItem.objects.filter(owned_card=OuterRef("pk"), offer__status="pending")
    return queryset.select_related("card__image", "card__card_set").annotate(
        copies=Subquery(copies), held=Exists(held)
    )


def pack_status(user, card_set: CardSet) -> dict:
    return {
        "free_available": actions.free_pack_available(user, card_set),
        "points": actions.points_balance(user, card_set),
        "pack_cost": actions.EXTRA_PACK_POINT_COST,
        "pack_size": actions.pack_size_for(card_set),
        "recycle_values": RECYCLE_VALUE,
        "resets_at": (timezone.now().date() + timedelta(days=1)).isoformat() + "T00:00:00Z",
    }


class PackStatusView(APIView):
    def get(self, request: Request, slug: str) -> Response:
        card_set = get_object_or_404(CardSet, slug=slug, status=CardSet.Status.PUBLISHED)
        return Response(pack_status(request.user, card_set))


class OpenPackView(APIView):
    throttle_scope = "packs"

    def post(self, request: Request, slug: str) -> Response:
        card_set = get_object_or_404(
            with_counts(CardSet.objects.all()), slug=slug, status=CardSet.Status.PUBLISHED
        )
        use_points = bool(request.data.get("use_points"))  # type: ignore[union-attr]
        try:
            if use_points:
                opening = actions.open_pack_with_points(request.user, card_set)
            else:
                opening = actions.open_free_pack(request.user, card_set)
        except actions.PackError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        opening = PackOpening.objects.select_related("card_set").get(pk=opening.pk)
        opening.card_set = card_set  # annotated copy, for card_count
        data = PackOpeningSerializer(opening).data
        data["cards"] = OwnedCardSerializer(
            with_copies(opening.cards.all()).order_by("acquired_at", "id"), many=True
        ).data
        data["status"] = pack_status(request.user, card_set)
        return Response(data, status=status.HTTP_201_CREATED)


class CollectionPagination(PageNumberPagination):
    page_size = 60


def collection_response(request: Request, owner_id) -> Response:
    queryset = with_copies(OwnedCard.objects.filter(owner_id=owner_id))
    set_slug = request.query_params.get("set")
    if set_slug:
        queryset = queryset.filter(card__card_set__slug=set_slug)
    paginator = CollectionPagination()
    page: list[OwnedCard] = paginator.paginate_queryset(queryset, request) or []
    return paginator.get_paginated_response(OwnedCardSerializer(page, many=True).data)


class MyCollectionView(APIView):
    def get(self, request: Request) -> Response:
        return collection_response(request, request.user.id)


class UserCollectionView(APIView):
    """Anyone's collection, so a trade partner can pick what they want."""

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request, username: str) -> Response:
        owner = get_object_or_404(User, username=username.lower(), is_active=True)
        return collection_response(request, owner.id)


class RecycleCardView(APIView):
    def post(self, request: Request, card_id) -> Response:
        owned = get_object_or_404(OwnedCard, id=card_id, owner=request.user)
        try:
            balance = actions.recycle_card(request.user, owned)
        except actions.PackError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"points": balance, "set_slug": owned.card.card_set.slug})


class MyPointsView(APIView):
    def get(self, request: Request) -> Response:
        rows = SetPoints.objects.filter(user_id=request.user.id, balance__gt=0)  # type: ignore[misc]
        rows = rows.select_related("card_set")
        return Response(
            [
                {"set_slug": r.card_set.slug, "set_title": r.card_set.title, "points": r.balance}
                for r in rows
            ]
        )
