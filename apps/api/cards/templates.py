"""Platform card templates.

Templates are defined in code rather than the database: they ship with the
product, and every card stores a snapshot (key, version, config) of what it
was designed with. Bumping a template's version means new cards get the new
look while published cards keep exactly what their collectors saw.

Each option lists the values a creator may pick. The web and mobile clients
render the template from the key + config; the API only validates.
"""

from typing import Any

from .identity import FONTS
from .rarity import RARITIES

# Keep legacy snapshot tokens so published cards continue to render.

# `rarity` preserves rarity-driven accents in older snapshots.
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

STOCKS_LIGHT = ["cream", "bone", "white", "sand", "linen", "ash", "light"]
STOCKS_DARK = ["slate", "charcoal", "ink", "dark", "forest", "oxblood", "navy", "plum"]
STOCKS_ALL = STOCKS_LIGHT + STOCKS_DARK

# Brushed is gated because it reads as a specialty metal surface.
TEXTURES = ["linen", "canvas", "grain", "felt", "brushed", "smooth"]
TEXTURE_UNLOCKS = {"brushed": "rare"}

CORNERS = ["round", "soft", "sharp"]

FINISHES = ["matte", "satin", "gloss", "pearl", "metallic"]
FINISH_UNLOCKS = {"pearl": "rare", "metallic": "rare"}

# Chase treatment is independent of finish and reserved for legendary cards.
TREATMENTS = ["none", "foil", "holo"]
TREATMENT_UNLOCKS = {"foil": "legendary", "holo": "legendary"}

COVERAGES = ["art", "frame", "full"]

TYPEFACES = FONTS


def _opt(
    label: str,
    values: list[str],
    default: str,
    kind: str = "choice",
    unlocks: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build a template option and its optional rarity unlock map."""
    option: dict[str, Any] = {"label": label, "values": values, "default": default, "type": kind}
    if unlocks:
        option["unlocks"] = unlocks
    return option


def _stock(values: list[str], default: str) -> dict[str, Any]:
    return _opt("Stock", values, default, "swatch")


def _texture(default: str) -> dict[str, Any]:
    return _opt("Surface", TEXTURES, default, unlocks=TEXTURE_UNLOCKS)


def _corners() -> dict[str, Any]:
    return _opt("Corners", CORNERS, "round")


def _font(default: str = "display") -> dict[str, Any]:
    return _opt("Font", TYPEFACES, default, "font")


def _accent(default: str) -> dict[str, Any]:
    return _opt("Accent", INKS, default, "swatch")


def _specialty() -> dict[str, dict[str, Any]]:
    """Specialty options shared by every template."""
    return {
        "finish": _opt("Finish", FINISHES, "matte", unlocks=FINISH_UNLOCKS),
        "treatment": _opt("Legendary treatment", TREATMENTS, "none", unlocks=TREATMENT_UNLOCKS),
        "coverage": _opt("Treatment covers", COVERAGES, "art"),
    }


TEMPLATES: list[dict[str, Any]] = [
    {
        "key": "classic",
        "version": 1,
        "name": "Classic",
        "description": "Framed photo, title bar, caption below.",
        "options": {
            "frame": _stock(STOCKS_ALL, "dark"),
            "accent": _accent("gold"),
            "font": _font(),
            "texture": _texture("linen"),
            "corners": _corners(),
            **_specialty(),
        },
    },
    {
        "key": "polaroid",
        "version": 1,
        "name": "Polaroid",
        "description": "Photo-first with a handwritten-style caption.",
        "options": {
            "frame": _stock(STOCKS_LIGHT, "white"),
            "tint": _opt("Photo tint", ["none", "warm", "cool", "mono", "sepia", "faded"], "none"),
            "font": _font(),
            "texture": _texture("grain"),
            "corners": _corners(),
            **_specialty(),
        },
    },
    {
        "key": "minimal",
        # Keep the key for snapshot and CSS compatibility.
        "version": 1,
        "name": "Full Art",
        "description": "Edge-to-edge photo with a subtle gradient and small type.",
        "unlocks": "epic",
        "options": {
            "gradient": _opt("Gradient", ["bottom", "top", "none", "full"], "bottom"),
            "accent": _accent("blue"),
            "font": _font(),
            "texture": _texture("smooth"),
            "corners": _corners(),
            **_specialty(),
        },
    },
    {
        "key": "bold",
        "version": 1,
        "name": "Bold",
        "description": "Big title, thick border, rarity colour everywhere.",
        "options": {
            "shape": _opt("Image shape", ["square", "circle", "arch", "diamond", "hex"], "square"),
            "border": _opt("Border", INKS, "rarity", "swatch"),
            "frame": _stock(STOCKS_ALL, "cream"),
            "font": _font(),
            "texture": _texture("canvas"),
            "corners": _corners(),
            **_specialty(),
        },
    },
    {
        "key": "fieldnote",
        "version": 1,
        "name": "Field Note",
        "description": "Photo above a ruled note panel holding the full description.",
        "options": {
            "paper": _opt("Note paper", ["plain", "grid", "aged", "dot"], "plain"),
            "frame": _stock(STOCKS_LIGHT, "cream"),
            "accent": _accent("green"),
            "font": _font(),
            "texture": _texture("grain"),
            "corners": _corners(),
            **_specialty(),
        },
    },
    {
        "key": "dossier",
        "version": 1,
        "name": "Dossier",
        "description": "Dark card, framed photo and a boxed description panel.",
        "options": {
            "frame": _stock(STOCKS_DARK, "ink"),
            "accent": _accent("gold"),
            "font": _font(),
            "texture": _texture("felt"),
            "corners": _corners(),
            **_specialty(),
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
