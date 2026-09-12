"""Set identity constants and validation."""

# Mirrored by COLOUR_ROWS in apps/web/lib/palette.ts.
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

SET_MARKS = [
    "waves",
    "leaf",
    "peaks",
    "crystal",
    "record",
    "feather",
    "star",
    "shell",
    "bolt",
    "moon",
    "flame",
    "drop",
    "key",
    "bloom",
    "orbit",
    "arrowhead",
    "acorn",
    "anchor",
    "beetle",
    "butterfly",
    "cactus",
    "cloud",
    "cog",
    "compass",
    "fern",
    "fish",
    "honeycomb",
    "lantern",
    "mushroom",
    "pine",
    "snowflake",
    "sprout",
]
MARK_CHOICES = [(m, m.title()) for m in SET_MARKS] + [("none", "No mark")]

PACK_COLOURS = [
    "mint",
    "moss",
    "forest",
    "ocean",
    "sky",
    "indigo",
    "violet",
    "orchid",
    "rose",
    "crimson",
    "ember",
    "rust",
    "gold",
    "bronze",
    "sand",
    "cream",
    "white",
    "silver",
    "ash",
    "slate",
    "charcoal",
    "black",
]
PACK_COLOUR_CHOICES = [(c, c.title()) for c in PACK_COLOURS]

# Mirrored in apps/web/lib/setIdentity.ts for client-side rendering.
BINDER_COLOURS = [
    "teal",
    "moss",
    "forest",
    "ocean",
    "indigo",
    "plum",
    "oxblood",
    "rust",
    "tan",
    "sand",
    "slate",
    "charcoal",
]
BINDER_COLOUR_CHOICES = [(c, c.title()) for c in BINDER_COLOURS]

PACK_LAYER_KINDS = ["image", "emblem"]

PACK_FINISHES = ["gloss", "satin", "matte", "holo"]
PACK_FINISH_CHOICES = [(f, f.title()) for f in PACK_FINISHES]

EMBLEM_LAYOUTS = ["seal", "stacked", "wordmark", "badge", "crest"]
EMBLEM_LAYOUT_CHOICES = [(v, v.title()) for v in EMBLEM_LAYOUTS]

EMBLEM_SHAPES = ["disc", "shield", "banner", "diamond", "hex", "rosette", "tablet", "none"]
EMBLEM_SHAPE_CHOICES = [(s, s.title()) for s in EMBLEM_SHAPES]

EMBLEM_STYLES = ["filled", "outline", "transparent"]
EMBLEM_STYLE_CHOICES = [(s, s.title()) for s in EMBLEM_STYLES]

EMBLEM_TEXT_COLOURS = COLOURS
EMBLEM_TEXT_CHOICES = [(c, c.title()) for c in EMBLEM_TEXT_COLOURS]

SCALE_MIN = 60
SCALE_MAX = 140

ART_SCALE_MIN = 20
ART_SCALE_MAX = 300
ART_SCALE_DEFAULT = 70
ART_OFFSET_MIN = -45
ART_OFFSET_MAX = 45
ART_ROTATE_MIN = -180
ART_ROTATE_MAX = 180
ART_OPACITY_MIN = 10
ART_OPACITY_MAX = 100

PACK_LAYER_MAX = 5

PACK_SIZE_MIN = 1
PACK_SIZE_MAX = 10
PACK_SIZE_DEFAULT = 10


# Mirrored in apps/web/lib/fonts.ts, which owns font loading.
FONTS = [
    "display",
    "oswald",
    "archivo",
    "alfa",
    "marcellus",
    "cinzel",
    "playfair",
    "garamond",
    "spectral",
    "body",
    "cabin",
    "jost",
    "spacemono",
    "caveat",
]
FONT_CHOICES = [(f, f.title()) for f in FONTS]

PACK_TEXT_MAX_LAYERS = 6
PACK_TEXT_MAX_LENGTH = 40
TEXT_SIZE_MIN = 2
TEXT_SIZE_MAX = 26
TEXT_OFFSET_MIN = -50
TEXT_OFFSET_MAX = 50
TEXT_ROTATE_MIN = -90
TEXT_ROTATE_MAX = 90
TEXT_TRACKING_MIN = -5
TEXT_TRACKING_MAX = 60

PACK_SUBTITLE_MAX_LENGTH = 40

# 00 is reserved, so published suffixes run from 01 through ZZ.
SET_CODE_LENGTH = 3
SET_SUFFIX_LENGTH = 2
SET_SUFFIX_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
SET_SUFFIX_FIRST = 1
SET_SUFFIX_LAST = len(SET_SUFFIX_DIGITS) ** SET_SUFFIX_LENGTH - 1
_SET_CODE_STOPWORDS = {"a", "an", "and", "at", "for", "in", "my", "of", "on", "the", "to"}


def set_code_problems(value: str) -> list[str]:
    if not value:
        return []
    if len(value) != SET_CODE_LENGTH:
        return [f"A set code is exactly {SET_CODE_LENGTH} characters."]
    if not value.isascii() or not value.isalnum() or value.upper() != value:
        return ["A set code uses capital letters and digits only."]
    return []


def suggest_set_code(title: str) -> str:
    """A code drawn from the title: initials first, then its opening letters."""
    words = [
        word
        for word in ("".join(c if c.isalnum() else " " for c in title)).split()
        if word.lower() not in _SET_CODE_STOPWORDS
    ]
    initials = "".join(word[0] for word in words).upper()
    if len(initials) >= SET_CODE_LENGTH:
        return initials[:SET_CODE_LENGTH]
    letters = "".join(words).upper()
    return (letters + "SET")[:SET_CODE_LENGTH]


def set_suffix(index: int) -> str:
    """The base-36 suffix for a one-based position in the sequence."""
    digits = ""
    for _ in range(SET_SUFFIX_LENGTH):
        index, remainder = divmod(index, len(SET_SUFFIX_DIGITS))
        digits = SET_SUFFIX_DIGITS[remainder] + digits
    return digits


def next_set_suffix(taken: set[str]) -> str:
    """The lowest suffix this base code has not used yet."""
    for index in range(SET_SUFFIX_FIRST, SET_SUFFIX_LAST + 1):
        suffix = set_suffix(index)
        if suffix not in taken:
            return suffix
    raise ValueError("Every suffix for this set code is already taken.")


def printed_set_code(code: str, suffix: str) -> str:
    return f"{code}-{suffix}" if code and suffix else ""
