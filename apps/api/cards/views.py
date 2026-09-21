from django.db import transaction
from django.db.models import Count, Exists, IntegerField, OuterRef, Prefetch, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from . import tags as tagging
from . import templates
from .models import CardDefinition, CardSet, CardTag, SetTag, Tag
from .publishing import publish_problems, publish_set
from .serializers import (
    CardSerializer,
    CardSetDetailSerializer,
    CardSetSerializer,
    CardSetWriteSerializer,
    CardWriteSerializer,
    TagSerializer,
    TagWriteSerializer,
    TemplateSerializer,
)


class SetPagination(PageNumberPagination):
    page_size = 24


def with_counts(queryset, user=None, *, include_cards=True):
    """Sets with their counts and tags, and whether `user` liked or follows them."""
    from packs.models import PackOpening  # here, not at the top: import cycle
    from social.models import Reaction, SetFollow  # here, not at the top: import cycle

    def related_count(model, field):
        counts = (
            model.objects.filter(**{field: OuterRef("pk")})
            .order_by()
            .values(field)
            .annotate(total=Count("pk"))
            .values("total")
        )
        return Coalesce(Subquery(counts, output_field=IntegerField()), 0)

    queryset = queryset.select_related("creator__profile", "cover").prefetch_related(
        "set_tags__tag"
    )
    if include_cards:
        # Meta.ordering is dropped on GROUP BY queries, so order explicitly.
        cards = (
            CardDefinition.objects.select_related("image")
            .prefetch_related("card_tags__tag")
            .annotate(like_count=Count("reactions"))
            .order_by("position", "created_at")
        )
        queryset = queryset.prefetch_related(Prefetch("cards", queryset=cards))
    queryset = queryset.annotate(
        card_count=related_count(CardDefinition, "card_set_id"),
        like_count=related_count(Reaction, "card_set_id"),
        opening_count=related_count(PackOpening, "card_set_id"),
        follower_count=related_count(SetFollow, "card_set_id"),
    )
    if user is not None and user.is_authenticated:
        liked = Reaction.objects.filter(user=user, card_set=OuterRef("pk"))
        followed = SetFollow.objects.filter(user=user, card_set=OuterRef("pk"))
        return queryset.annotate(liked=Exists(liked), following=Exists(followed))
    return queryset.annotate(liked=Value(False), following=Value(False))


class TemplateListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        return Response(TemplateSerializer(templates.CATALOGUE, many=True).data)


# ---- public ----


class PublicSetListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        queryset = with_counts(
            CardSet.objects.filter(status=CardSet.Status.PUBLISHED),
            request.user,
            include_cards=False,
        )
        tag = tagging.slugify_tag(request.query_params.get("tag", ""))
        if tag:
            queryset = queryset.filter(set_tags__tag__slug=tag)
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
            ),
            include_cards=False,
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

    def patch(self, request: Request, set_id) -> Response:
        card_set = my_set(request, set_id)
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


