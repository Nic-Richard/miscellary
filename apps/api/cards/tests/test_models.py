import pytest

from cards.models import CardDefinition, PublishedCardError
from cards.publishing import publish_problems, publish_set
from cards.tests.helpers import fill_publishable, make_card, make_image, make_set

pytestmark = pytest.mark.django_db


def test_slug_is_generated_from_title(user):
    card_set = make_set(user, title="My Vinyl Shelf!")
    assert card_set.slug.startswith("my-vinyl-shelf-")
    assert make_set(user, title="My Vinyl Shelf!").slug != card_set.slug


def test_publish_requires_enough_cards_and_rarity_mix(user):
    card_set = make_set(user)
    assert any("at least 5" in p for p in publish_problems(card_set))

    fill_publishable(card_set, n_common=1, extra=("rare", "rare", "epic", "legendary"))
    problems = publish_problems(card_set)
    assert any("Common" in p for p in problems)


def test_publish_requires_ready_images(user):
    card_set = make_set(user)
    fill_publishable(card_set)
    make_card(card_set, "common", image=make_image(user, ready=False))
    assert "Every card needs a finished image upload." in publish_problems(card_set)


def test_publish_success_is_permanent(user):
    card_set = make_set(user)
    fill_publishable(card_set)
    assert publish_set(card_set) == []
    card_set.refresh_from_db()
    assert card_set.is_published and card_set.published_at is not None
    assert publish_set(card_set) == ["This set is already published."]


def test_published_cards_are_frozen_at_the_model_layer(user):
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)
    card = card_set.cards.first()

    card.title = "Renamed"
    with pytest.raises(PublishedCardError, match="title"):
        card.save()

    card.refresh_from_db()
    card.template_config = {**card.template_config, "accent": "red"}
    with pytest.raises(PublishedCardError, match="template_config"):
        card.save()

    with pytest.raises(PublishedCardError):
        card.delete()

    with pytest.raises(PublishedCardError):
        make_card(card_set, "common")

    assert CardDefinition.objects.get(pk=card.pk).title != "Renamed"


def test_draft_cards_are_editable(user):
    card_set = make_set(user)
    card = make_card(card_set)
    card.title = "Edited"
    card.save()
    card.delete()
    assert card_set.cards.count() == 0
