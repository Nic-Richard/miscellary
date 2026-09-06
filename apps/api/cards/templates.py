"""Platform card templates.

Templates are defined in code rather than the database: they ship with the
product, and every card stores a snapshot (key, version, config) of what it
was designed with. Bumping a template's version means new cards get the new
look while published cards keep exactly what their collectors saw.

Each option lists the values a creator may pick, the editor group it belongs
to, and any rarity that gates individual values. The web and mobile clients
render the template from the key + config; the API only validates.
"""

from typing import Any

from .identity import FONTS
from .rarity import RARITIES

# Keep removed tokens renderable for published snapshots.
INKS = [
    "rarity",
    "ink",
    "charcoal",
    "slate",
    "teal",
    "green",
    "forest",
    "blue",
    "ocean",
    "indigo",
    "purple",
    "violet",
    "plum",
    "rose",
    "red",
    "crimson",
    "rust",
    "ember",
    "gold",
    "bronze",
    "cream",
    "white",
]

STOCKS_LIGHT = [
    "cream",
    "bone",
    "white",
    "sand",
    "linen",
    "ash",
    "blush",
    "sky",
    "mint",
    "butter",
]
STOCKS_DARK = [
    "slate",
    "charcoal",
    "ink",
    "dark",
    "forest",
    "oxblood",
    "navy",
    "plum",
    "moss",
    "teal",
    "wine",
    "bronze",
]
STOCKS_ALL = STOCKS_LIGHT + STOCKS_DARK

TEXTURES = ["linen", "canvas", "grain", "felt", "smooth", "brushed"]
TEXTURE_UNLOCKS = {"brushed": "rare"}

CORNERS = ["round", "soft", "sharp"]

BORDER_WEIGHTS = ["fine", "standard", "bold", "heavy"]

TINTS = ["none", "warm", "cool", "punch", "faded", "sepia", "mono"]

WINDOWS = ["line", "none", "mat", "inset"]

SHAPES = ["square", "arch", "circle", "diamond", "hex"]

PAPERS = ["ruled", "plain", "grid", "dot", "aged"]

FINISHES = ["matte", "satin", "gloss", "pearl", "metallic"]
FINISH_UNLOCKS = {"pearl": "rare", "metallic": "rare"}

RELIEFS = ["none", "spot", "emboss", "deboss"]
RELIEF_UNLOCKS = {"spot": "uncommon", "emboss": "rare", "deboss": "rare"}

TREATMENTS = ["none", "foil", "holo"]
TREATMENT_UNLOCKS = {"foil": "legendary", "holo": "legendary"}

COVERAGES = ["art", "frame", "full"]

TYPEFACES = FONTS

GROUPS = ["board", "print", "type", "press"]


