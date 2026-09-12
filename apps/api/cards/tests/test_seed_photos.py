from unittest.mock import Mock

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from cards.identity import PACK_FINISHES, SET_MARKS
from cards.management.commands import seed_demo
from cards.markdown import description_issues
from cards.models import CardSet
from cards.rarity import rarity_problems
from cards.templates import config_problems, default_config, template_problems
from uploads.models import Image


def test_curated_photo_cache_skips_repeat_downloads(tmp_path, monkeypatch):
    monkeypatch.setattr(seed_demo, "CACHE_DIR", tmp_path)
    download = Mock(return_value=b"photo")
    monkeypatch.setattr(seed_demo, "_get", download)
    spec = next(iter(seed_demo.CURATED_PHOTOS))
    assert seed_demo.fetch_photo(spec) == b"photo"
    assert seed_demo.fetch_photo(spec) == b"photo"
    download.assert_called_once_with(seed_demo.CURATED_PHOTOS[spec]["url"])
    source = seed_demo.PHOTO_SOURCES[spec]
    assert source["author"] == seed_demo.CURATED_PHOTOS[spec]["credit"]
    assert source["license_url"] == seed_demo.CURATED_PHOTOS[spec]["rights_url"]


def test_commons_photo_cache_retains_resolved_source(tmp_path, monkeypatch):
    monkeypatch.setattr(seed_demo, "CACHE_DIR", tmp_path)
    source = {
        "source_url": "https://commons.wikimedia.org/wiki/File:Robin.jpg",
        "author": "Example photographer",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "adaptation": "Cropped by the card renderer from the downloaded source.",
    }
    search = Mock(return_value=(b"photo", source))
    monkeypatch.setattr(seed_demo, "search_commons", search)

    assert seed_demo.fetch_photo("search:European robin bird") == b"photo"
    seed_demo.PHOTO_SOURCES.clear()
    assert seed_demo.fetch_photo("search:European robin bird") == b"photo"

    search.assert_called_once_with("European robin bird")
    assert seed_demo.PHOTO_SOURCES["search:European robin bird"] == source


def test_required_photo_list_covers_public_sets_and_draft():
    specs = seed_demo.required_photo_specs()
    assert len(specs) == 145
    assert len(set(specs)) == len(specs)
    assert all(card[5] in specs for cards in seed_demo.LAUNCH_EXPANSIONS.values() for card in cards)


def test_photo_preparation_never_accesses_database(monkeypatch):
    def fetch(spec):
        seed_demo.PHOTO_SOURCES[spec] = {
            "source_url": "https://commons.wikimedia.org/wiki/File:Example.jpg",
            "author": "Example photographer",
            "license": "CC BY 4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "adaptation": "Cropped by the card renderer from the downloaded source.",
        }
        return b"photo"

    monkeypatch.setattr(seed_demo, "fetch_photo", fetch)
    call_command("seed_demo", prepare_photos=True)
    monkeypatch.setattr(seed_demo, "fetch_photo", Mock(return_value=None))
    with pytest.raises(CommandError, match="database unchanged"):
        call_command("seed_demo")


def test_public_domain_source_gets_stable_rights_link():
    source = seed_demo._normalize_source(
        "example.jpg",
        {
            "source_url": "https://commons.wikimedia.org/wiki/File:Example.jpg",
            "author": "Example photographer",
            "license": "Public domain",
            "license_url": "",
            "adaptation": "Cropped by the card renderer from the downloaded source.",
        },
    )
    assert source["license_url"] == seed_demo.PUBLIC_DOMAIN_MARK


def test_demo_corner_rotation_includes_each_cut():
    cuts = [
        seed_demo.DEMO_CORNER_CUTS[index % len(seed_demo.DEMO_CORNER_CUTS)] for index in range(8)
    ]
    assert cuts.count("round") == 4
    assert cuts.count("soft") == 2
    assert cuts.count("sharp") == 2


