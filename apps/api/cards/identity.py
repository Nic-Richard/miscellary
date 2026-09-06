"""Set identity: how a set's pack and cards are branded.

Everything here is cosmetic and creator-chosen. It lives on the set rather than
on each card, so changing it re-skins the set's pack and sleeves without
touching a published card snapshot. Blank values preserve the platform default.

The same lists are mirrored in apps/web/lib/setIdentity.ts, which owns the
artwork and the colour maths.
"""

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

EMBLEM_TEXT_COLOURS = [
    "ink",
    "charcoal",
    "slate",
    "teal",
    "forest",
    "ocean",
    "indigo",
    "violet",
    "plum",
    "rose",
    "crimson",
    "rust",
    "ember",
    "gold",
    "bronze",
    "cream",
    "white",
]
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
    "body",
    "playfair",
    "cinzel",
    "archivo",
    "spacemono",
    "caveat",
    "alfa",
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
