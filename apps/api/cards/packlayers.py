"""What is printed on the front of a pack, as a stack of layers.

The same reasoning as cards/packtext.py: the count and order are the creator's
choice, so this is a list on the set rather than fixed columns, and the API
validates the shape itself.

A layer is either an uploaded image or the set's built-in lockup. Making the
lockup a layer is what lets a creator keep their badge and lay artwork under or
over it, rather than choosing between the two. Its design still lives in the
emblem fields on the set; the layer decides where it sits, whether it shows, and
where in the stack it is painted.

There is deliberately no "placed or full" setting. A layer is sized by width as a
percentage of the pack and positioned from the centre, and a big enough scale
covers the wrapper, so one set of controls does both jobs.

Ownership of each image is checked in the serializer, the only place that knows
who is asking; everything else about a layer is checked here.
"""

from typing import Any

from .identity import (
    ART_OFFSET_MAX,
    ART_OFFSET_MIN,
    ART_OPACITY_MAX,
    ART_OPACITY_MIN,
    ART_ROTATE_MAX,
    ART_ROTATE_MIN,
    ART_SCALE_DEFAULT,
    ART_SCALE_MAX,
    ART_SCALE_MIN,
    PACK_LAYER_KINDS,
    PACK_LAYER_MAX,
)

DEFAULTS: dict[str, Any] = {
    "kind": "image",
    "image_id": "",
    "hidden": False,
    "scale": ART_SCALE_DEFAULT,
    "x": 0,
    "y": 0,
    "rotate": 0,
    "flip_x": False,
    "flip_y": False,
    "opacity": 100,
}

# Read-only keys the API adds when it serialises a layer. A client naturally
# sends back what it was given, so they are accepted and then dropped rather
# than rejected as unknown.
DERIVED = frozenset({"url", "width", "height"})

_NUMBERS = {
    "scale": (ART_SCALE_MIN, ART_SCALE_MAX),
    "x": (ART_OFFSET_MIN, ART_OFFSET_MAX),
    "y": (ART_OFFSET_MIN, ART_OFFSET_MAX),
    "rotate": (ART_ROTATE_MIN, ART_ROTATE_MAX),
    "opacity": (ART_OPACITY_MIN, ART_OPACITY_MAX),
}

_FLAGS = ("hidden", "flip_x", "flip_y")


def default_stack() -> list[dict[str, Any]]:
    """What a brand new set prints: its own lockup, and nothing else."""
    return [{**DEFAULTS, "kind": "emblem", "scale": 100}]


def problems(layers: Any) -> list[str]:
    """Everything wrong with a submitted stack."""
    if not isinstance(layers, list):
        return ["The pack front must be a list of layers."]
    if len(layers) > PACK_LAYER_MAX:
        return [f"A pack can carry at most {PACK_LAYER_MAX} layers."]

    found: list[str] = []
    emblems = 0
    for i, layer in enumerate(layers, start=1):
        if not isinstance(layer, dict):
            found.append(f"Layer {i} is not a layer.")
            continue
        for key in layer:
            if key not in DEFAULTS and key not in DERIVED:
                found.append(f"Layer {i} has an unknown setting '{key}'.")

        kind = layer.get("kind", DEFAULTS["kind"])
        if kind not in PACK_LAYER_KINDS:
            found.append(f"Layer {i} has an invalid kind.")
        elif kind == "emblem":
            emblems += 1
        elif not str(layer.get("image_id", "")).strip():
            found.append(f"Layer {i} has no picture.")

        for key in _FLAGS:
            if not isinstance(layer.get(key, DEFAULTS[key]), bool):
                found.append(f"Layer {i} needs {key} as true or false.")

        for key, (low, high) in _NUMBERS.items():
            value = layer.get(key, DEFAULTS[key])
            if not isinstance(value, int) or isinstance(value, bool):
                found.append(f"Layer {i} needs {key} as a whole number.")
            elif not low <= value <= high:
                found.append(f"Layer {i} has {key} outside {low} to {high}.")

    if emblems > 1:
        found.append("A pack can only carry one built-in lockup.")
    return found


def image_ids(layers: list[dict[str, Any]]) -> list[str]:
    """The image ids a submitted stack refers to, for the ownership check."""
    return [
        str(layer["image_id"])
        for layer in layers
        if layer.get("kind", DEFAULTS["kind"]) == "image" and str(layer.get("image_id", "")).strip()
    ]


def normalised(layers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fill in defaults and drop image layers with no picture."""
    out = []
    for layer in layers:
        full = {**DEFAULTS, **{k: v for k, v in layer.items() if k in DEFAULTS}}
        if full["kind"] == "emblem":
            full["image_id"] = ""
        elif not str(full["image_id"]).strip():
            continue
        else:
            full["image_id"] = str(full["image_id"])
        out.append(full)
    return out
