"""Seed comprehensive demo data for local visual and multi-user QA.

The command is safe to run repeatedly because it recreates its demo users.

Card art is fetched from Wikimedia Commons (public, freely licensed photos of
the actual subjects) so the UI is judged against real photography. Pass
--no-photos, or lose the network, and each card falls back to a generated
gradient PNG instead.
"""

import json
import random
import struct
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zlib
from pathlib import Path
from typing import Any, cast

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from cards.models import CardDefinition, CardSet
from cards.publishing import publish_set
from cards.templates import TEMPLATES_BY_KEY, default_config, template_problems
from packs.actions import open_free_pack
from packs.models import OwnedCard
from social.models import Comment, Follow, Reaction, ShowcaseSlot
from trades.models import TradeOffer, TradeOfferItem
from uploads import storage
from uploads.models import Image

# The three original demo accounts carry the hand-picked sets; the rest exist to
# give browse, likes and trading something to work with.
DEMO_EMAILS = [
    "fieldnote@example.com",
    "waverly@example.com",
    "mabel@example.com",
    "orla@example.com",
    "kit@example.com",
    "bex@example.com",
    "sol@example.com",
    "wren@example.com",
]
COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
# What each rarity spends its unlocks on in the demo data, so the seed shows
# the range rather than leaving every card on the plain defaults.
SPECIALTY_BY_RARITY: dict[str, list[dict[str, str]]] = {
    "rare": [
        {"finish": "pearl"},
        {"finish": "metallic", "texture": "brushed"},
        {"finish": "gloss"},
    ],
    "epic": [{"finish": "metallic"}, {"finish": "pearl"}, {"finish": "gloss"}],
    "legendary": [
        {"treatment": "foil", "finish": "matte", "coverage": "frame"},
        {"treatment": "holo", "finish": "gloss", "coverage": "full"},
        {"treatment": "holo", "finish": "satin", "coverage": "art"},
        {"treatment": "foil", "finish": "gloss", "coverage": "art"},
    ],
}

CACHE_DIR = Path("/tmp/miscellary-seed-photos")
PNG_MAGIC = bytes([0x89]) + b"PNG"
AGENT = {"User-Agent": "miscellary-dev/1.0 (seed_demo; local development)"}


def _lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def _jitter(c: int) -> int:
    return max(0, min(255, c + random.randint(-18, 18)))


def make_gradient_png(width: int, height: int, top: tuple, bottom: tuple) -> bytes:
    """A pure-stdlib PNG encoder - no Pillow needed for fallback art."""
    rows = bytearray()
    for y in range(height):
        t = y / max(height - 1, 1)
        r = _lerp(top[0], bottom[0], t)
        g = _lerp(top[1], bottom[1], t)
        b = _lerp(top[2], bottom[2], t)
        rows.append(0)  # filter: none
        rows.extend(bytes((r, g, b)) * width)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(rows), 6)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def jpeg_size(data: bytes) -> tuple[int, int]:
    """Width/height from the first SOF marker; enough for Commons thumbnails."""
    i = 2
    while i < len(data) - 9:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return width, height
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        (length,) = struct.unpack(">H", data[i + 2 : i + 4])
        i += 2 + length
    return 900, 900


# Commons throttles a burst, and this command asks it for dozens of photos in a
# row, so requests are paced and a 429 is waited out rather than silently
# becoming a gradient.
_last_request = 0.0
MIN_GAP = 0.4


def _open(url: str, attempts: int = 3):
    global _last_request
    for attempt in range(attempts):
        gap = time.monotonic() - _last_request
        if gap < MIN_GAP:
            time.sleep(MIN_GAP - gap)
        _last_request = time.monotonic()
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=30)
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == attempts - 1:
                return None
            time.sleep(2**attempt)
        except OSError:
            return None
    return None


def _get(url: str) -> bytes | None:
    response = _open(url)
    if response is None:
        return None
    with response:
        if not response.headers.get("Content-Type", "").startswith("image/"):
            return None
        return response.read()


def search_commons(term: str) -> bytes | None:
    """Resolve a search term to a photo.

    The hand-picked sets name their files exactly, because their art was chosen.
    The sets that exist only to give browse and trading some volume ask Commons
    for something on the subject instead, which beats guessing forty filenames
    and getting gradients wherever a guess was wrong.
    """
    query = urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": f"filetype:bitmap {term}",
            "gsrnamespace": "6",
            "gsrlimit": "6",
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "iiurlwidth": "900",
        }
    )
    response = _open(f"{COMMONS_API}?{query}")
    if response is None:
        return None
    try:
        with response:
            payload = json.loads(response.read())
    except (OSError, ValueError):
        return None
    pages = (payload.get("query") or {}).get("pages") or {}
    # Sorted for a stable pick, so a reseed produces the same art.
    for page in sorted(pages.values(), key=lambda p: p.get("index", 0)):
        info = (page.get("imageinfo") or [{}])[0]
        if not str(info.get("mime", "")).startswith("image/"):
            continue
        data = _get(info.get("thumburl", ""))
        if data:
            return data
    return None


