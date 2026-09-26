"""Rarity and markdown rules must match the TypeScript copies in packages/shared."""

import json
import re
from pathlib import Path

import pytest

from cards import markdown, rarity, templates

SHARED = Path(__file__).resolve().parents[4] / "packages" / "shared"


def _ts_numbers(source: str, name: str) -> dict[str, float]:
    block = re.search(rf"export const {name}[^=]*=\s*\{{(.*?)\}};", source, re.DOTALL)
    assert block, f"{name} not found in rarity.ts"
    return {k: float(v) for k, v in re.findall(r"(\w+):\s*([\d.]+)", block.group(1))}


def test_rarity_numbers_match_typescript():
    source = (SHARED / "src" / "rarity.ts").read_text()
    assert _ts_numbers(source, "RARITY_MAX_SHARE") == pytest.approx(rarity.RARITY_MAX_SHARE)
    assert _ts_numbers(source, "PULL_ODDS") == pytest.approx(rarity.PULL_ODDS)
    assert _ts_numbers(source, "RECYCLE_VALUE") == rarity.RECYCLE_VALUE
    common_min = re.search(r"COMMON_MIN_SHARE = ([\d.]+)", source)
    assert common_min and float(common_min.group(1)) == rarity.COMMON_MIN_SHARE
    assert sum(rarity.PULL_ODDS.values()) == pytest.approx(1)


def test_pack_constants_match_typescript():
    from packs import actions

    source = (SHARED / "src" / "packs.ts").read_text()
    assert f"PACK_SIZE = {actions.PACK_SIZE};" in source
    assert f"EXTRA_PACK_POINT_COST = {actions.EXTRA_PACK_POINT_COST};" in source


@pytest.mark.parametrize(
    "case", json.loads((SHARED / "fixtures" / "markdown-cases.json").read_text())
)
def test_markdown_cases_match_fixture(case):
    assert markdown.description_issues(case["input"]) == case["issues"]


def test_markdown_too_long():
    assert markdown.description_issues("a" * 601) == ["too_long"]


def test_rarity_problems():
    assert rarity.rarity_problems([]) == ["Add at least one card."]
    assert rarity.rarity_problems(["common"] * 5) == []
    assert rarity.rarity_problems(["common"] * 4 + ["legendary"]) == []
    too_many_legendary = rarity.rarity_problems(["common"] * 6 + ["legendary"] * 2)
    assert any("Legendary" in p for p in too_many_legendary)
    too_few_common = rarity.rarity_problems(["common", "rare", "rare", "rare"])
    assert any("Common" in p for p in too_few_common)


def _config(**overrides) -> dict[str, str]:
    return {**templates.default_config("classic"), **overrides}


def test_ordinary_catalogue_is_open_at_every_rarity():
    ordinary = _config(
        stock="ink",
        accent="crimson",
        title_typeface="caveat",
        texture="felt",
        corners="sharp",
        tint="mono",
        window="mat",
    )
    for tier in ["common", "uncommon", "rare", "epic"]:
        assert templates.config_problems("classic", ordinary, tier) == []


def test_specialty_press_work_climbs_one_tier_at_a_time():
    assert templates.config_problems("classic", _config(finish="pearl"), "common")
    assert templates.config_problems("classic", _config(finish="pearl"), "uncommon") == []
    assert templates.config_problems("classic", _config(finish="metallic"), "uncommon") == []
    assert templates.config_problems("classic", _config(treatment="foil"), "uncommon")
    assert templates.config_problems("classic", _config(treatment="foil"), "rare") == []
    assert templates.config_problems("classic", _config(treatment="holo"), "rare")
    assert templates.config_problems("classic", _config(treatment="holo"), "epic") == []
    assert templates.config_problems("classic", _config(pattern="rainbow"), "epic")
    rainbow = _config(treatment="holo", pattern="rainbow")
    assert templates.config_problems("classic", rainbow, "legendary") == []
    assert templates.config_problems("classic", _config(texture="brushed"), "common")
    assert templates.config_problems("classic", _config(texture="brushed"), "uncommon") == []


def test_photo_framing_takes_a_focal_point_and_zoom_in_range():
    framed = _config(photo_x="12.5", photo_y="80", photo_zoom="2.25")
    assert templates.config_problems("classic", framed, "common") == []
    assert templates.config_problems("classic", _config(), "common") == []
    for bad in [
        {"photo_x": "101"},
        {"photo_y": "-1"},
        {"photo_zoom": "0.5"},
        {"photo_zoom": "5"},
        {"photo_x": "left"},
        {"photo_x": "nan"},
    ]:
        assert templates.config_problems("classic", _config(**bad), "common")


@pytest.mark.parametrize("key", ["classic", "polaroid", "bold", "fieldnote"])
def test_framed_templates_allow_shapes_and_borders_at_common(key):
    options = templates.TEMPLATES_BY_KEY[key]["options"]
    for name in ["stock", "shape", "border", "border_width"]:
        for value in options[name]["values"]:
            config = {**templates.default_config(key), name: value}
            assert templates.config_problems(key, config, "common") == []
    assert templates.config_problems(key, {"border_width": "huge"}, "common")


def test_every_default_is_open_to_a_common_card():
    for key, template in templates.TEMPLATES_BY_KEY.items():
        if template.get("unlocks"):
            continue
        assert templates.config_problems(key, templates.default_config(key), "common") == []


def test_full_art_is_reached_one_way_only():
    for template in templates.TEMPLATES:
        assert "art" not in template["options"]
    for tier in ["common", "uncommon", "rare"]:
        assert templates.template_problems("minimal", tier)
    for tier in ["epic", "legendary"]:
        assert templates.template_problems("minimal", tier) == []
    assert templates.template_problems("minimal") == []
    for key in ["classic", "polaroid", "bold", "fieldnote"]:
        assert templates.template_problems(key, "common") == []


def test_legendary_is_offered_a_treatment_but_never_forced_one():
    assert templates.config_problems("classic", _config(), "legendary") == []
    plain_legendary = _config(treatment="foil", finish="matte", texture="linen")
    assert templates.config_problems("classic", plain_legendary, "legendary") == []
    assert templates.config_problems("classic", _config(treatment="holo"), "legendary") == []


def test_rarity_is_not_checked_when_it_is_not_given():
    # Rendering a stored snapshot never re-validates, so gating rules can change.
    locked = _config(finish="metallic", treatment="holo")
    assert templates.config_problems("classic", locked) == []