class MyCardOrderView(APIView):
    """Set the order a draft's cards are printed in.

    Position is what the printed identifier counts, so it has to stay a gapless
    run. Every write goes through here or through a delete, and both renumber.
    """

    def post(self, request: Request, set_id) -> Response:
        card_set = my_set(request, set_id)
        require_draft(card_set)
        body = request.data if isinstance(request.data, dict) else {}
        wanted = body.get("card_ids")
        if not isinstance(wanted, list):
            raise ValidationError({"card_ids": ["Send the card ids in the order they belong."]})
        cards = {str(card.id): card for card in card_set.cards.all()}
        asked = [str(card_id) for card_id in wanted]
        if sorted(asked) != sorted(cards):
            raise ValidationError({"card_ids": ["Send every card in the set exactly once."]})
        with transaction.atomic():
            for position, card_id in enumerate(asked):
                card = cards[card_id]
                if card.position != position:
                    card.position = position
                    card.save(update_fields=["position"])
        # The set was fetched with its cards prefetched, so read them back from
        # the database rather than from a cache that predates the renumbering.
        ordered = CardDefinition.objects.filter(card_set=card_set).order_by("position")
        return Response(CardSerializer(ordered, many=True).data)


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
        card = self._card(request, set_id, card_id)
        card_set = card.card_set
        with transaction.atomic():
            card.delete()
            remaining_cards = CardDefinition.objects.filter(card_set=card_set).order_by("position")
            for position, remaining in enumerate(remaining_cards):
                if remaining.position != position:
                    remaining.position = position
                    remaining.save(update_fields=["position"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---- tags ----


def apply_tags(owner, labels: list[str], limit: int) -> None:
    """Replace an object's tags with the submitted list, in the order given.

    `owner` is a set or a card definition; both hold their tags in a join table
    rather than on the row, which is what keeps them editable after publishing.
    """
    is_set = isinstance(owner, CardSet)
    wanted = tagging.normalised(labels, limit)
    with transaction.atomic():
        # Replacing the list is a delete followed by inserts, so two writes for
        # the same set or card would otherwise both clear it and then collide on
        # the unique pair. Locking the owning row makes them take turns.
        if is_set:
            CardSet.objects.select_for_update().filter(pk=owner.pk).first()
            SetTag.objects.filter(card_set=owner).delete()
        else:
            CardDefinition.objects.select_for_update().filter(pk=owner.pk).first()
            CardTag.objects.filter(card=owner).delete()
        for position, (slug, label) in enumerate(wanted):
            tag, _ = Tag.objects.get_or_create(slug=slug, defaults={"label": label})
            if is_set:
                SetTag.objects.create(card_set=owner, tag=tag, position=position)
            else:
                CardTag.objects.create(card=owner, tag=tag, position=position)


def tag_labels(request: Request) -> list[str]:
    serializer = TagWriteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return [label for label in serializer.validated_data["tags"] if label.strip()]


class TagListView(APIView):
    """Tags for studio autocomplete and search."""

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        queryset = Tag.objects.annotate(
            set_count=Count(
                "set_tags", filter=Q(set_tags__card_set__status=CardSet.Status.PUBLISHED)
            )
        )
        q = request.query_params.get("q", "").strip()[:40]
        if q:
            slug = tagging.slugify_tag(q)
            queryset = queryset.filter(Q(slug__icontains=slug or q) | Q(label__icontains=q))
        else:
            queryset = queryset.filter(set_count__gt=0)
        rows = queryset.order_by("-set_count", "slug")[:20]
        return Response(
            [{"slug": t.slug, "label": t.label, "set_count": t.set_count} for t in rows]
        )


class MySetTagsView(APIView):
    """A set's tags, editable by its creator whether or not it is published."""

    def put(self, request: Request, set_id) -> Response:
        card_set = get_object_or_404(
            CardSet.objects.exclude(status=CardSet.Status.REMOVED),
            id=set_id,
            creator_id=request.user.id,
        )
        labels = tag_labels(request)
        found = tagging.problems(labels, tagging.SET_TAG_MAX)
        if found:
            raise ValidationError({"tags": found})
        apply_tags(card_set, labels, tagging.SET_TAG_MAX)
        ordered = Tag.objects.filter(set_tags__card_set=card_set).order_by("set_tags__position")
        return Response(TagSerializer(ordered, many=True).data)


class MyCardTagsView(APIView):
    def put(self, request: Request, set_id, card_id) -> Response:
        card_set = get_object_or_404(
            CardSet.objects.exclude(status=CardSet.Status.REMOVED),
            id=set_id,
            creator_id=request.user.id,
        )
        card = get_object_or_404(card_set.cards, id=card_id)
        labels = tag_labels(request)
        found = tagging.problems(labels, tagging.CARD_TAG_MAX)
        if found:
            raise ValidationError({"tags": found})
        apply_tags(card, labels, tagging.CARD_TAG_MAX)
        ordered = Tag.objects.filter(card_tags__card=card).order_by("card_tags__position")
        return Response(TagSerializer(ordered, many=True).data)
