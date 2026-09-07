from unittest.mock import Mock

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from cards.identity import PACK_FINISHES, SET_MARKS
from cards.management.commands import seed_demo
from cards.markdown import description_issues
from cards.rarity import rarity_problems
from cards.templates import config_problems, default_config, template_problems


def test_curated_photo_cache_skips_repeat_downloads(tmp_path, monkeypatch):
    monkeypatch.setattr(seed_demo, "CACHE_DIR", tmp_path)
    download = Mock(return_value=b"photo")
    monkeypatch.setattr(seed_demo, "_get", download)
    spec = next(iter(seed_demo.CURATED_PHOTOS))
    assert seed_demo.fetch_photo(spec) == b"photo"
    assert seed_demo.fetch_photo(spec) == b"photo"
    download.assert_called_once_with(seed_demo.CURATED_PHOTOS[spec]["url"])


def test_photo_preparation_never_accesses_database(monkeypatch):
    monkeypatch.setattr(seed_demo, "fetch_photo", Mock(return_value=b"photo"))
    call_command("seed_demo", prepare_photos=True)
    monkeypatch.setattr(seed_demo, "fetch_photo", Mock(return_value=None))
    with pytest.raises(CommandError, match="database unchanged"):
        call_command("seed_demo")


def test_curated_sets_match_publishing_contract(monkeypatch):
    command = seed_demo.Command()
    make_set = Mock()
    monkeypatch.setattr(command, "_make_set", make_set)
    extras = dict.fromkeys(["orla", "kit", "bex", "sol", "wren"])
    command._make_more_sets(None, None, None, extras)
    curated = [
        call.kwargs
        for call in make_set.call_args_list
        if call.kwargs["title"] in {"Other Worlds", "Shutter Shelf"}
    ]
    assert len(curated) == 2
    used = set()
    for card_set in curated:
        assert card_set["mark"] in SET_MARKS
        assert card_set["pack_finish"] in PACK_FINISHES
        assert not rarity_problems([card[1] for card in card_set["cards"]])
        for name, rarity, template, config, caption, spec in card_set["cards"]:
            assert not template_problems(template, rarity), name
            assert not config_problems(template, {**default_config(template), **config}, rarity), (
                name
            )
            description = seed_demo.photo_description(caption, spec)
            assert not description_issues(description), name
            assert seed_demo.CURATED_PHOTOS[spec]["credit"] in description
            assert seed_demo.CURATED_PHOTOS[spec]["rights_url"] in description
            used.add(spec)
    assert used == set(seed_demo.CURATED_PHOTOS)