def fetch_commons(spec: str) -> bytes | None:
    """A photo for one card, by exact filename or by `search:` term."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / (uuid.uuid5(uuid.NAMESPACE_URL, spec).hex + ".jpg")
    if cached.exists():
        return cached.read_bytes()
    if spec.startswith("search:"):
        data = search_commons(spec[len("search:") :])
    else:
        data = _get(COMMONS + urllib.parse.quote(spec) + "?width=900")
    if data:
        cached.write_bytes(data)
    return data


class Command(BaseCommand):
    help = "Seed demo sets, cards, and users for local product review."

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-photos",
            action="store_true",
            help="Skip Wikimedia Commons downloads and use gradient placeholders.",
        )

    def handle(self, *args, **options):
        self.use_photos = not options["no_photos"]
        self.fallbacks = 0

        # Delete in dependency order: OwnedCard.card and CardDefinition.image are
        # PROTECT, so cascading straight from User would raise ProtectedError.
        demo_users = User.objects.filter(email__in=DEMO_EMAILS)
        OwnedCard.objects.filter(owner__in=demo_users).delete()
        CardSet.objects.filter(creator__in=demo_users).delete()
        Image.objects.filter(owner__in=demo_users).delete()
        demo_users.delete()

        with transaction.atomic():
            fieldnote = User.objects.create_user(
                "fieldnote@example.com", "fieldnote", "demopass123"
            )
            fieldnote.profile.display_name = "Fieldnote Botanicals"
            fieldnote.profile.bio = "Pressed plants and pocket geology from weekend walks."
            fieldnote.profile.save()

            waverly = User.objects.create_user("waverly@example.com", "waverly", "demopass123")
            waverly.profile.display_name = "Waverly Wax"
            waverly.profile.bio = "Crate-digging one deep cut at a time."
            waverly.profile.save()

            mabel = User.objects.create_user("mabel@example.com", "mabel", "demopass123")
            mabel.profile.display_name = "Mabel"
            mabel.profile.bio = "Collector of small, weird, wonderful things."
            mabel.profile.save()

        Follow.objects.bulk_create(
            [Follow(follower=mabel, following=fieldnote), Follow(follower=mabel, following=waverly)]
        )

        # (title, rarity, template, config, caption, Commons filename)
        plants = self._make_set(
            fieldnote,
            title="Trailside Botanicals",
            mark="leaf",
            pack_colour="moss",
            pack_finish="matte",
            emblem_layout="seal",
            emblem_shape="rosette",
            emblem_style="filled",
            emblem_text="forest",
            surface="grain",
            description="Pressed leaves and wildflowers spotted on weekend hikes.",
            palette=((70, 110, 70), (30, 60, 40)),
            cards=[
                (
                    "Broadleaf Plantain",
                    "common",
                    "classic",
                    {"frame": "light", "accent": "green"},
                    "Roadside verge, Kent",
                    "Plantago major subsp. major sl5.jpg",
                ),
                (
                    "Wild Clover",
                    "common",
                    "classic",
                    {"frame": "light", "accent": "green"},
                    "Meadow edge, Peak District",
                    "Trifolium repens (inflorescense) Edit.jpg",
                ),
                (
                    "Dandelion Puff",
                    "common",
                    "polaroid",
                    {"tint": "none"},
                    "Back garden, May",
                    "Dandelion seed head (Taraxacum officinale).jpg",
                ),
                (
                    "Fern Frond",
                    "common",
                    "fieldnote",
                    {"paper": "aged", "accent": "green"},
                    "Shaded gully, Dartmoor",
                    "Unfurling Fern Fronds - geograph.org.uk - 6840619.jpg",
                ),
                (
                    "Trailside Moss",
                    "common",
                    "polaroid",
                    {"tint": "cool"},
                    "North-facing wall",
                    "Macro Photography of Moss Sporophytes.jpg",
                ),
                (
                    "Chicory Bloom",
                    "uncommon",
                    "classic",
                    {"frame": "light", "accent": "blue"},
                    "Railway cutting, July",
                    "Cichorium intybus-alvesgaspar1.jpg",
                ),
                (
                    "Milkweed Pod",
                    "uncommon",
                    "polaroid",
                    {"tint": "warm"},
                    "Old orchard, September",
                    "Asclepias syriaca seed pod.jpg",
                ),
                (
                    "Foxglove Spire",
                    "rare",
                    "bold",
                    {"shape": "arch"},
                    "Forest clearing, Black Forest",
                    "Digitalis purpurea - Panoramic trail - Northern Black Forest 01.jpg",
                ),
                (
                    "Marsh Orchid",
                    "epic",
                    "bold",
                    {"shape": "circle"},
                    "Wet meadow, June",
                    "Melitaea sp. and Dactylorhiza fuchsii.jpg",
                ),
                (
                    "Ghost Pipe",
                    "legendary",
                    "dossier",
                    {"frame": "ink", "accent": "gold"},
                    "Deep beech woods, after rain",
                    "Monotropa uniflora ghost pipe.jpg",
                ),
            ],
        )
        rocks = self._make_set(
            fieldnote,
            title="Pocket Geology",
            mark="crystal",
            pack_colour="ash",
            pack_finish="satin",
            emblem_layout="stacked",
            emblem_shape="tablet",
            emblem_style="outline",
            emblem_text="slate",
            surface="canvas",
            description="Stones and minerals collected from riverbeds and roadcuts.",
            palette=((120, 112, 98), (58, 52, 44)),
            cards=[
                (
                    "River Quartz",
                    "common",
                    "bold",
                    {"shape": "square"},
                    "Gravel bar, River Wye",
                    "A clear quartz crystal with natural features.jpg",
                ),
                (
                    "Granite Chip",
                    "common",
                    "bold",
                    {"shape": "square"},
                    "Quarry spoil, Aberdeen",
                    "Granite 2641.jpg",
                ),
                (
                    "Slate Flake",
                    "common",
                    "fieldnote",
                    {"paper": "grid", "accent": "blue"},
                    "Sea cliff, Cornwall",
                    "Contorted slate at Hayle Bay - geograph.org.uk - 629405.jpg",
                ),
                (
                    "Basalt Pebble",
                    "common",
                    "classic",
                    {"frame": "dark", "accent": "red"},
                    "Shoreline, Yaquina Head",
                    "Basalt cobble-boulder shoreline (Yaquina Head, Oregon, USA) 3.jpg",
                ),
                (
                    "Sandstone Sliver",
                    "common",
                    "minimal",
                    {"gradient": "top", "accent": "gold"},
                    "Road cut, Vosges",
                    "Sandstone sample, Vosges.jpg",
                ),
                (
                    "Banded Gneiss",
                    "uncommon",
                    "bold",
                    {"shape": "circle"},
                    "Lake shore, Ontario",
                    "Banded gneiss, Six Mile Lake.jpg",
                ),
                (
                    "Rose Quartz",
                    "uncommon",
                    "classic",
                    {"frame": "light", "accent": "purple"},
                    "Flea market find",
                    "Rose Quartz Macro 1.JPG",
                ),
                (
                    "Pyrite Cluster",
                    "rare",
                    "minimal",
                    {"gradient": "bottom", "accent": "gold"},
                    "Mine tailings, Navajun",
                    "Pyrite-232956.jpg",
                ),
                (
                    "Fossil Trilobite",
                    "epic",
                    "dossier",
                    {"frame": "slate", "accent": "gold"},
                    "Museum swap meet",
                    "Trilobite fossil, Desert Museum.jpg",
                ),
                (
                    "Raw Amethyst",
                    "legendary",
                    "bold",
                    {"shape": "circle"},
                    "Geode half, Rio Grande do Sul",
                    "Amethyst-geode 020 7765.jpg",
                ),
            ],
        )
        vinyl = self._make_set(
            waverly,
            title="Deep Cuts",
            mark="record",
            pack_colour="violet",
            pack_finish="holo",
            emblem_layout="wordmark",
            emblem_text="cream",
            surface="brushed",
            description="The records that never leave the crate. Genre-agnostic, mood-specific.",
            palette=((70, 55, 90), (20, 16, 28)),
            cards=[
                (
                    "Late Night Pressing",
                    "common",
                    "minimal",
                    {"gradient": "bottom", "accent": "purple"},
                    "Side B, 33 rpm",
                    "Kazantip, Popovka, Crimea, Technics turntable, Vinyl turntable.jpg",
                ),
                (
                    "B-Side Blue",
                    "common",
                    "minimal",
                    {"gradient": "top", "accent": "blue"},
                    "Translucent blue, 1986",
                    "True Blue vinyl record.jpg",
                ),
                (
                    "First Cut",
                    "common",
                    "fieldnote",
                    {"paper": "plain", "accent": "purple"},
                    "Lead-in groove, 12 inch",
                    "12in-LP-Vinyl-Record-Macro-Grooves.jpg",
                ),
                (
                    "Basement Tape",
                    "common",
                    "classic",
                    {"frame": "dark", "accent": "gold"},
                    "Live at the basement",
                    "Close-up of a dj reaching for a vinyl on the turntable, "
                    "guitar in a blurry background.jpg",
                ),
                (
                    "Corner Store 45",
                    "common",
                    "polaroid",
                    {"tint": "cool"},
                    "7 inch single, 45 rpm",
                    "45 rpm Single Record.jpg",
                ),
                (
                    "Sunday Matinee",
                    "uncommon",
                    "classic",
                    {"frame": "light", "accent": "blue"},
                    "Sleeve notes, read twice",
                    "Man reading vinyl record (Unsplash).jpg",
                ),
                (
                    "Reissue Green Wax",
                    "uncommon",
                    "minimal",
                    {"gradient": "bottom", "accent": "green"},
                    "Coloured reissue, 2019",
                    "Audio-Technica turntable playing coloured vinyl.jpg",
                ),
                (
                    "Test Pressing No. 3",
                    "rare",
                    "bold",
                    {"shape": "square"},
                    "White label, hand numbered",
                    "Vinyl groove macro.jpg",
                ),
                (
                    "Import Only",
                    "epic",
                    "dossier",
                    {"frame": "ink", "accent": "purple"},
                    "Japanese pressing, obi intact",
                    "Jaume Pujagut and his vinyl records sleeve collection.jpg",
                ),
                (
                    "First Pressing, Sealed",
                    "legendary",
                    "minimal",
                    {"gradient": "bottom", "accent": "gold"},
                    "Still in shrink",
                    "Chi Mai 45 rpm vinyl single label detail.jpg",
                ),
            ],
        )

        # Left as a draft (not published) so the editor/publish-checklist screen
        # has something real to show.
        draft = self._make_set(
            fieldnote,
            title="Lantern Festivals (draft)",
            description="A glowing celebration of light and tradition, still being catalogued.",
            palette=((90, 60, 30), (30, 20, 40)),
            cards=[
                (
                    "Chiang Mai Sky Lanterns",
                    "epic",
                    "classic",
                    {"frame": "dark", "accent": "gold"},
                    "Yi Peng, November",
                    "Yi Peng lanterns in Chiang Mai (11067469754).jpg",
                ),
                (
                    "Riverside Ceremony",
                    "common",
                    "polaroid",
                    {"tint": "warm"},
                    "Ping River, Loy Krathong",
                    "Thai people setting their candle-lit krathongs in the Ping river at night "
                    "during Loy Krathong 2015-10 (22715933524).jpg",
                ),
                (
                    "Paper Boat Send-off",
                    "common",
                    "minimal",
                    {"gradient": "bottom", "accent": "gold"},
                    "Floating krathong",
                    "Loi KRATHONG FESTIVAL CHIANG MAI 02.jpg",
                ),
            ],
            publish=False,
        )

        # Everything past this point exists to give browse, likes and trading
        # enough to work with: more collectors, more shelves, and offers in every
        # state the inbox can show.
        extras = self._make_collectors()
        more = self._make_more_sets(fieldnote, waverly, mabel, extras)
        published = [plants, rocks, vinyl, *more]

        everyone = [fieldnote, waverly, mabel, *extras.values()]
        self._open_packs(everyone, published)
        self._add_likes(everyone, published)
        self._add_follows(everyone)
        self._make_showcases(everyone)
        self._add_comments(everyone, published)
        self._make_trades(fieldnote, mabel, extras)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(everyone)} collectors, {len(published)} published sets and a draft."
            )
        )
        if self.fallbacks:
            self.stdout.write(
                self.style.WARNING(
                    f"  {self.fallbacks} photo(s) could not be fetched; used gradients."
                )
            )
        for cs in published:
            self.stdout.write(f"  /sets/{cs.slug}")
        self.stdout.write(f"  /users/{mabel.username}")
        self.stdout.write(f"  /studio/{draft.id}  (draft editor)")

    # ---- volume: collectors, shelves, likes, follows and offers ----------

    COLLECTORS = [
        ("orla", "Orla Finch", "Garden birds, mostly from the kitchen window."),
        ("kit", "Kit Marlow", "Long exposures and colder nights."),
        ("bex", "Bex Ndlovu", "Saturday market, before the good stuff goes."),
        ("sol", "Sol Tanaka", "Small details of large cities."),
        ("wren", "Wren Amari", "Fungi, lichen and the underside of logs."),
    ]

    def _make_collectors(self) -> dict:
        made = {}
        with transaction.atomic():
            for username, display, bio in self.COLLECTORS:
                user = User.objects.create_user(f"{username}@example.com", username, "demopass123")
                user.profile.display_name = display
                user.profile.bio = bio
                user.profile.save()
                made[username] = user
        return made

    def _make_more_sets(self, fieldnote, waverly, mabel, extras) -> list:
        """Eight more shelves, each a different corner of the identity system.

        Their art is searched rather than named, because the point of these sets
        is volume and variety on the browse page rather than curation.
        """
        plans = [
            (
                extras["orla"],
                "Garden Birds",
                "Whatever lands on the feeder, catalogued from the kitchen window.",
                ((120, 150, 190), (40, 60, 90)),
                {
                    "mark": "feather",
                    "pack_colour": "sky",
                    "pack_finish": "gloss",
                    "emblem_layout": "seal",
                    "emblem_shape": "disc",
                    "emblem_style": "filled",
                    "emblem_text": "ocean",
                    "surface": "linen",
                },
                [
                    (
                        "European Robin",
                        "common",
                        "classic",
                        {"frame": "cream"},
                        "Hedge, January",
                        "search:European robin bird",
                    ),
                    (
                        "Blue Tit",
                        "common",
                        "polaroid",
                        {"tint": "cool"},
                        "Feeder, first light",
                        "search:Eurasian blue tit",
                    ),
                    (
                        "Goldfinch",
                        "common",
                        "minimal",
                        {"gradient": "bottom"},
                        "Thistle heads",
                        "search:European goldfinch",
                    ),
                    (
                        "Long-tailed Tit",
                        "uncommon",
                        "classic",
                        {"frame": "bone"},
                        "In a party of nine",
                        "search:long-tailed tit",
                    ),
                    (
                        "Wren",
                        "rare",
                        "fieldnote",
                        {"paper": "grid"},
                        "Loud for its size",
                        "search:eurasian wren bird",
                    ),
                    (
                        "Kingfisher",
                        "legendary",
                        "bold",
                        {"shape": "circle", "border": "ocean"},
                        "Once, by the culvert",
                        "search:common kingfisher",
                    ),
                ],
            ),
            (
                extras["kit"],
                "Night Sky",
                "Long exposures from the back garden and colder places.",
                ((30, 30, 70), (10, 10, 25)),
                {
                    "mark": "moon",
                    "pack_colour": "indigo",
                    "pack_finish": "satin",
                    "emblem_layout": "wordmark",
                    "emblem_text": "cream",
                    "surface": "felt",
                },
                [
                    (
                        "Waxing Crescent",
                        "common",
                        "minimal",
                        {"gradient": "full"},
                        "Four days old",
                        "search:waxing crescent moon",
                    ),
                    (
                        "Orion",
                        "common",
                        "classic",
                        {"frame": "ink"},
                        "Winter, due south",
                        "search:Orion constellation",
                    ),
                    (
                        "Milky Way Core",
                        "common",
                        "minimal",
                        {"gradient": "none"},
                        "August, no moon",
                        "search:milky way galactic core",
                    ),
                    (
                        "Noctilucent Cloud",
                        "uncommon",
                        "polaroid",
                        {"tint": "cool"},
                        "Late June, north",
                        "search:noctilucent clouds",
                    ),
                    (
                        "Aurora",
                        "rare",
                        "bold",
                        {"shape": "arch", "border": "teal"},
                        "The night it came south",
                        "search:aurora borealis",
                    ),
                    (
                        "Total Eclipse",
                        "legendary",
                        "dossier",
                        {"frame": "ink"},
                        "Two minutes of it",
                        "search:total solar eclipse corona",
                    ),
                ],
            ),
            (
                extras["bex"],
                "Market Saturday",
                "The good stuff, before it goes.",
                ((200, 120, 60), (90, 40, 30)),
                {
                    "mark": "bloom",
                    "pack_colour": "ember",
                    "pack_finish": "gloss",
                    "emblem_layout": "badge",
                    "emblem_shape": "banner",
                    "emblem_style": "filled",
                    "emblem_text": "crimson",
                    "surface": "grain",
                },
                [
                    (
                        "Heritage Tomatoes",
                        "common",
                        "polaroid",
                        {"tint": "warm"},
                        "Six kinds, one crate",
                        "search:heirloom tomatoes market",
                    ),
                    (
                        "Bunched Radish",
                        "common",
                        "classic",
                        {"frame": "cream"},
                        "Still muddy",
                        "search:radish bunch market",
                    ),
                    (
                        "Sourdough",
                        "common",
                        "fieldnote",
                        {"paper": "aged"},
                        "Sold out by ten",
                        "search:sourdough bread loaf",
                    ),
                    (
                        "Cut Flowers",
                        "uncommon",
                        "minimal",
                        {"gradient": "bottom"},
                        "Buckets by the door",
                        "search:cut flowers market stall",
                    ),
                    (
                        "Wheel of Cheese",
                        "rare",
                        "bold",
                        {"shape": "circle", "border": "gold"},
                        "Cut to order",
                        "search:cheese wheel market",
                    ),
                    (
                        "First Cherries",
                        "legendary",
                        "classic",
                        {"frame": "oxblood"},
                        "Two weeks a year",
                        "search:fresh cherries bowl",
                    ),
                ],
            ),
            (
                extras["sol"],
                "City Details",
                "The parts of a city you only see standing still.",
                ((90, 90, 100), (30, 30, 35)),
                {
                    "mark": "arrowhead",
                    "pack_colour": "charcoal",
                    "pack_finish": "matte",
                    "emblem_layout": "stacked",
                    "emblem_shape": "tablet",
                    "emblem_style": "outline",
                    "emblem_text": "white",
                    "surface": "brushed",
                },
                [
                    (
                        "Manhole Cover",
                        "common",
                        "bold",
                        {"shape": "circle", "border": "slate"},
                        "Cast 1911",
                        "search:decorative manhole cover",
                    ),
                    (
                        "Fire Escape",
                        "common",
                        "minimal",
                        {"gradient": "top"},
                        "Looking up",
                        "search:fire escape building",
                    ),
                    (
                        "Tiled Subway",
                        "common",
                        "classic",
                        {"frame": "slate"},
                        "Original tilework",
                        "search:subway station tile mosaic",
                    ),
                    (
                        "Painted Sign",
                        "uncommon",
                        "polaroid",
                        {"tint": "faded"},
                        "Ghost of a shop",
                        "search:ghost sign painted wall",
                    ),
                    (
                        "Clock Face",
                        "rare",
                        "dossier",
                        {"frame": "charcoal"},
                        "Still keeping time",
                        "search:public clock tower face",
                    ),
                    (
                        "Neon",
                        "legendary",
                        "minimal",
                        {"gradient": "full"},
                        "The last one on the street",
                        "search:neon sign night city",
                    ),
                ],
            ),
            (
                extras["wren"],
                "Undergrowth",
                "Fungi, lichen and the underside of logs.",
                ((70, 90, 60), (25, 35, 25)),
                {
                    "mark": "drop",
                    "pack_colour": "forest",
                    "pack_finish": "matte",
                    "emblem_layout": "crest",
                    "emblem_shape": "shield",
                    "emblem_style": "filled",
                    "emblem_text": "cream",
                    "surface": "canvas",
                },
                [
                    (
                        "Turkey Tail",
                        "common",
                        "fieldnote",
                        {"paper": "plain"},
                        "Dead beech, October",
                        "search:trametes versicolor turkey tail",
                    ),
                    (
                        "Cup Lichen",
                        "common",
                        "classic",
                        {"frame": "sand"},
                        "On a fence post",
                        "search:cladonia cup lichen",
                    ),
                    (
                        "Shaggy Inkcap",
                        "common",
                        "polaroid",
                        {"tint": "none"},
                        "Gone by evening",
                        "search:coprinus comatus shaggy ink cap",
                    ),
                    (
                        "Fly Agaric",
                        "uncommon",
                        "bold",
                        {"shape": "arch", "border": "red"},
                        "Under birch",
                        "search:amanita muscaria",
                    ),
                    (
                        "Earthstar",
                        "rare",
                        "fieldnote",
                        {"paper": "dot"},
                        "Opened after rain",
                        "search:geastrum earthstar fungus",
                    ),
                    (
                        "Chicken of the Woods",
                        "legendary",
                        "dossier",
                        {"frame": "forest"},
                        "Head height, on oak",
                        "search:laetiporus sulphureus",
                    ),
                ],
            ),
            (
                mabel,
                "Small Weird Wonderful",
                "Things that are none of my business but came home anyway.",
                ((160, 110, 170), (60, 30, 70)),
                {
                    "mark": "star",
                    "pack_colour": "orchid",
                    "pack_finish": "holo",
                    "emblem_layout": "seal",
                    "emblem_shape": "rosette",
                    "emblem_style": "filled",
                    "emblem_text": "plum",
                    "surface": "felt",
                },
                [
                    (
                        "Glass Marble",
                        "common",
                        "bold",
                        {"shape": "circle", "border": "violet"},
                        "Found in a wall",
                        "search:glass marble macro",
                    ),
                    (
                        "Brass Key",
                        "common",
                        "fieldnote",
                        {"paper": "aged"},
                        "Fits nothing",
                        "search:antique brass key",
                    ),
                    (
                        "Sea Glass",
                        "common",
                        "polaroid",
                        {"tint": "cool"},
                        "Green, frosted",
                        "search:sea glass beach",
                    ),
                    (
                        "Clockwork",
                        "uncommon",
                        "dossier",
                        {"frame": "plum"},
                        "From a dead watch",
                        "search:pocket watch movement gears",
                    ),
                    (
                        "Pressed Fern",
                        "rare",
                        "classic",
                        {"frame": "bone"},
                        "In a library book",
                        "search:pressed fern herbarium",
                    ),
                    (
                        "Meteorite Slice",
                        "legendary",
                        "minimal",
                        {"gradient": "bottom"},
                        "Etched, Widmanstatten",
                        "search:widmanstatten pattern meteorite",
                    ),
                ],
            ),
            (
                waverly,
                "Tape Decks",
                "Machines that made the mixtapes.",
                ((150, 90, 60), (50, 30, 25)),
                {
                    "mark": "bolt",
                    "pack_colour": "rust",
                    "pack_finish": "satin",
                    "emblem_layout": "badge",
                    "emblem_shape": "hex",
                    "emblem_style": "filled",
                    "emblem_text": "gold",
                    "surface": "brushed",
                },
                [
                    (
                        "Cassette",
                        "common",
                        "classic",
                        {"frame": "dark"},
                        "Ninety minutes",
                        "search:compact cassette tape",
                    ),
                    (
                        "Walkman",
                        "common",
                        "polaroid",
                        {"tint": "warm"},
                        "Belt clip long gone",
                        "search:portable cassette player",
                    ),
                    (
                        "Boombox",
                        "common",
                        "bold",
                        {"shape": "square", "border": "bronze"},
                        "Two D cells short",
                        "search:boombox radio cassette",
                    ),
                    (
                        "Reel to Reel",
                        "uncommon",
                        "dossier",
                        {"frame": "oxblood"},
                        "Ten inch reels",
                        "search:reel to reel tape recorder",
                    ),
                    (
                        "Dolby Deck",
                        "rare",
                        "minimal",
                        {"gradient": "bottom"},
                        "Noise reduction on",
                        "search:cassette deck hifi",
                    ),
                    (
                        "Studio Multitrack",
                        "legendary",
                        "classic",
                        {"frame": "ink"},
                        "Sixteen tracks of it",
                        "search:multitrack tape recorder studio",
                    ),
                ],
            ),
            (
                fieldnote,
                "Coast Path",
                "A week of walking, west to east.",
                ((90, 140, 150), (30, 60, 70)),
                {
                    "mark": "waves",
                    "pack_colour": "ocean",
                    "pack_finish": "gloss",
                    "emblem_layout": "seal",
                    "emblem_shape": "hex",
                    "emblem_style": "filled",
                    "emblem_text": "teal",
                    "surface": "grain",
                },
                [
                    (
                        "Thrift in Flower",
                        "common",
                        "classic",
                        {"frame": "bone"},
                        "Cliff top, May",
                        "search:armeria maritima thrift flower",
                    ),
                    (
                        "Limpet",
                        "common",
                        "bold",
                        {"shape": "circle", "border": "slate"},
                        "Low tide",
                        "search:limpet shell rock",
                    ),
                    (
                        "Marram Grass",
                        "common",
                        "minimal",
                        {"gradient": "bottom"},
                        "Holding the dune",
                        "search:marram grass dune",
                    ),
                    (
                        "Gannet",
                        "uncommon",
                        "polaroid",
                        {"tint": "cool"},
                        "Off the head",
                        "search:northern gannet",
                    ),
                    (
                        "Storm Beach",
                        "rare",
                        "fieldnote",
                        {"paper": "grid"},
                        "After the westerly",
                        "search:storm beach pebbles coast",
                    ),
                    (
                        "Green Flash",
                        "legendary",
                        "minimal",
                        {"gradient": "full"},
                        "Seen once, briefly",
                        "search:sunset sea horizon",
                    ),
                ],
            ),
        ]

        made = []
        for creator, title, description, palette, identity, cards in plans:
            made.append(
                self._make_set(
                    creator,
                    title=title,
                    description=description,
                    palette=palette,
                    cards=cards,
                    **cast(Any, identity),
                )
            )
        return made

    def _open_packs(self, users, sets) -> None:
        """Spread openings around, so opening counts and inventories differ."""
        for user in users:
            for card_set in sets:
                if card_set.creator_id == user.id:
                    continue
                if random.random() < 0.55:
                    open_free_pack(user, card_set)

    def _add_likes(self, users, sets) -> None:
        """Likes on sets and on single cards, so Popular sorts by something."""
        reactions = []
        for card_set in sets:
            for user in users:
                if user.id == card_set.creator_id:
                    continue
                if random.random() < 0.5:
                    reactions.append(Reaction(user=user, card_set=card_set))
            for card in card_set.cards.all():
                for user in users:
                    if random.random() < 0.18:
                        reactions.append(Reaction(user=user, card=card))
        Reaction.objects.bulk_create(reactions, ignore_conflicts=True)

    def _add_follows(self, users) -> None:
        follows = []
        for follower in users:
            for following in users:
                if follower.id == following.id:
                    continue
                if random.random() < 0.35:
                    follows.append(Follow(follower=follower, following=following))
        Follow.objects.bulk_create(follows, ignore_conflicts=True)

    def _make_showcases(self, users) -> None:
        slots: list[ShowcaseSlot] = []
        for user in users:
            owned = list(user.owned_cards.select_related("card").order_by("?")[:6])
            # Some profiles are left part-filled on purpose, to show empty slots.
            keep = owned if random.random() < 0.6 else owned[:3]
            slots.extend(
                ShowcaseSlot(user=user, position=i, owned_card=o) for i, o in enumerate(keep)
            )
        ShowcaseSlot.objects.bulk_create(slots, ignore_conflicts=True)

    def _add_comments(self, users, sets) -> None:
        """A thread under most sets, so the comment section is never a blank page
        in development. The lines are deliberately the kind a collector writes:
        a pull worth mentioning, a question about a rarity, a trade going
        begging, and the creator answering some of them."""
        openers = [
            "Pulled the {card} on my second pack and genuinely gasped.",
            "Is the {card} meant to be {rarity}? Feels rarer than that to me.",
            "Anyone got a spare {card}? Happy to trade a duplicate for it.",
            "Ten packs deep and still no {card}. It is personal now.",
            "The framing on the {card} is doing a lot of work. Lovely set.",
            "Just finished this one. The {card} was the last hole in the page.",
            "How long did the {card} take to shoot? The light on it is unfair.",
        ]
        replies = [
            "Same, still chasing it.",
            "Seconding this. It took me about fifteen packs.",
            "Trade you a duplicate for it if you still need one.",
            "Right? Best card in the set by a distance.",
        ]
        creator_replies = [
            "That one took the longest to shoot. Waited three evenings for the light.",
            "Rarity is on purpose. It turns up as often as the others, just later in the run.",
            "Thanks. That card nearly did not make the cut.",
            "Good eye. I reshot it twice before it worked.",
        ]

        for card_set in sets:
            cards = list(card_set.cards.all())
            if not cards:
                continue
            talkers = [u for u in users if u.id != card_set.creator_id]
            for _ in range(random.randint(0, 4)):
                card = random.choice(cards)
                top = Comment.objects.create(
                    card_set=card_set,
                    author=random.choice(talkers),
                    body=random.choice(openers).format(card=card.title, rarity=card.rarity),
                )
                for _ in range(random.randint(0, 2)):
                    creator = random.random() < 0.45
                    Comment.objects.create(
                        card_set=card_set,
                        author=card_set.creator if creator else random.choice(talkers),
                        parent=top,
                        body=random.choice(creator_replies if creator else replies),
                    )

    def _make_trades(self, fieldnote, mabel, extras) -> None:
        """Offers in every state the inbox, outbox and history can show.

        A card in a pending offer comes back held and cannot go into another, so
        each offer draws from a pool that has not been spent yet.
        """
        pools: dict = {}

        def take(user, count):
            pool = pools.setdefault(
                user.id, list(user.owned_cards.select_related("card").order_by("?"))
            )
            picked, pool[:] = pool[:count], pool[count:]
            return picked

        def offer(sender, recipient, give_n, want_n, status, message=""):
            give = take(sender, give_n)
            want = take(recipient, want_n)
            if len(give) < give_n or len(want) < want_n:
                return None
            made = TradeOffer.objects.create(
                sender=sender, recipient=recipient, status=status, message=message
            )
            TradeOfferItem.objects.bulk_create(
                [TradeOfferItem(offer=made, owned_card=c, side="give") for c in give]
                + [TradeOfferItem(offer=made, owned_card=c, side="want") for c in want]
            )
            return made

        orla, kit = extras["orla"], extras["kit"]
        # Waiting on fieldnote
        offer(mabel, fieldnote, 2, 1, "pending", "Two of mine for the robin?")
        offer(orla, fieldnote, 1, 2, "pending", "Long shot, but worth asking.")
        # Sent by fieldnote
        offer(fieldnote, kit, 1, 1, "pending", "Straight swap if you are up for it.")
        # Settled, for the history tab
        offer(kit, fieldnote, 1, 1, "accepted", "Good trade.")
        offer(fieldnote, orla, 2, 2, "rejected")

    def _make_set(
        self,
        creator,
        *,
        title,
        description,
        palette,
        cards,
        publish: bool = True,
        mark="",
        pack_colour="",
        pack_finish="",
        emblem_layout="",
        emblem_shape="",
        emblem_style="",
        emblem_text="",
        surface="",
    ) -> CardSet:
        card_set = CardSet.objects.create(
            creator=creator,
            title=title,
            description=description,
            mark=mark,
            pack_colour=pack_colour,
            pack_finish=pack_finish,
            emblem_layout=emblem_layout,
            emblem_shape=emblem_shape,
            emblem_style=emblem_style,
            emblem_text=emblem_text,
        )
        top, bottom = palette
        for i, (name, rarity, template_key, config, caption, photo) in enumerate(cards):
            card_top = tuple(_jitter(c) for c in top)
            card_bottom = tuple(_jitter(c) for c in bottom)
            image = self._upload_art(creator, photo, card_top, card_bottom)
            if template_problems(template_key, rarity):
                template_key = "classic"
            template = TEMPLATES_BY_KEY[template_key]
            full_config = {**default_config(template_key), **config}
            if surface and "texture" in full_config and "texture" not in config:
                full_config["texture"] = surface
            spend = SPECIALTY_BY_RARITY.get(rarity)
            if spend:
                # Name hashing keeps treatment choices varied but deterministic.
                for option, value in spend[zlib.crc32(name.encode()) % len(spend)].items():
                    if option not in config and option in template["options"]:
                        full_config[option] = value
            CardDefinition.objects.create(
                card_set=card_set,
                image=image,
                title=name,
                rarity=rarity,
                description=f"{caption}\n\nOne of the {title.lower()} - card {i + 1}.",
                template_key=template_key,
                template_version=template["version"],
                template_config=full_config,
                position=i,
            )
        first = card_set.cards.order_by("position").first()
        if first:
            card_set.cover = first.image
            card_set.save(update_fields=["cover"])
        if not publish:
            return card_set
        problems = publish_set(card_set)
        if problems:
            raise RuntimeError(f"Could not publish {title}: {problems}")
        # publish_set() commits through its own re-fetched instance; refresh so
        # the object we return doesn't still read status="draft" in memory.
        card_set.refresh_from_db()
        return card_set

    def _upload_art(self, owner, photo, top, bottom) -> Image:
        data = fetch_commons(photo) if self.use_photos else None
        if data and data[:4] == PNG_MAGIC:
            # A searched photo can come back as a PNG thumbnail, so the format is
            # sniffed rather than assumed; storing one under image/jpeg would
            # leave the browser to guess.
            width, height = struct.unpack(">II", data[16:24])
            content_type, ext = "image/png", "png"
        elif data:
            width, height = jpeg_size(data)
            content_type, ext = "image/jpeg", "jpg"
        else:
            if self.use_photos:
                self.fallbacks += 1
            width, height = 700, 980
            data = make_gradient_png(width, height, top, bottom)
            content_type, ext = "image/png", "png"
        key = f"card/seed-{uuid.uuid4().hex}.{ext}"
        storage.client().put_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return Image.objects.create(
            owner=owner,
            kind=Image.Kind.CARD,
            key=key,
            content_type=content_type,
            size=len(data),
            width=width,
            height=height,
            ready=True,
        )
