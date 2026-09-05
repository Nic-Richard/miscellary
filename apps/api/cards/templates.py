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

# --- shared palettes -------------------------------------------------------
#
# Shared palettes include legacy snapshot tokens so published cards remain valid
# and keep their original rendering.

# "rarity" keeps accents tied to the card's rarity for snapshots without a
# creator-selected ink.
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

# Stock: the board the face is printed on. Every template that offers a stock
# uses the same option name, so one block of CSS serves all of them.
STOCKS_LIGHT = ["cream", "bone", "white", "sand", "linen", "ash", "light"]
STOCKS_DARK = ["slate", "charcoal", "ink", "dark", "forest", "oxblood", "navy", "plum"]
STOCKS_ALL = STOCKS_LIGHT + STOCKS_DARK

# Surface: a seamless tile from scripts/make-card-textures.ps1, laid over the
# stock colour so it works on cream and on ink alike.
TEXTURES = ["linen", "canvas", "grain", "felt", "brushed", "smooth"]

CORNERS = ["round", "soft", "sharp"]

# The card's display face: its title, number and rarity pill. The body copy stays
# on the platform's own text face so a description is always readable.
TYPEFACES = FONTS


def _opt(label: str, values: list[str], default: str, kind: str = "choice") -> dict[str, Any]:
    """One option. `type` tells a client which control to draw; the API only
    ever validates against `values`."""
    return {"label": label, "values": values, "default": default, "type": kind}


def _stock(values: list[str], default: str) -> dict[str, Any]:
    return _opt("Stock", values, default, "swatch")


def _texture(default: str) -> dict[str, Any]:
    return _opt("Surface", TEXTURES, default)


def _corners() -> dict[str, Any]:
    return _opt("Corners", CORNERS, "round")


def _font(default: str = "display") -> dict[str, Any]:
    return _opt("Font", TYPEFACES, default, "font")


def _accent(default: str) -> dict[str, Any]:
    return _opt("Accent", INKS, default, "swatch")


TEMPLATES: list[dict[str, Any]] = [
    # --- photo-forward templates: the picture is the card ---
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
        },
    },
    {
        "key": "minimal",
        "version": 1,
        "name": "Minimal",
        "description": "Edge-to-edge photo with a subtle gradient and small type.",
        "options": {
            "gradient": _opt("Gradient", ["bottom", "top", "none", "full"], "bottom"),
            "accent": _accent("blue"),
            "font": _font(),
            "texture": _texture("smooth"),
            "corners": _corners(),
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
        },
    },
    # --- text templates: a smaller photo above a panel carrying the whole
    # description, the way a trading card carries its rules text ---
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
        },
    },
]

TEMPLATES_BY_KEY = {t["key"]: t for t in TEMPLATES}


def default_config(key: str) -> dict[str, str]:
    template = TEMPLATES_BY_KEY[key]
    return {name: opt["default"] for name, opt in template["options"].items()}


def config_problems(key: str, config: dict[str, Any]) -> list[str]:
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
    return problems
