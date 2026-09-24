import hashlib
from copy import deepcopy
from unittest.mock import Mock
from urllib.parse import unquote

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from accounts.models import User
from cards import catalogue, catalogue_photos
from cards.catalogue import (
    bootstrap_catalogue,
    export_photos,
    load_manifest,
    prepare_photos,
    required_photo_specs,
    stable_id,
)
from cards.demo_activity import refresh_demo_activity
from cards.management.commands import rebuild_catalogue_set
from cards.models import CardDefinition, CardSet
from packs.models import OwnedCard
from social.models import Comment, Follow, Reaction, SetFollow
from trades.models import TradeOffer, TradeOfferItem
from uploads.models import Image

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + (800).to_bytes(4, "big") + (1000).to_bytes(4, "big")


def reviewed(manifest, spec):
    return {field: manifest["sources"][spec][field] for field in catalogue.SOURCE_FIELDS}


def photos_for(manifest):
    photos = {}
    for spec in required_photo_specs(manifest):
        catalogue.PHOTO_SOURCES[spec] = reviewed(manifest, spec)
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
    assert set(specs) == set(manifest["sources"])
    assert all(len(source["sha256"]) == 64 for source in manifest["sources"].values())
    for spec, source in manifest["sources"].items():
        if spec in catalogue_photos.CURATED_PHOTOS:
            continue
        filename = unquote(source["source_url"].split("/wiki/File:", 1)[1])
        assert spec.replace(" ", "_") == filename.replace(" ", "_")


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
def test_stored_images_are_verified_without_downloading_them(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = small_manifest(2)
    bootstrap_catalogue(manifest, photos_for(manifest))
    fetch = Mock(return_value=b"re-encoded upstream")
    monkeypatch.setattr(catalogue, "fetch_photo", fetch)

    assert prepare_photos(manifest) == {}
    created, verified = bootstrap_catalogue(manifest, {})
    fetch.assert_not_called()
    assert not created
    assert len(verified) == 2


@pytest.mark.django_db
def test_stored_image_attribution_must_match_the_manifest(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = small_manifest()
    bootstrap_catalogue(manifest, photos_for(manifest))
    spec = manifest["sets"][0]["cards"][0][5]
    manifest["sources"][spec]["author"] = "Someone else"

    with pytest.raises(CommandError, match="differs from the catalogue manifest: author"):
        bootstrap_catalogue(manifest, {})


@pytest.mark.django_db
def test_new_photos_must_match_their_reviewed_bytes(monkeypatch):
    manifest = small_manifest()

    def fetch(spec):
        catalogue.PHOTO_SOURCES[spec] = reviewed(manifest, spec)
        return b"re-encoded upstream"

    monkeypatch.setattr(catalogue, "fetch_photo", fetch)
    assert not Image.objects.exists()
    with pytest.raises(CommandError, match="changed from the reviewed sources"):
        prepare_photos(manifest)


@pytest.mark.django_db
def test_staged_photos_stand_in_for_downloads(monkeypatch, tmp_path):
    manifest = small_manifest()
    specs = required_photo_specs(manifest)
    for spec in specs:
        manifest["sources"][spec]["sha256"] = hashlib.sha256(spec.encode()).hexdigest()
    monkeypatch.setattr(catalogue, "fetch_photo", lambda spec: spec.encode())
    assert export_photos(tmp_path, manifest) == len(specs)

    monkeypatch.setattr(catalogue, "fetch_photo", lambda spec: pytest.fail("downloaded"))
    assert prepare_photos(manifest, staged=str(tmp_path)) == {s: s.encode() for s in specs}

    next(tmp_path.iterdir()).unlink()
    with pytest.raises(CommandError, match="unavailable"):
        prepare_photos(manifest, staged=str(tmp_path))


def layered_manifest(art):
    manifest = small_manifest()
    design = manifest["sets"][0]["pack_design"]
    extra = manifest["sets"][0]["cards"][1][5]
    design["cutouts"].append({"spec": extra})
    design["art"] = art
    return manifest


@pytest.mark.django_db
def test_pack_art_layers_several_cutouts_around_the_lockup(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = layered_manifest(
        [
            {"cutout": 1, "scale": 180, "opacity": 30, "flip_x": True},
            {"emblem": True},
            {"cutout": 0, "scale": 50, "x": 20, "rotate": -8},
        ]
    )
    photos = photos_for(manifest)
    created, _ = bootstrap_catalogue(manifest, photos)
    layers = created[0].pack_layers
    title = manifest["sets"][0]["title"]

    assert [layer["kind"] for layer in layers] == ["image", "emblem", "image"]
    assert layers[0]["image_id"] == str(stable_id("pack-art", title, 1))
    assert layers[0]["flip_x"] is True
    assert layers[0]["opacity"] == 30
    assert layers[2]["image_id"] == str(stable_id("pack-art", title))
    assert Image.objects.filter(kind=Image.Kind.PACK).count() == 2

    _, verified = bootstrap_catalogue(manifest, {})
    assert verified == created


@pytest.mark.django_db
def test_pack_can_hide_its_lockup_and_set_text_off_centre(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = layered_manifest([{"cutout": 0, "scale": 300}])
    design = manifest["sets"][0]["pack_design"]
    design["emblem_hidden"] = True
    design["lines"] = [
        ["BIG", "cream", 26, 30, 0, "alfa", -20, -90],
        ["small", "ink", 3, 40, 10, "body"],
    ]
    created, _ = bootstrap_catalogue(manifest, photos_for(manifest))

    emblem = next(layer for layer in created[0].pack_layers if layer["kind"] == "emblem")
    assert emblem["hidden"] is True
    big, small = created[0].pack_text
    assert (big["size"], big["x"], big["rotate"]) == (26, -20, -90)
    assert (small["x"], small["rotate"]) == (0, 0)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("change", "error"),
    [
        (lambda s: s["pack_design"].update(art=[{"cutout": 2}]), "has no cutout 2"),
        (
            lambda s: s["pack_design"].update(art=[{"cutout": i % 2} for i in range(6)]),
            "pack art is invalid",
        ),
        (lambda s: s.update(pack_colour="not-a-colour"), "pack_colour"),
        (lambda s: s.update(title="A Set Title Too Long for the Back"), "fit the card back"),
    ],
)
def test_bootstrap_refuses_an_invalid_set(monkeypatch, change, error):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = layered_manifest([])
    change(manifest["sets"][0])

    with pytest.raises(CommandError, match=error):
        bootstrap_catalogue(manifest, photos_for(manifest))


def rebuild(monkeypatch, manifest, *slugs):
    monkeypatch.setattr(rebuild_catalogue_set, "load_manifest", lambda: manifest)
    monkeypatch.setattr(catalogue, "prepare_photos", photos_for)
    call_command("rebuild_catalogue_set", *slugs)


@override_settings(DEBUG=False)
def test_rebuild_is_refused_outside_development():
    with pytest.raises(CommandError, match="only runs in development"):
        call_command("rebuild_catalogue_set", "plants-along-the-trail")


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_rebuild_replaces_a_published_set_from_the_manifest(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = small_manifest()
    created, _ = bootstrap_catalogue(manifest, photos_for(manifest))
    manifest["sets"][0]["cards"][0][0] = "Renamed Card"

    rebuild(monkeypatch, manifest, created[0].slug)
    card_set = CardSet.objects.get(slug=created[0].slug)
    assert card_set.cards.get(position=0).title == "Renamed Card"
    assert CardSet.objects.count() == 1


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_rebuild_leaves_a_set_real_accounts_own(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = small_manifest()
    created, _ = bootstrap_catalogue(manifest, photos_for(manifest))
    real_user = User.objects.create_user("real@example.com", "realperson", "password")
    OwnedCard.objects.create(owner=real_user, card=created[0].cards.first())

    with pytest.raises(CommandError, match="owned by real accounts"):
        rebuild(monkeypatch, manifest, created[0].slug)
    assert CardSet.objects.filter(pk=created[0].pk).exists()


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


@pytest.mark.django_db
def test_demo_activity_looks_like_a_real_catalogue(monkeypatch):
    monkeypatch.setattr(catalogue.storage, "put_object", lambda *args: None)
    manifest = load_manifest()
    bootstrap_catalogue(manifest, photos_for(manifest))
    refresh_demo_activity()
    demo = User.objects.filter(is_demo=True)

    for card_set in CardSet.objects.all():
        assert OwnedCard.objects.filter(owner__in=demo, card__card_set=card_set).exists()
    for user in demo:
        assert Follow.objects.filter(following=user).exists()

    rarities = list(OwnedCard.objects.filter(owner__in=demo).values_list("card__rarity", flat=True))
    assert rarities.count("legendary") < len(rarities) * 0.04
    assert rarities.count("common") > len(rarities) * 0.45

    likes = [
        Reaction.objects.filter(card_set=card_set).count() for card_set in CardSet.objects.all()
    ]
    assert max(likes) >= 2 * max(min(likes), 1)
    assert SetFollow.objects.filter(user__in=demo).exists()
    assert Comment.objects.filter(author__in=demo, parent__isnull=False).exists()