def _opt(
    label: str,
    values: list[str],
    default: str,
    group: str,
    kind: str = "choice",
    unlocks: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build a template option and its optional rarity unlock map."""
    option: dict[str, Any] = {
        "label": label,
        "values": values,
        "default": default,
        "type": kind,
        "group": group,
    }
    if unlocks:
        option["unlocks"] = unlocks
    return option


def _cut() -> dict[str, Any]:
    return _opt("Corner cut", CORNERS, "round", "board")


def _board(values: list[str], default: str, texture: str = "linen") -> dict[str, dict[str, Any]]:
    """The board a card is printed on, its tooth, and how it is cut."""
    return {
        "frame": _opt("Stock", values, default, "board", "swatch"),
        "texture": _opt("Surface", TEXTURES, texture, "board", unlocks=TEXTURE_UNLOCKS),
        "corners": _cut(),
    }


def _photo() -> dict[str, Any]:
    return _opt("Photo", TINTS, "none", "print")


def _window() -> dict[str, Any]:
    return _opt("Photo window", WINDOWS, "line", "print")


def _shape() -> dict[str, Any]:
    return _opt("Photo shape", SHAPES, "square", "print")


def _font(default: str = "display") -> dict[str, Any]:
    return _opt("Type", TYPEFACES, default, "type", "font")


def _accent(default: str) -> dict[str, Any]:
    return _opt("Accent ink", INKS, default, "type", "swatch")


def _press() -> dict[str, dict[str, Any]]:
    """Production options shared by every template."""
    return {
        "finish": _opt("Coat", FINISHES, "matte", "press", unlocks=FINISH_UNLOCKS),
        "relief": _opt("Relief", RELIEFS, "none", "press", unlocks=RELIEF_UNLOCKS),
        "treatment": _opt("Chase", TREATMENTS, "none", "press", unlocks=TREATMENT_UNLOCKS),
        "coverage": _opt("Chase covers", COVERAGES, "art", "press"),
    }


TEMPLATES: list[dict[str, Any]] = [
    {
        "key": "classic",
        "version": 2,
        "name": "Classic",
        "description": "Framed photo, title bar, caption below.",
        "options": {
            **_board(STOCKS_ALL, "dark"),
            "tint": _photo(),
            "window": _window(),
            "shape": _shape(),
            "font": _font(),
            "accent": _accent("gold"),
            **_press(),
        },
    },
    {
        "key": "polaroid",
        "version": 2,
        "name": "Polaroid",
        "description": "Photo-first with a handwritten-style caption.",
        "options": {
            **_board(STOCKS_LIGHT, "white", "grain"),
            "tint": _photo(),
            "font": _font(),
            **_press(),
        },
    },
    {
        "key": "minimal",
        # Preserve the key for published snapshot compatibility.
        "version": 2,
        "name": "Full Art",
        "description": "Edge-to-edge photo with a subtle gradient and small type.",
        "unlocks": "epic",
        "options": {
            "corners": _cut(),
            "tint": _photo(),
            "gradient": _opt("Scrim", ["bottom", "top", "none", "full"], "bottom", "print"),
            "font": _font(),
            "accent": _accent("blue"),
            **_press(),
        },
    },
    {
        "key": "bold",
        "version": 2,
        "name": "Bold",
        "description": "Big title, thick border, rarity colour everywhere.",
        "options": {
            **_board(STOCKS_ALL, "cream", "canvas"),
            "tint": _photo(),
            "shape": _shape(),
            "font": _font(),
            "border": _opt("Border ink", INKS, "rarity", "type", "swatch"),
            "weight": _opt("Border weight", BORDER_WEIGHTS, "bold", "type"),
            **_press(),
        },
    },
    {
        "key": "fieldnote",
        "version": 2,
        "name": "Field Note",
        "description": "Photo above a ruled note panel holding the full description.",
        "options": {
            **_board(STOCKS_LIGHT, "cream", "grain"),
            "tint": _photo(),
            "window": _window(),
            "shape": _shape(),
            "paper": _opt("Note paper", PAPERS, "ruled", "print"),
            "font": _font(),
            "accent": _accent("green"),
            **_press(),
        },
    },
    {
        "key": "dossier",
        "version": 2,
        "name": "Dossier",
        "description": "Dark card, framed photo and a boxed description panel.",
        "options": {
            **_board(STOCKS_DARK, "ink", "felt"),
            "tint": _photo(),
            "window": _window(),
            "shape": _shape(),
            "paper": _opt("Panel", PAPERS, "plain", "print"),
            "font": _font(),
            "accent": _accent("gold"),
            **_press(),
        },
    },
]

TEMPLATES_BY_KEY = {t["key"]: t for t in TEMPLATES}


def default_config(key: str) -> dict[str, str]:
    template = TEMPLATES_BY_KEY[key]
    return {name: opt["default"] for name, opt in template["options"].items()}


def template_problems(key: str, rarity: str | None = None) -> list[str]:
    """Whether this rarity may use this template at all. Write path only, for
    the same reason as config_problems below."""
    template = TEMPLATES_BY_KEY.get(key)
    if template is None:
        return ["Unknown template."]
    needed = template.get("unlocks")
    if rarity is None or not needed or RARITIES.index(rarity) >= RARITIES.index(needed):
        return []
    return [f"The {template['name']} template needs a {needed} card. This card is {rarity}."]


def config_problems(key: str, config: dict[str, Any], rarity: str | None = None) -> list[str]:
    """Validate a config a creator is trying to save.

    Only ever called on the write path. Rendering reads a stored snapshot
    straight through, so published cards keep their look even if the unlock
    rules below change later. Passing rarity=None skips the rarity checks.
    """
    template = TEMPLATES_BY_KEY.get(key)
    if template is None:
        return ["Unknown template."]
    problems = []
    for name, value in config.items():
        option = template["options"].get(name)
        if option is None:
            problems.append(f"Unknown option '{name}'.")
        elif value not in option["values"]:
            problems.append(f"'{value}' isn't a valid {option['label'].lower()}.")
        elif rarity is not None:
            needed = option.get("unlocks", {}).get(value)
            if needed and RARITIES.index(rarity) < RARITIES.index(needed):
                problems.append(
                    f"{option['label']} '{value}' needs a {needed} card. This card is {rarity}."
                )
    if rarity == "legendary" and config.get("treatment", "none") == "none":
        problems.append("A legendary card needs a legendary treatment.")
    return problems
