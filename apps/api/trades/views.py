from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from packs.models import OwnedCard
from packs.views import with_copies

from . import actions
from .models import TradeOffer, TradeOfferItem
from .serializers import OfferWriteSerializer, TradeOfferSerializer


def offers_for(user):
    items = TradeOfferItem.objects.select_related("owned_card").prefetch_related(
        Prefetch("owned_card", queryset=with_copies(OwnedCard.objects.all()))
    )
    return (
        TradeOffer.objects.filter(Q(sender=user) | Q(recipient=user))
        .select_related("sender__profile", "recipient__profile")
        .prefetch_related(Prefetch("items", queryset=items))
    )


def my_offer(request: Request, offer_id) -> TradeOffer:
    return get_object_or_404(offers_for(request.user), id=offer_id)


class OfferListView(APIView):
    def get(self, request: Request) -> Response:
        box = request.query_params.get("box", "inbox")
        queryset = offers_for(request.user)
        if box == "inbox":
            queryset = queryset.filter(recipient=request.user, status=TradeOffer.Status.PENDING)
        elif box == "outbox":
            queryset = queryset.filter(sender=request.user, status=TradeOffer.Status.PENDING)
        else:
            queryset = queryset.exclude(status=TradeOffer.Status.PENDING)[:50]
        return Response(TradeOfferSerializer(queryset, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = OfferWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        recipient = get_object_or_404(
            User, username=str(data.get("recipient", "")).lower(), is_active=True
        )
        try:
            offer = actions.create_offer(
                request.user, recipient, data["give"], data["want"], data["message"]
            )
        except actions.TradeError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            TradeOfferSerializer(my_offer(request, offer.id)).data, status=status.HTTP_201_CREATED
        )


class OfferDetailView(APIView):
    def get(self, request: Request, offer_id) -> Response:
        return Response(TradeOfferSerializer(my_offer(request, offer_id)).data)


def _act(request: Request, offer_id, fn) -> Response:
    offer = my_offer(request, offer_id)
    try:
        fn(request.user, offer)
    except actions.TradeError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(TradeOfferSerializer(my_offer(request, offer_id)).data)


class AcceptOfferView(APIView):
    def post(self, request: Request, offer_id) -> Response:
        return _act(request, offer_id, actions.accept_offer)


class RejectOfferView(APIView):
    def post(self, request: Request, offer_id) -> Response:
        return _act(request, offer_id, actions.reject_offer)


class CancelOfferView(APIView):
    def post(self, request: Request, offer_id) -> Response:
        return _act(request, offer_id, actions.cancel_offer)


class CounterOfferView(APIView):
    def post(self, request: Request, offer_id) -> Response:
        offer = my_offer(request, offer_id)
        serializer = OfferWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            new = actions.counter_offer(
                request.user, offer, data["give"], data["want"], data["message"]
            )
        except actions.TradeError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            TradeOfferSerializer(my_offer(request, new.id)).data, status=status.HTTP_201_CREATED
        )
