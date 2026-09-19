from copy import deepcopy
from urllib.parse import unquote

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from accounts.models import User
from cards import catalogue, catalogue_photos
from cards.catalogue import bootstrap_catalogue, load_manifest, required_photo_specs, stable_id
from cards.demo_activity import refresh_demo_activity
from cards.models import CardDefinition, CardSet
from packs.models import OwnedCard
from social.models import Comment, Follow, Reaction
from trades.models import TradeOffer, TradeOfferItem

SOURCE = {
    "source_url": "https://example.com/source",
    "author": "Example photographer",
    "license": "CC BY 4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "adaptation": "Cropped by the card renderer from the downloaded source.",
}
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + (800).to_bytes(4, "big") + (1000).to_bytes(4, "big")


def photos_for(manifest):
    photos = {}
    for spec in required_photo_specs(manifest):
        catalogue.PHOTO_SOURCES[spec] = SOURCE
        photos[spec] = PNG
    return photos


def small_manifest(set_count=1):
    manifest = deepcopy(load_manifest())
    manifest["sets"] = manifest["sets"][:set_count]
    wanted = {card_set["creator"] for card_set in manifest["sets"]}
    manifest["creators"] = [
        creator for creator in manifest["creators"] if creator["username"] in wanted
    ]
    return manifest


def test_catalogue_sources_are_pinned():
    manifest = load_manifest()
    specs = required_photo_specs(manifest)
    assert not [spec for spec in specs if spec.startswith("search:")]
    assert set(specs) == set(manifest["sources"])
    assert all(len(source["sha256"]) == 64 for source in manifest["sources"].values())
    for spec, source in manifest["sources"].items():
        if spec in catalogue_photos.CURATED_PHOTOS:
            continue
        filename = unquote(source["source_url"].split("/wiki/File:", 1)[1])
        assert spec.replace(" ", "_") == filename.replace(" ", "_")


def test_empty_photo_url_is_unavailable():
    assert catalogue_photos._open("") is None


@override_settings(ALLOW_DESTRUCTIVE_DEMO_RESET=False)
def test_destructive_reset_is_disabled_outside_development():
    with pytest.raises(CommandError, match="disabled outside development"):
        call_command("reset_demo", prepare_photos=True)


@pytest.mark.django_db
def test_bootstrap_is_idempotent_and_preserves_renders(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = small_manifest()
    photos = photos_for(manifest)

    created, verified = bootstrap_catalogue(manifest, photos)
    assert len(created) == 1
    assert not verified
    card = created[0].cards.first()
    CardDefinition.objects.filter(pk=card.pk).update(render_signature="already-baked")

    created_again, verified_again = bootstrap_catalogue(manifest, photos)
    card.refresh_from_db()
    assert not created_again
    assert verified_again == [created[0]]
    assert card.render_signature == "already-baked"
    assert CardSet.objects.count() == 1
    assert CardDefinition.objects.count() == 20


@pytest.mark.django_db
def test_bootstrap_aborts_on_published_mismatch(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = small_manifest()
    photos = photos_for(manifest)
    created, _ = bootstrap_catalogue(manifest, photos)
    CardDefinition.objects.filter(pk=created[0].cards.first().pk).update(title="Changed")

    with pytest.raises(CommandError, match="differs from the catalogue manifest"):
        bootstrap_catalogue(manifest, photos)


@pytest.mark.django_db
def test_bootstrap_can_add_a_set_without_rewriting_existing_rows(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    first_manifest = small_manifest()
    first, _ = bootstrap_catalogue(first_manifest, photos_for(first_manifest))
    published_at = first[0].published_at

    expanded_manifest = small_manifest(2)
    created, verified = bootstrap_catalogue(expanded_manifest, photos_for(expanded_manifest))
    first[0].refresh_from_db()
    assert len(created) == 1
    assert verified == first
    assert first[0].published_at == published_at


@pytest.mark.django_db
def test_refresh_demo_activity_leaves_real_user_data_alone(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = load_manifest()
    bootstrap_catalogue(manifest, photos_for(manifest))
    real_user = User.objects.create_user("real@example.com", "realperson", "password")
    garden = CardSet.objects.get(pk=stable_id("set", "Garden Birds"))
    owned = OwnedCard.objects.create(owner=real_user, card=garden.cards.first())
    reaction = Reaction.objects.create(user=real_user, card_set=garden)
    follow = Follow.objects.create(follower=real_user, following=garden.creator)
    comment = Comment.objects.create(card_set=garden, author=real_user, body="Real comment")

    refresh_demo_activity()
    demo_owned = OwnedCard.objects.filter(owner__is_demo=True).first()
    offer = TradeOffer.objects.create(sender=real_user, recipient=demo_owned.owner)
    TradeOfferItem.objects.create(offer=offer, owned_card=owned, side=TradeOfferItem.Side.GIVE)
    TradeOfferItem.objects.create(offer=offer, owned_card=demo_owned, side=TradeOfferItem.Side.WANT)
    first_counts = (
        OwnedCard.objects.filter(owner__is_demo=True).count(),
        Reaction.objects.filter(user__is_demo=True).count(),
        Follow.objects.filter(follower__is_demo=True).count(),
    )
    refresh_demo_activity()

    assert OwnedCard.objects.filter(owner__is_demo=True).count() == first_counts[0]
    assert Reaction.objects.filter(user__is_demo=True).count() == first_counts[1]
    assert Follow.objects.filter(follower__is_demo=True).count() == first_counts[2]
    assert OwnedCard.objects.filter(pk=owned.pk, owner=real_user).exists()
    assert Reaction.objects.filter(pk=reaction.pk, user=real_user).exists()
    assert Follow.objects.filter(pk=follow.pk, follower=real_user).exists()
    assert Comment.objects.filter(pk=comment.pk, author=real_user).exists()
    assert TradeOffer.objects.filter(pk=offer.pk).exists()
    assert TradeOfferItem.objects.filter(offer=offer, owned_card=demo_owned).exists()
