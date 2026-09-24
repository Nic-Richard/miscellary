"""The mark catalogue lives in two places and has to stay one list.

`cards/identity.py` decides what the API will accept; `packages/shared/src/setMarks.ts`
holds the artwork each one is drawn from. A mark in one and not the other is either
a choice nobody can pick or a choice that renders as the fallback, and neither
fails loudly on its own.
"""

import re
from pathlib import Path

from cards.identity import SET_MARKS


def _shared_marks_file() -> Path:
    """Walk up to the repository root, which is wherever packages/ lives."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "packages" / "shared" / "src" / "setMarks.ts"
        if candidate.is_file():
            return candidate
    raise AssertionError("could not find packages/shared/src/setMarks.ts")


def drawn_marks() -> list[str]:
    source = _shared_marks_file().read_text(encoding="utf-8")
    body = source[source.index("{") : source.rindex("}")]
    return re.findall(r"^  ([a-z]+): \[", body, re.M)


def test_accepted_and_drawn_marks_are_one_list():
    assert list(SET_MARKS) == drawn_marks()
