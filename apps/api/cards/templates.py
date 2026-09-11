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

# One palette, in one order, wherever a colour is picked: the board, the border
# ink, the accent and the set mark all offer the same list. A token names a hue;
# what it resolves to depends on whether it is being printed with or printed on.
COLOURS = [
    "white",
    "haze",
    "ash",
    "silver",
    "graphite",
    "slate",
    "steel",
    "charcoal",
    "ink",
    "bone",
    "cream",
    "butter",
    "linen",
    "sand",
    "straw",
    "ochre",
    "gold",
    "bronze",
    "shell",
    "peach",
    "apricot",
    "melon",
    "copper",
    "ember",
    "umber",
    "rust",
    "cocoa",
    "blush",
    "salmon",
    "coral",
    "red",
    "brick",
    "crimson",
    "garnet",
    "wine",
    "oxblood",
    "petal",
    "powder",
    "peony",
    "blossom",
    "magenta",
    "rose",
    "fuchsia",
    "mulberry",
    "plum",
    "lavender",
    "thistle",
    "lilac",
    "wisteria",
    "amethyst",
    "purple",
    "damson",
    "violet",
    "aubergine",
    "sky",
    "sea",
    "cornflower",
    "blue",
    "azure",
    "ocean",
    "indigo",
    "navy",
    "teal",
    "mint",
    "sage",
    "fern",
    "jade",
    "olive",
    "green",
    "forest",
    "moss",
    "pine",
]

INKS = ["rarity", *COLOURS]
STOCKS_ALL = COLOURS

TEXTURES = ["linen", "canvas", "grain", "felt", "smooth", "brushed"]
TEXTURE_UNLOCKS = {"brushed": "rare"}

CORNERS = ["round", "soft", "sharp"]

BORDER_WIDTHS = ["hairline", "thin", "medium", "thick"]

TINTS = ["none", "warm", "cool", "punch", "faded", "sepia", "mono"]

WINDOWS = ["rule", "none", "mat", "inset"]

SHAPES = ["square", "arch", "circle", "diamond"]

FINISHES = ["matte", "satin", "gloss", "pearl", "metallic"]
FINISH_UNLOCKS = {"pearl": "rare", "metallic": "rare"}

TREATMENTS = ["none", "foil", "holo"]
TREATMENT_UNLOCKS = {"foil": "epic", "holo": "legendary"}

COVERAGES = ["spot", "reverse", "full"]

# How the foil surface is worked. Mirrors SPOT_PATTERNS in
# packages/shared/src/cardMaterial.ts.
FOIL_PATTERNS = ["linear", "mirror", "cosmos", "rainbow"]
FOIL_PATTERN_UNLOCKS = {"rainbow": "legendary"}

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
    return _opt("Corners", CORNERS, "round", "board")


def _board(values: list[str], default: str, texture: str = "linen") -> dict[str, dict[str, Any]]:
    """The board a card is printed on, its tooth, and how it is cut.

    Every template offers every stock. A template is a layout, not a palette,
    so what differs between them is only which board they start on.
    """
    return {
        "stock": _opt("Stock", values, default, "board", "swatch"),
        "texture": _opt("Texture", TEXTURES, texture, "board", unlocks=TEXTURE_UNLOCKS),
        "corners": _cut(),
    }


def _photo() -> dict[str, Any]:
    return _opt("Tint", TINTS, "none", "print")


def _window() -> dict[str, Any]:
    return _opt("Photo window", WINDOWS, "rule", "print")


def _shape() -> dict[str, Any]:
    return _opt("Window shape", SHAPES, "square", "print")


def _border(colour: str = "auto", width: str = "thin") -> dict[str, dict[str, Any]]:
    return {
        "border": _opt("Border ink", ["auto", *INKS], colour, "board", "swatch"),
        "border_width": _opt("Border width", BORDER_WIDTHS, width, "board"),
    }


def _font(title: str = "display", body: str = "body") -> dict[str, dict[str, Any]]:
    """The face the title is set in, and the face everything else is set in.

    The printed identifier is not either of them: it is the same small face on
    every card, so a code reads the same wherever it is seen.
    """
    return {
        "title_typeface": _opt("Title typeface", TYPEFACES, title, "type", "font"),
        "body_typeface": _opt("Body typeface", TYPEFACES, body, "type", "font"),
    }


def _accent(default: str) -> dict[str, dict[str, Any]]:
    """The card's second ink. The set mark is drawn in it too."""
    return {"accent": _opt("Accent", INKS, default, "type", "swatch")}


