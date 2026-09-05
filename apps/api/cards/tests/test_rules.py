"""Rarity and markdown rules must match the TypeScript copies in packages/shared."""

import json
import re
from pathlib import Path

import pytest

from cards import markdown, rarity

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