def test_curated_extra_sets_match_publishing_contract(monkeypatch):
    command = seed_demo.Command()
    make_set = Mock()
    monkeypatch.setattr(command, "_make_set", make_set)
    extras = dict.fromkeys(["orla", "kit", "bex", "sol", "wren"])
    command._make_more_sets(None, None, None, extras)
    curated = [call.kwargs for call in make_set.call_args_list]
    assert [card_set["title"] for card_set in curated] == [
        "Garden Birds",
        "Film Cameras",
        "Planets and Moons",
        "Woodland Fungi",
    ]
    used = set()
    for card_set in curated:
        assert card_set["mark"] in SET_MARKS
        assert card_set["pack_finish"] in PACK_FINISHES
        assert not rarity_problems([card[1] for card in card_set["cards"]])
        for name, rarity, template, config, copy_text, spec in card_set["cards"]:
            printed, description = copy_text
            assert not template_problems(template, rarity), name
            assert not config_problems(template, {**default_config(template), **config}, rarity), (
                name
            )
            assert not description_issues(description), name
            assert description != printed, name
            if spec in seed_demo.CURATED_PHOTOS:
                assert seed_demo.CURATED_PHOTOS[spec]["credit"] not in description
                assert seed_demo.CURATED_PHOTOS[spec]["rights_url"] not in description
            used.add(spec)
    assert {spec for spec in used if spec in seed_demo.CURATED_PHOTOS} == set(
        seed_demo.CURATED_PHOTOS
    )


def test_launch_expansions_fit_template_text_contracts():
    assert {title: len(cards) for title, cards in seed_demo.LAUNCH_EXPANSIONS.items()} == {
        "Plants Along the Trail": 10,
        "Pocket Geology": 10,
        "Records on My Shelf": 10,
        "Garden Birds": 14,
        "Film Cameras": 15,
    }
    for cards in seed_demo.LAUNCH_EXPANSIONS.values():
        for name, rarity, template, config, copy_text, _spec in cards:
            printed, description = copy_text
            rules = seed_demo.TEMPLATES_BY_KEY[template]["text"]
            assert len(name) <= rules["title"]["max_length"], name
            if rules["printed"]:
                assert len(printed) <= rules["printed"]["max_length"], name
            assert not description_issues(description), name
            assert not template_problems(template, rarity), name
            assert not config_problems(template, {**default_config(template), **config}, rarity), (
                name
            )


@pytest.mark.django_db
def test_local_seed_builds_seven_large_flagged_sets(monkeypatch):
    def upload(_command, owner, photo, _top, _bottom, kind=Image.Kind.CARD):
        return Image.objects.create(
            owner=owner,
            kind=kind,
            key=f"card/test-{Image.objects.count()}.jpg",
            content_type="image/jpeg",
            size=100,
            width=800,
            height=1000,
            ready=True,
            source_metadata={
                "source_url": f"https://commons.wikimedia.org/{photo}",
                "author": "Test author",
                "license": "CC BY 4.0",
                "license_url": "https://creativecommons.org/licenses/by/4.0/",
                "adaptation": "Cropped by the card renderer from the downloaded source.",
            },
        )

    monkeypatch.setattr(seed_demo.Command, "_upload_art", upload)
    monkeypatch.setattr(
        seed_demo.Command,
        "_upload_keyed",
        lambda command, owner, name: upload(command, owner, name, None, None, Image.Kind.PACK),
    )
    call_command("seed_demo", no_photos=True)

    published = CardSet.objects.filter(status=CardSet.Status.PUBLISHED).order_by("title")
    assert list(published.values_list("title", flat=True)) == [
        "Film Cameras",
        "Garden Birds",
        "Planets and Moons",
        "Plants Along the Trail",
        "Pocket Geology",
        "Records on My Shelf",
        "Woodland Fungi",
    ]
    assert {card_set.cards.count() for card_set in published} == {20}
    assert set(published.values_list("pack_size", flat=True)) == {3, 4, 5, 6, 7, 8, 10}
    assert not published.filter(creator__is_demo=False).exists()
    for card in published.prefetch_related("cards"):
        for definition in card.cards.all():
            rules = seed_demo.TEMPLATES_BY_KEY[definition.template_key]["text"]
            assert len(definition.title) <= rules["title"]["max_length"]
            if rules["printed"]:
                assert len(definition.printed_text) <= rules["printed"]["max_length"]
            assert "creativecommons.org" not in definition.description
            assert "wikimedia.org" not in definition.description