def _press(coverages: list[str] | None = None) -> dict[str, dict[str, Any]]:
    """Production options shared by every template.

    Relief is not here: the recessed image window and description panel are
    part of every card, and the struck rim follows the tier. None of that is a
    creator decision, so the renderer applies it rather than the config.

    Coverage is the one press option a template narrows: reverse is everything
    but the picture, which needs a card that has somewhere else to be.
    """
    return {
        "finish": _opt("Finish", FINISHES, "matte", "press", unlocks=FINISH_UNLOCKS),
        "treatment": _opt("Foil", TREATMENTS, "none", "press", unlocks=TREATMENT_UNLOCKS),
        "coverage": _opt(
            "Foil covers", coverages or COVERAGES, (coverages or COVERAGES)[0], "press"
        ),
        "pattern": _opt(
            "Foil pattern", FOIL_PATTERNS, "linear", "press", unlocks=FOIL_PATTERN_UNLOCKS
        ),
    }


def _text(
    title_max: int,
    title_min_scale: float,
    printed_label: str | None = None,
    printed_max: int = 0,
    printed_min_scale: float = 1,
    printed_lines: int = 1,
    title_lines: int = 1,
    printed_markup: str = "none",
) -> dict[str, Any]:
    """Printed text limits for one template, mirrored in packages/shared/src/cardText.ts.

    A region shrinks to fit the width or the line budget it is given, down to
    `min_scale`, and `max_length` is the point past which even the smallest
    allowed size would not fit. `markup` says how much of the description
    subset the region prints: nothing, bold and italics, or those plus bullets.
    """
    return {
        "printed_label": printed_label,
        "title": {
            "max_length": title_max,
            "min_scale": title_min_scale,
            "lines": title_lines,
            "markup": "none",
        },
        "printed": {
            "max_length": printed_max,
            "min_scale": printed_min_scale,
            "lines": printed_lines,
            "markup": printed_markup,
        }
        if printed_label
        else None,
    }


TEMPLATES: list[dict[str, Any]] = [
    {
        "key": "fieldnote",
        "version": 1,
        "name": "Classic",
        "description": "Photo above a note panel.",
        "text": _text(30, 0.72, "Printed note", 210, 0.78, 5, printed_markup="block"),
        "options": {
            **_board(STOCKS_ALL, "cream", "grain"),
            **_border(),
            "tint": _photo(),
            "window": _window(),
            "shape": _shape(),
            **_font("marcellus", "spectral"),
            **_accent("green"),
            **_press(),
        },
    },
    {
        "key": "classic",
        "version": 1,
        "name": "Minimal",
        "description": "Framed photo, title bar, caption below.",
        "text": _text(30, 0.72, "Caption", 92, 0.78, 2, printed_markup="inline"),
        "options": {
            **_board(STOCKS_ALL, "bone"),
            **_border(),
            "tint": _photo(),
            "window": _window(),
            "shape": _shape(),
            **_font(),
            **_accent("gold"),
            **_press(),
        },
    },
    {
        "key": "polaroid",
        "version": 1,
        "name": "Polaroid",
        "description": "Photo-first with a handwritten-style caption.",
        "text": _text(50, 0.72, title_lines=2),
        "options": {
            **_board(STOCKS_ALL, "white", "grain"),
            **_border(),
            "tint": _photo(),
            "shape": _shape(),
            **_font("marcellus", "caveat"),
            **_accent("ink"),
            **_press(),
        },
    },
    {
        "key": "bold",
        "version": 1,
        "name": "Bold",
        "description": "Big title, thick border, rarity colour everywhere.",
        "text": _text(30, 0.7, "Subtitle", 100, 0.78, 2, printed_markup="inline"),
        "options": {
            **_board(STOCKS_ALL, "cream", "canvas"),
            **_border("rarity", "medium"),
            "tint": _photo(),
            "shape": _shape(),
            **_font("archivo", "cabin"),
            **_accent("rarity"),
            **_press(),
        },
    },
    {
        "key": "minimal",
        "version": 1,
        "name": "Full Art",
        "description": "Edge-to-edge photo with a subtle gradient and small type.",
        "text": _text(27, 0.72, "Subtitle", 84, 0.78, 2, printed_markup="inline"),
        "unlocks": "epic",
        "options": {
            **_board(STOCKS_ALL, "ink", "smooth"),
            **_border(),
            "tint": _photo(),
            "gradient": _opt("Scrim", ["bottom", "top", "none", "full"], "bottom", "print"),
            **_font("cinzel", "jost"),
            **_accent("blue"),
            **_press(["full"]),
        },
    },
]

CATALOGUE = [t for t in TEMPLATES if not t.get("retired")]

TEMPLATES_BY_KEY = {t["key"]: t for t in TEMPLATES}


# Published snapshots are never rewritten; compatibility translations belong here.
def current_config(config: dict[str, Any]) -> dict[str, Any]:
    return dict(config)


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
    return problems
