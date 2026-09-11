import pytest
from django.db import IntegrityError

from cards.models import CardDefinition, CardSet, PublishedCardError
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


def test_publishing_freezes_the_printed_card_identifier(user):
    card_set = make_set(user, title="Pocket Geology")
    fill_publishable(card_set)
    assert publish_set(card_set) == []
    card_set.refresh_from_db()

    assert card_set.printed_code == "POC-01"
    assert {card.set_total for card in card_set.cards.all()} == {5}

    card_set.set_code = "ROC"
    with pytest.raises(PublishedCardError, match="set_code"):
        card_set.save()

    card_set.refresh_from_db()
    card_set.set_code_suffix = "02"
    with pytest.raises(PublishedCardError, match="set_code_suffix"):
        card_set.save()

    card = card_set.cards.first()
    card.set_total = 99
    with pytest.raises(PublishedCardError, match="set_total"):
        card.save()


def test_a_chosen_set_code_survives_publication(user):
    card_set = make_set(user, title="Pocket Geology", set_code="GEO")
    fill_publishable(card_set)
    assert publish_set(card_set) == []
    card_set.refresh_from_db()
    assert card_set.printed_code == "GEO-01"


def test_each_set_takes_the_next_free_suffix_for_its_code(user):
    codes = []
    for _ in range(3):
        card_set = make_set(user, title="Garden Birds", set_code="BRD")
        fill_publishable(card_set)
        assert publish_set(card_set) == []
        card_set.refresh_from_db()
        codes.append(card_set.printed_code)
    assert codes == ["BRD-01", "BRD-02", "BRD-03"]

    CardSet.objects.filter(set_code_suffix="02").update(set_code="OLD")
    reused = make_set(user, title="Garden Birds", set_code="BRD")
    fill_publishable(reused)
    assert publish_set(reused) == []
    reused.refresh_from_db()
    assert reused.printed_code == "BRD-02"


def test_a_printed_code_cannot_be_used_twice(user):
    first = make_set(user, title="Garden Birds", set_code="BRD")
    fill_publishable(first)
    publish_set(first)
    first.refresh_from_db()

    clash = make_set(user, title="Other Birds", set_code="BRD")
    clash.set_code_suffix = first.set_code_suffix
    with pytest.raises(IntegrityError):
        clash.save(update_fields=["set_code", "set_code_suffix"])


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

    card.refresh_from_db()
    card.printed_text = "Changed face copy"
    with pytest.raises(PublishedCardError, match="printed_text"):
        card.save()

    card.refresh_from_db()
    card.position = 99
    with pytest.raises(PublishedCardError, match="position"):
        card.save()

    assert CardDefinition.objects.get(pk=card.pk).title != "Renamed"


def test_published_set_is_frozen_at_the_model_layer(user):
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)
    card_set.refresh_from_db()

    card_set.mark = "crystal"
    with pytest.raises(PublishedCardError, match="mark"):
        card_set.save()

    card_set.refresh_from_db()
    card_set.status = CardSet.Status.DRAFT
    with pytest.raises(PublishedCardError, match="lifecycle"):
        card_set.save(update_fields=["status"])

    card_set.refresh_from_db()
    card_set.soft_delete()
    assert card_set.status == CardSet.Status.DELETED


def test_draft_cards_are_editable(user):
    card_set = make_set(user)
    card = make_card(card_set)
    card.title = "Edited"
    card.save()
    card.delete()
    assert card_set.cards.count() == 0
