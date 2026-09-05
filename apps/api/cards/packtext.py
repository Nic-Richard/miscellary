"""Free text layers a creator drops onto a pack.

The count is the creator's choice, so this is a list on the set rather than a
fixed set of columns. That means the API has to validate the shape itself, the
way cards/templates.py validates a template config: nothing reaches the database
that a client did not have to spell out correctly.

Coordinates are percentages of the pack's own box, measured from its centre, so
a layer stays where it was put at any rendered size.
"""

from typing import Any

from .identity import (
    EMBLEM_TEXT_COLOURS,
    FONTS,
    PACK_TEXT_MAX_LAYERS,
    PACK_TEXT_MAX_LENGTH,
    TEXT_OFFSET_MAX,
    TEXT_OFFSET_MIN,
    TEXT_ROTATE_MAX,
    TEXT_ROTATE_MIN,
    TEXT_SIZE_MAX,
    TEXT_SIZE_MIN,
    TEXT_TRACKING_MAX,
    TEXT_TRACKING_MIN,
)

DEFAULTS: dict[str, Any] = {
    "text": "",
    "hidden": False,
    "font": "display",
    "colour": "cream",
    "size": 6,
    "x": 0,
    "y": 0,
    "rotate": 0,
    "tracking": 12,
}

# Dropped settings. Still accepted from an older client so a stale tab cannot
# fail a save, and then discarded.
LEGACY = frozenset({"align", "case"})

_NUMBERS = {
    "size": (TEXT_SIZE_MIN, TEXT_SIZE_MAX),
    "x": (TEXT_OFFSET_MIN, TEXT_OFFSET_MAX),
    "y": (TEXT_OFFSET_MIN, TEXT_OFFSET_MAX),
    "rotate": (TEXT_ROTATE_MIN, TEXT_ROTATE_MAX),
    "tracking": (TEXT_TRACKING_MIN, TEXT_TRACKING_MAX),
}

_CHOICES = {
    "font": FONTS,
    "colour": EMBLEM_TEXT_COLOURS,
}


def problems(layers: Any) -> list[str]:
    """Everything wrong with a submitted list of text layers."""
    if not isinstance(layers, list):
        return ["Pack text must be a list of layers."]
    if len(layers) > PACK_TEXT_MAX_LAYERS:
        return [f"A pack can carry at most {PACK_TEXT_MAX_LAYERS} lines of text."]

    found: list[str] = []
    for i, layer in enumerate(layers, start=1):
        if not isinstance(layer, dict):
            found.append(f"Line {i} is not a text layer.")
            continue
        for key in layer:
            if key not in DEFAULTS and key not in LEGACY:
                found.append(f"Line {i} has an unknown setting '{key}'.")

        if not isinstance(layer.get("hidden", False), bool):
            found.append(f"Line {i} needs hidden as true or false.")

        text = layer.get("text", "")
        if not isinstance(text, str):
            found.append(f"Line {i} needs its text as a string.")
        elif len(text) > PACK_TEXT_MAX_LENGTH:
            found.append(f"Line {i} is longer than {PACK_TEXT_MAX_LENGTH} characters.")

        for key, allowed in _CHOICES.items():
            value = layer.get(key, DEFAULTS[key])
            if value not in allowed:
                found.append(f"Line {i} has an invalid {key}.")

        for key, (low, high) in _NUMBERS.items():
            value = layer.get(key, DEFAULTS[key])
            if not isinstance(value, int) or isinstance(value, bool):
                found.append(f"Line {i} needs {key} as a whole number.")
            elif not low <= value <= high:
                found.append(f"Line {i} has {key} outside {low} to {high}.")
    return found


def normalised(layers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fill in defaults and drop empty lines, so a stored layer is complete."""
    out = []
    for layer in layers:
        if not str(layer.get("text", "")).strip():
            continue
        out.append({**DEFAULTS, **{k: v for k, v in layer.items() if k in DEFAULTS}})
    return out
