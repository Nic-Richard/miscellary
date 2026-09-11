"""Seed comprehensive demo data for local visual and multi-user QA.

This command deletes and recreates demo users and their collections.
Use --prepare-photos to cache seed photography without changing the database.
Photo downloads must succeed before reseeding; --no-photos uses placeholders.
"""

import html
import json
import random
import re
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
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from cards.identity import BINDER_COLOURS
from cards.markdown import description_issues
from cards.models import CardDefinition, CardSet
from cards.publishing import publish_set
from cards.templates import TEMPLATES_BY_KEY, config_problems, default_config, template_problems
from packs.actions import open_free_pack
from packs.models import OwnedCard
from social.models import SHOWCASE_SLOTS, Comment, Follow, Reaction, ShowcaseSlot
from trades.models import TradeOffer, TradeOfferItem
from uploads import storage
from uploads.models import Image

DEMO_EMAILS = [
    "fieldnote@example.com",
    "waverly@example.com",
    "mabel@example.com",
    "ellis@example.com",
    "mara@example.com",
    "devon@example.com",
    "orla@example.com",
    "kit@example.com",
    "bex@example.com",
    "sol@example.com",
    "wren@example.com",
]
COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
SPECIALTY_BY_RARITY: dict[str, list[dict[str, str]]] = {
    "uncommon": [{}, {}, {"tint": "punch"}],
    "rare": [
        {"finish": "pearl"},
        {"finish": "metallic", "texture": "brushed"},
        {"finish": "gloss", "window": "mat"},
    ],
    "epic": [
        {"finish": "metallic"},
        {"finish": "pearl"},
        {"finish": "gloss"},
    ],
    "legendary": [
        {"treatment": "foil", "finish": "matte", "coverage": "reverse"},
        {"treatment": "holo", "finish": "gloss", "coverage": "full"},
        {"treatment": "holo", "finish": "satin", "coverage": "spot"},
        {"treatment": "foil", "finish": "gloss", "coverage": "spot"},
    ],
}
DEMO_CORNER_CUTS = ("round", "round", "soft", "sharp")


def copy(printed: str, description: str) -> tuple[str, str]:
    return printed, description


LAUNCH_EXPANSIONS = {
    "Plants Along the Trail": [
        (
            "Red Maple",
            "common",
            "classic",
            {"stock": "bone", "accent": "rust"},
            copy(
                "*Acer rubrum*. Red in the spring flowers, red in the autumn leaf, red in the "
                "twigs between.",
                "One fallen maple leaf, still deep red, lying in a patch of light on the dark "
                "ground.",
            ),
            "search:Acer rubrum red maple leaves",
        ),
        (
            "Wood Sorrel",
            "common",
            "polaroid",
            {"tint": "cool"},
            copy(
                "",
                "A spreading patch of wood sorrel over damp ground, with one small white flower "
                "open in it.",
            ),
            "search:Oxalis acetosella wood sorrel",
        ),
        (
            "Yarrow",
            "common",
            "fieldnote",
            {"accent": "green"},
            copy(
                "**Achillea millefolium**\n- Flat-topped heads of many small florets\n- Leaves "
                "finely divided, almost feathery\n- Dry verges, meadows and roadsides",
                "A flat-topped yarrow head in full flower, with a pale crab spider sitting among "
                "the florets.",
            ),
            "search:Achillea millefolium yarrow flower",
        ),
        (
            "Hawthorn Berries",
            "common",
            "classic",
            {"stock": "cream", "accent": "red"},
            copy(
                "*Crataegus monogyna*. One seed to a haw, which is where the *monogyna* comes "
                "from.",
                "Hawthorn fruit part way to ripe, orange on one side and red on the other, hanging "
                "among the lobed leaves.",
            ),
            "Ripening Hawthorn Berries - geograph.org.uk - 936373.jpg",
        ),
        (
            "Beech Mast",
            "common",
            "fieldnote",
            {"stock": "forest", "accent": "ochre"},
            copy(
                "**Fagus sylvatica**\n- Each husk holds two triangular nuts\n- Heavy crops arrive "
                "only every few years\n- A mast year feeds birds and mammals alike",
                "Beech husks still shut on the branch, sitting among the leaves before they open "
                "and drop.",
            ),
            "search:Fagus sylvatica beech mast nuts",
        ),
        (
            "Meadowsweet",
            "uncommon",
            "polaroid",
            {"tint": "faded"},
            copy(
                "",
                "Cream meadowsweet plumes in full flower, held above the leaves on reddish stems.",
            ),
            "search:Filipendula ulmaria meadowsweet",
        ),
        (
            "Teasel",
            "uncommon",
            "bold",
            {"stock": "sage", "shape": "circle", "border": "ochre"},
            copy(
                "*Dipsacus fullonum*. The dry heads stand all winter, and goldfinches work them "
                "for seed.",
                "A dry teasel head with its spines intact and a tuft of fresh green growth pushing "
                "out of the top.",
            ),
            "search:Dipsacus fullonum teasel seed head",
        ),
        (
            "Rowan",
            "rare",
            "fieldnote",
            {"accent": "red", "finish": "pearl"},
            copy(
                "**Sorbus aucuparia**\n- Pinnate leaves and berries in dense bunches\n- Grows "
                "higher up a hill than most trees\n- Thrushes and waxwings strip it bare",
                "A cut rowan branch photographed against black, carrying a full cluster of red "
                "berries under its pinnate leaves.",
            ),
            "search:Sorbus aucuparia rowan berries",
        ),
        (
            "Early Purple Orchid",
            "rare",
            "classic",
            {"stock": "lavender", "accent": "plum", "finish": "metallic"},
            copy(
                "*Orchis mascula*. One of the first orchids out, on chalk and in old woodland.",
                "An early purple orchid in full flower, the hooded blooms working their way up the "
                "spike.",
            ),
            "search:Orchis mascula early purple orchid",
        ),
        (
            "Sea Holly",
            "epic",
            "minimal",
            {"gradient": "full", "accent": "gold", "finish": "pearl"},
            copy(
                "*Eryngium maritimum*. Waxy blue-grey leaves hold water on open shingle.",
                "One low sea holly plant out among the shingle, with the beach running back to the "
                "dunes behind it.",
            ),
            "search:Eryngium maritimum sea holly",
        ),
    ],
    "Pocket Geology": [
        (
            "Chert Nodule",
            "common",
            "classic",
            {"stock": "ash", "accent": "slate"},
            copy(
                "Microcrystalline silica formed inside chalk and limestone. Breaks with a curved "
                "face.",
                "A slab of chert broken open, weathered pink along the top and fine grey inside.",
            ),
            "search:chert nodule rock specimen",
        ),
        (
            "Gneiss Band",
            "common",
            "bold",
            {"stock": "sand", "shape": "square", "border": "charcoal"},
            copy(
                "High-grade metamorphic rock. Heat and pressure sorted its minerals into pale and "
                "dark bands.",
                "A cut face of gneiss with pale and dark bands folded into a tight hook.",
            ),
            "search:banded gneiss rock specimen",
        ),
        (
            "Pumice",
            "common",
            "polaroid",
            {"tint": "faded"},
            copy(
                "",
                "A worn piece of pumice, its whole surface full of the small cavities gas left "
                "behind.",
            ),
            "Pumice Stone.jpg",
        ),
        (
            "Mudstone",
            "common",
            "fieldnote",
            {"accent": "slate"},
            copy(
                "**Mudstone**\n- Silt and clay settled out in still water\n- Splits along thin "
                "bedding planes\n- Fossils survive best where the grain is finest",
                "A blocky mudstone specimen on display, with the printed label naming the "
                "formation behind it.",
            ),
            "search:mudstone rock sample",
        ),
        (
            "Conglomerate",
            "common",
            "classic",
            {"stock": "cocoa", "accent": "cream"},
            copy(
                "Rounded pebbles cemented in a finer matrix. The rounding means water moved them "
                "first.",
                "Rounded pebbles set in a coarse orange matrix, the block still carrying its "
                "catalogue number.",
            ),
            "search:conglomerate rock specimen",
        ),
        (
            "Calcite",
            "uncommon",
            "bold",
            {"stock": "bone", "shape": "diamond", "border": "ochre"},
            copy(
                "Calcium carbonate, hardness 3. It cleaves into rhombs and fizzes in dilute acid.",
                "A honey-coloured calcite crystal, its cleavage faces meeting at the slanted "
                "angles that identify the mineral.",
            ),
            "search:calcite crystal specimen",
        ),
        (
            "Fluorite",
            "uncommon",
            "fieldnote",
            {"stock": "plum", "accent": "violet"},
            copy(
                "**Calcium fluoride**\n- Cubes and octahedra, hardness 4\n- Purple, green and "
                "colourless in one seam\n- Many specimens glow under ultraviolet",
                "Loose fluorite octahedra in purple and pale green, scattered among small brassy "
                "pyrite cubes.",
            ),
            "search:purple fluorite cubic crystals",
        ),
        (
            "Labradorite",
            "rare",
            "classic",
            {"stock": "navy", "accent": "blue", "finish": "pearl"},
            copy(
                "A feldspar whose blue flash comes from light bouncing off layers inside the "
                "stone.",
                "A rough labradorite block with one face polished, turned until the blue flash "
                "comes up.",
            ),
            "search:labradorite specimen",
        ),
        (
            "Malachite",
            "rare",
            "fieldnote",
            {"accent": "green", "finish": "metallic"},
            copy(
                "**Copper carbonate**\n- Forms where copper ore weathers\n- Banding follows each "
                "growth surface\n- Ground for green pigment for centuries",
                "Polished malachite with light and dark green bands ringing several growth "
                "centres.",
            ),
            "search:polished malachite specimen bands",
        ),
        (
            "Cut Amethyst",
            "epic",
            "minimal",
            {"gradient": "full", "accent": "cream", "finish": "pearl"},
            copy(
                "Faceting trades weight away for light returned through the table.",
                "A faceted oval amethyst, pale violet, cut so the colour reads through the table.",
            ),
            "search:amethyst crystal cluster specimen",
        ),
    ],
    "Records on My Shelf": [
        (
            "Seven Inch Single",
            "common",
            "classic",
            {"stock": "cream", "accent": "red"},
            copy(
                "The large centre hole was cut for jukeboxes; an adapter fits it to a spindle.",
                "A seven-inch label in teal and black, with the large centre hole punched clean "
                "out of it.",
            ),
            "Amen Brother 7 inch single.jpg",
        ),
        (
            "Gatefold Sleeve",
            "common",
            "polaroid",
            {"tint": "warm"},
            copy(
                "",
                "A plain white gatefold standing open on top of a deck, the embossed title "
                "catching the light.",
            ),
            "White Album Gatefold.jpg",
        ),
        (
            "Direct Drive",
            "common",
            "fieldnote",
            {"stock": "charcoal", "accent": "silver"},
            copy(
                "**Direct drive**\n- The motor turns the platter with no belt\n- A pitch slider "
                "trims the speed\n- Strobe marks show when it is on speed",
                "A direct-drive deck from above in black and white, with the arm, the pitch slider "
                "and the platter edge all in frame.",
            ),
            "search:direct drive turntable close up",
        ),
        (
            "Seven-Inch Extender",
            "common",
            "bold",
            {"stock": "butter", "shape": "circle", "border": "red"},
            copy(
                "A plastic disc that sits a seven-inch single flat on a full-size platter.",
                "A plastic disc sold to sit a seven-inch single on a full-size platter, still "
                "bagged with the printed card it came with.",
            ),
            "search:45 rpm record adapter",
        ),
        (
            "Inner Sleeve",
            "common",
            "fieldnote",
            {"accent": "slate"},
            copy(
                "**Inner sleeve**\n- Plain paper sheds fibres and scuffs\n- Anti-static liners "
                "hold much less dust\n- Store records upright, never in a stack",
                "A record part way out of a plain paper inner sleeve, its label showing through "
                "the cut-out.",
            ),
            "search:record sleeve",
        ),
        (
            "Record Shop Interior",
            "uncommon",
            "classic",
            {"stock": "cocoa", "accent": "ochre"},
            copy(
                "Bins are filed by genre and then by artist. The dividers do most of the work.",
                "Full bins in a record shop, with hand-lettered genre signs on the wall above "
                "them.",
            ),
            "Vinyl Store.jpg",
        ),
        (
            "Record Brush",
            "uncommon",
            "polaroid",
            {"tint": "mono"},
            copy(
                "",
                "A brush-and-pad cleaner resting on a record, ready to be drawn round the surface.",
            ),
            "Record-cleaner4.jpg",
        ),
        (
            "Test Pressing",
            "rare",
            "fieldnote",
            {"stock": "ink", "accent": "white", "finish": "pearl"},
            copy(
                "**Test pressing**\n- Pressed in small numbers before the run\n- Plain label, "
                "details filled in by hand\n- Matrix numbers tie it back to the lacquer",
                "A test pressing label with the date, title, artist and matrix numbers written "
                "into its printed blanks.",
            ),
            "Run–D.M.C. - Faces-Back From Hell (test pressing single) (Side A).jpg",
        ),
        (
            "Coloured Vinyl",
            "rare",
            "bold",
            {"stock": "lavender", "shape": "circle", "border": "violet", "finish": "metallic"},
            copy(
                "A picture disc laminates artwork inside the record, and usually plays noisier for "
                "it.",
                "A plain black single lying beside a yellow picture disc, both out of their "
                "sleeves.",
            ),
            "search:colored vinyl record",
        ),
        (
            "Cutting Lathe",
            "epic",
            "minimal",
            {"gradient": "full", "accent": "gold", "finish": "metallic"},
            copy(
                "The cutter head writes one spiral groove into a lacquer master.",
                "A record-cutting lathe with the cutter head over a blank disc and its controls "
                "along the front.",
            ),
            "search:record lathe",
        ),
    ],
    "Garden Birds": [
        (
            "House Sparrow",
            "common",
            "classic",
            {"stock": "sand", "accent": "ochre"},
            copy(
                "*Passer domesticus*. The black bib marks a male, and grows broader with age.",
                "A male house sparrow gripping a thin metal loop, with the black bib and chestnut "
                "wing markings clear.",
            ),
            "search:male house sparrow feeder",
        ),
        (
            "Blackbird",
            "common",
            "polaroid",
            {"tint": "warm"},
            copy(
                "",
                "A female blackbird low on the grass among fallen leaves, brown rather than black.",
            ),
            "search:common blackbird lawn",
        ),
        (
            "Chaffinch",
            "common",
            "classic",
            {"stock": "sky", "accent": "rust"},
            copy(
                "*Fringilla coelebs*. Double white wing bars; the male sings a set phrase with a "
                "flourish.",
                "A male chaffinch on a lichened branch, its double white wing bars showing against "
                "the sky.",
            ),
            "search:male common chaffinch perched",
        ),
        (
            "Collared Dove",
            "common",
            "fieldnote",
            {"accent": "slate"},
            copy(
                "**Streptopelia decaocto**\n- A narrow black half-collar on the nape\n- Spread "
                "across Europe from the 1930s\n- Breeds through most of the year",
                "Two collared doves crowded onto a bracket against blue sky, one with its tail "
                "spread.",
            ),
            "search:Eurasian collared dove perched",
        ),
        (
            "Great Tit",
            "common",
            "bold",
            {"stock": "butter", "shape": "circle", "border": "charcoal"},
            copy(
                "*Parus major*. The largest of the tits; the black stripe is broader on a male "
                "than a female.",
                "A great tit in profile on a wooden perch, the black stripe running down its "
                "yellow breast.",
            ),
            "search:great tit sunflower seed",
        ),
        (
            "Starling",
            "common",
            "fieldnote",
            {"stock": "navy", "accent": "violet"},
            copy(
                "**Sturnus vulgaris**\n- Pale spots in winter, glossy green and purple in "
                "summer\n- Walks rather than hops\n- Mimics other birds, and machines",
                "A starling on the lawn, its dark plumage flecked with pale spots and shot through "
                "with green.",
            ),
            "search:common starling winter plumage",
        ),
        (
            "Wood Pigeon",
            "common",
            "classic",
            {"stock": "sage", "accent": "white"},
            copy(
                "*Columba palumbus*. The white neck patch separates it from stock dove and rock "
                "dove.",
                "A wood pigeon settled on a wooden rail, the white patch on its neck turned to the "
                "camera.",
            ),
            "search:common wood pigeon fence",
        ),
        (
            "Nuthatch",
            "uncommon",
            "bold",
            {"stock": "peach", "shape": "arch", "border": "blue"},
            copy(
                "*Sitta europaea*. The only bird here that climbs down a trunk head first.",
                "A nuthatch working head-first down a tree trunk, which no other garden bird here "
                "does.",
            ),
            "search:Eurasian nuthatch tree trunk",
        ),
        (
            "Greenfinch",
            "uncommon",
            "classic",
            {"stock": "mint", "accent": "green"},
            copy(
                "*Chloris chloris*. Yellow flashes in wing and tail, and a heavy bill for big "
                "seeds.",
                "Two greenfinches on a concrete ledge, the yellow flashes on wing and tail "
                "catching the light.",
            ),
            "search:European greenfinch feeder",
        ),
        (
            "Song Thrush",
            "uncommon",
            "fieldnote",
            {"accent": "ochre"},
            copy(
                "**Turdus philomelos**\n- Repeats each phrase two or three times\n- Breaks snails "
                "open on a favoured stone\n- Spotted breast, warm brown above",
                "A song thrush standing on snow-covered grass, its spotted breast turned to the "
                "camera.",
            ),
            "Song Thrush.jpg",
        ),
        (
            "Bullfinch",
            "rare",
            "classic",
            {"stock": "blush", "accent": "red", "finish": "pearl"},
            copy(
                "*Pyrrhula pyrrhula*. Black cap and stubby bill; quiet, and usually seen in pairs.",
                "A bullfinch on a bare branch, with the black cap and short thick bill the species "
                "is known for.",
            ),
            "search:bullfinch bird",
        ),
        (
            "Great Spotted Woodpecker",
            "rare",
            "fieldnote",
            {"stock": "charcoal", "accent": "red", "finish": "metallic"},
            copy(
                "**Dendrocopos major**\n- A stiff tail props it against bark and mesh\n- Drums in "
                "spring rather than singing\n- Red on the nape marks the male",
                "A great spotted woodpecker clinging to a hanging mesh feeder, with a log store "
                "behind it.",
            ),
            "search:great spotted woodpecker feeder",
        ),
        (
            "Siskin",
            "epic",
            "minimal",
            {"gradient": "full", "accent": "green", "finish": "pearl"},
            copy(
                "*Spinus spinus*. A small streaked finch; numbers rise here in hard winters.",
                "A siskin on a branch in leaf and white blossom, its streaked yellow-green plumage "
                "showing.",
            ),
            "search:siskin bird",
        ),
        (
            "Tawny Owl",
            "epic",
            "minimal",
            {"gradient": "full", "accent": "ochre", "finish": "metallic"},
            copy(
                "*Strix aluco*. Roosts against a trunk by day and hunts small mammals at night.",
                "A tawny owl roosting hard against a trunk, its plumage almost matching the bark "
                "behind it.",
            ),
            "search:tawny owl perched branch",
        ),
    ],
    "Film Cameras": [
        (
            "Olympus OM-1",
            "common",
            "classic",
            {"stock": "charcoal", "border": "silver", "title_typeface": "spacemono"},
            copy(
                "1972. A small, quiet SLR with the shutter speeds on a ring around the mount.",
                "A silver OM-1 on a table beside its lens cap, with the shutter-speed ring set "
                "around the lens mount.",
            ),
            "Olympus OM1.jpg",
        ),
        (
            "Minolta SRT-101",
            "common",
            "fieldnote",
            {"stock": "sand", "accent": "rust", "title_typeface": "spacemono"},
            copy(
                "**Minolta SR-T 101, 1966**\n- Match-needle metering through the lens\n- "
                "Mechanical shutter to 1/1000\n- SR bayonet mount",
                "A silver SRT-101 with a normal lens fitted and a second lens standing beside the "
                "body.",
            ),
            "search:Minolta SRT-101 camera",
        ),
        (
            "Yashica Mat-124G",
            "common",
            "fieldnote",
            {"stock": "ink", "accent": "silver", "title_typeface": "spacemono"},
            copy(
                "**Yashica Mat-124G, 1970**\n- Twin-lens reflex for 120 and 220 film\n- Twelve "
                "square frames to a roll of 120\n- The waist-level hood folds flat",
                "A Yashica twin-lens reflex with the finder hood closed, showing both lenses and "
                "the focusing knob.",
            ),
            "search:Yashica Mat-124G camera",
        ),
        (
            "Kodak Retina II",
            "common",
            "polaroid",
            {"tint": "warm"},
            copy(
                "",
                "A Retina opened for use, the lens standard carried out from the body on folding "
                "struts.",
            ),
            "search:Kodak Retina II camera",
        ),
        (
            "Rolleiflex 2.8F",
            "common",
            "bold",
            {"stock": "charcoal", "shape": "square", "border": "silver"},
            copy(
                "Twin-lens reflex: one lens views while the other exposes, so nothing blacks out.",
                "The viewing and taking lenses of a Rolleiflex, with the focusing knob and shutter "
                "controls either side.",
            ),
            "search:Rolleiflex camera",
        ),
        (
            "Mamiya RB67",
            "common",
            "fieldnote",
            {"stock": "charcoal", "accent": "white", "title_typeface": "spacemono"},
            copy(
                "**Mamiya RB67**\n- The back rotates, so the frame turns and the camera does "
                "not\n- 6 by 7 cm negatives\n- Bellows focusing, and heavy enough to want a tripod",
                "An RB67 body from the front with no lens mounted, its waist-level finder folded "
                "up on top.",
            ),
            "search:Mamiya RB67 camera",
        ),
        (
            "Agfa Isolette",
            "common",
            "fieldnote",
            {"stock": "bone", "accent": "rust"},
            copy(
                "**Agfa Isolette**\n- A folding camera for 120 roll film\n- The bellows collapse "
                "it to pocket size\n- Old bellows leak light along the folds",
                "A folding Isolette opened out, the bellows drawn forward to carry the front "
                "standard.",
            ),
            "search:Agfa Isolette folding camera",
        ),
        (
            "Nikonos V",
            "common",
            "classic",
            {"stock": "peach", "border": "rust", "title_typeface": "spacemono"},
            copy(
                "1984. An amphibious camera sealed with O-rings and rated to 50 metres.",
                "A Nikonos body and a wide lens laid out under warm light, both built to be sealed "
                "against water.",
            ),
            "Nikonos-V (7476257320).jpg",
        ),
        (
            "Hasselblad 500C",
            "uncommon",
            "bold",
            {"stock": "ash", "shape": "square", "border": "silver"},
            copy(
                "Modular 6 by 6: body, lens, finder and film magazine all come apart.",
                "A 500C assembled with its normal lens and film magazine, standing on a wooden "
                "bench.",
            ),
            "Hasselblad 500 c camera.jpg",
        ),
        (
            "Contax T2",
            "uncommon",
            "polaroid",
            {"tint": "mono"},
            copy(
                "",
                "A gold Contax T2 in its lined presentation case, with two other compacts standing "
                "beside it.",
            ),
            "search:Contax T2 camera",
        ),
        (
            "Linhof Technika",
            "uncommon",
            "fieldnote",
            {"stock": "sand", "accent": "red", "title_typeface": "spacemono"},
            copy(
                "**Linhof Technika**\n- A folding technical camera for sheet film\n- Rise, shift, "
                "swing and tilt on the front\n- Rangefinder or ground glass",
                "A Technika with its lens fitted and the leather focusing hood folded over to one "
                "side.",
            ),
            "search:Linhof Technika camera",
        ),
        (
            "Graflex Crown Graphic",
            "rare",
            "classic",
            {
                "stock": "ink",
                "border": "silver",
                "finish": "metallic",
                "title_typeface": "spacemono",
            },
            copy(
                "The American press camera: 4 by 5 sheet film, a folding bed and a flash bracket.",
                "A press camera with its bed down and a large flash reflector mounted on the "
                "bracket beside it.",
            ),
            "search:Graflex Crown Graphic camera",
        ),
        (
            "Fuji GW690",
            "rare",
            "fieldnote",
            {"stock": "navy", "accent": "silver", "finish": "pearl", "title_typeface": "spacemono"},
            copy(
                "**Fuji GW690**\n- Fixed 90mm lens, with no interchangeable mount\n- Eight 6 by 9 "
                "cm frames to a roll\n- A leaf shutter, so flash syncs at any speed",
                "A fixed-lens rangefinder built around the 6 by 9 frame, with its cap and strap "
                "set down beside it.",
            ),
            "0223 Fuji GW690III (5255034816).jpg",
        ),
        (
            "Widelux F7",
            "epic",
            "minimal",
            {
                "gradient": "full",
                "accent": "ochre",
                "finish": "metallic",
                "title_typeface": "spacemono",
            },
            copy(
                "The lens swings across a curved film gate for a 140 degree frame.",
                "A Widelux with the back off, showing the curved film path the swinging lens "
                "sweeps across.",
            ),
            "search:Widelux F7 camera",
        ),
        (
            "Deardorff V8",
            "epic",
            "minimal",
            {"gradient": "full", "accent": "copper", "finish": "pearl", "title_typeface": "cinzel"},
            copy(
                "An 8 by 10 wooden field camera; every movement is in the standards.",
                "A wooden field camera opened on its rail, bellows drawn out between the two "
                "standards.",
            ),
            "search:Deardorff camera",
        ),
    ],
}

CACHE_DIR = Path(__file__).resolve().parents[5] / "tmp" / "seed-photos"
PHOTO_MANIFEST = Path(__file__).resolve().parents[1] / "seed_photos.json"
CURATED_PHOTOS = json.loads(PHOTO_MANIFEST.read_text(encoding="utf-8"))
PNG_MAGIC = bytes([0x89]) + b"PNG"
AGENT = {"User-Agent": "miscellary-dev/1.0 (seed_demo; local development)"}
PHOTO_SOURCES: dict[str, dict[str, str]] = {}
SOURCE_AUTHOR_OVERRIDES = {"Vinyl groove macro.jpg": "Shane Gavin"}
PUBLIC_DOMAIN_MARK = "https://creativecommons.org/publicdomain/mark/1.0/"

BASE_SEED_PHOTOS = (
    "Plantago major RF.jpg",
    "Trifolium repens (inflorescense) Edit.jpg",
    "Dandelion seed head (Taraxacum officinale).jpg",
    "Unfurling Fern Fronds - geograph.org.uk - 6840619.jpg",
    "Macro Photography of Moss Sporophytes.jpg",
    "Cichorium intybus-alvesgaspar1.jpg",
    "Asclepias syriaca seed pod.jpg",
    "Digitalis purpurea - Panoramic trail - Northern Black Forest 01.jpg",
    "Melitaea sp. and Dactylorhiza fuchsii.jpg",
    "Monotropa uniflora ghost pipe.jpg",
    "A clear quartz crystal with natural features.jpg",
    "Granite 2641.jpg",
    "Contorted slate at Hayle Bay - geograph.org.uk - 629405.jpg",
    "Basalt cobble-boulder shoreline (Yaquina Head, Oregon, USA) 3.jpg",
    "Sandstone sample, Vosges.jpg",
    "Banded gneiss, Six Mile Lake.jpg",
    "Rose Quartz Macro 1.JPG",
    "Pyrite-232956.jpg",
    "Trilobite fossil, Desert Museum.jpg",
    "Amethyst-geode 020 7765.jpg",
    "Kazantip, Popovka, Crimea, Technics turntable, Vinyl turntable.jpg",
    "True Blue vinyl record.jpg",
    "12in-LP-Vinyl-Record-Macro-Grooves.jpg",
    "Close-up of a dj reaching for a vinyl on the turntable, guitar in a blurry background.jpg",
    "45 rpm Single Record.jpg",
    "Man reading vinyl record (Unsplash).jpg",
    "Audio-Technica turntable playing coloured vinyl.jpg",
    "Vinyl groove macro.jpg",
    "Jaume Pujagut and his vinyl records sleeve collection.jpg",
    "Chi Mai 45 rpm vinyl single label detail.jpg",
    "search:European robin bird",
    "search:Eurasian blue tit",
    "search:European goldfinch",
    "search:long-tailed tit",
    "search:eurasian wren bird",
    "search:common kingfisher",
    "camera:sx70",
    "camera:pentax-k1000",
    "camera:nikon-f",
    "camera:canon-ae1",
    "camera:leica-m3",
    "Yi peng sky lantern festival San Sai Thailand.jpg",
    "Thai people setting their candle-lit krathongs in the Ping river at night during "
    "Loy Krathong 2015-10 (22715933524).jpg",
    "Loi KRATHONG FESTIVAL CHIANG MAI 02.jpg",
)


def required_photo_specs() -> tuple[str, ...]:
    expanded = (card[5] for cards in LAUNCH_EXPANSIONS.values() for card in cards)
    return tuple(dict.fromkeys((*BASE_SEED_PHOTOS, *expanded)))


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


_last_request = 0.0
_requests_blocked_until = 0.0
MIN_GAP = 0.8


def _open(url: str, attempts: int = 4):
    global _last_request, _requests_blocked_until
    if time.monotonic() < _requests_blocked_until:
        return None
    for attempt in range(attempts):
        gap = time.monotonic() - _last_request
        if gap < MIN_GAP:
            time.sleep(MIN_GAP - gap)
        _last_request = time.monotonic()
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=30)
        except urllib.error.HTTPError as exc:
            if exc.code != 429:
                return None
            if attempt == attempts - 1:
                _requests_blocked_until = time.monotonic() + 60
                return None
            retry_after = exc.headers.get("Retry-After")
            try:
                delay = float(retry_after) if retry_after else 2 ** (attempt + 1)
            except ValueError:
                delay = 2 ** (attempt + 1)
            time.sleep(min(delay, 15))
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


def _plain(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def _commons_source(page: dict) -> dict[str, str]:
    info = (page.get("imageinfo") or [{}])[0]
    metadata = info.get("extmetadata") or {}
    return {
        "source_url": info.get("descriptionurl", ""),
        "author": _plain((metadata.get("Artist") or {}).get("value", "")),
        "license": _plain((metadata.get("LicenseShortName") or {}).get("value", "")),
        "license_url": (metadata.get("LicenseUrl") or {}).get("value", ""),
        "adaptation": "Cropped by the card renderer from the downloaded source.",
    }


def _normalize_source(spec: str, source: dict[str, str]) -> dict[str, str]:
    normalized = dict(source)
    if not normalized.get("author") and spec in SOURCE_AUTHOR_OVERRIDES:
        normalized["author"] = SOURCE_AUTHOR_OVERRIDES[spec]
    if not normalized.get("license_url") and normalized.get("license") == "Public domain":
        normalized["license_url"] = PUBLIC_DOMAIN_MARK
    return normalized


def search_commons(term: str) -> tuple[bytes, dict[str, str]] | None:
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
            "iiprop": "url|mime|extmetadata",
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
    for page in sorted(pages.values(), key=lambda p: p.get("index", 0)):
        info = (page.get("imageinfo") or [{}])[0]
        if not str(info.get("mime", "")).startswith("image/"):
            continue
        data = _get(info.get("thumburl", ""))
        if data:
            return data, _commons_source(page)
    return None


def fetch_commons_file(filename: str) -> tuple[bytes, dict[str, str]] | None:
    query = urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "titles": f"File:{filename}",
            "prop": "imageinfo",
            "iiprop": "url|mime|extmetadata",
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
    page: dict[str, Any] = next(iter(pages.values()), {})
    info = (page.get("imageinfo") or [{}])[0]
    data = _get(info.get("thumburl", ""))
    return (data, _commons_source(page)) if data else None


def fetch_photo(spec: str) -> bytes | None:
    """Resolve curated assets first, retaining legacy Commons seed references."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / (uuid.uuid5(uuid.NAMESPACE_URL, spec).hex + ".jpg")
    cached_source = cached.with_suffix(".json")
    if spec in CURATED_PHOTOS:
        photo = CURATED_PHOTOS[spec]
        PHOTO_SOURCES[spec] = {
            "source_url": photo["source"],
            "author": photo["credit"],
            "license": photo["rights"],
            "license_url": photo["rights_url"],
            "adaptation": "Cropped by the card renderer from the downloaded source.",
        }
        data = cached.read_bytes() if cached.exists() else _get(photo["url"])
    else:
        if cached.exists() and cached_source.exists():
            try:
                source = _normalize_source(
                    spec, json.loads(cached_source.read_text(encoding="utf-8"))
                )
                PHOTO_SOURCES[spec] = source
                cached_source.write_text(
                    json.dumps(source, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                return cached.read_bytes()
            except (OSError, ValueError):
                pass
        result = (
            search_commons(spec[len("search:") :])
            if spec.startswith("search:")
            else fetch_commons_file(spec)
        )
        data = result[0] if result else None
        if result:
            PHOTO_SOURCES[spec] = _normalize_source(spec, result[1])
    if data:
        cached.write_bytes(data)
        if spec not in CURATED_PHOTOS:
            cached_source.write_text(
                json.dumps(PHOTO_SOURCES[spec], ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
    return data


BODY_FACES = {
    "Garden Birds": {"": "spectral", "polaroid": "caveat"},
    "Plants Along the Trail": {"": "garamond", "polaroid": "caveat"},
    "Pocket Geology": {"": "cabin"},
    "Records on My Shelf": {"": "jost", "polaroid": "caveat"},
    "Film Cameras": {"": "body"},
}


def _body_face(set_title: str, template_key: str) -> str | None:
    faces = BODY_FACES.get(set_title)
    if faces is None:
        return None
    return faces.get(template_key, faces.get(""))


class Command(BaseCommand):
    help = "Seed demo sets, cards, and users for local product review."

    def add_arguments(self, parser):
        parser.add_argument(
            "--prepare-photos",
            action="store_true",
            help="Cache all seed image downloads without touching the database.",
        )
        parser.add_argument(
            "--no-photos",
            action="store_true",
            help="Skip photo downloads and use gradient placeholders.",
        )

    def handle(self, *args, **options):
        random.seed(20260909)
        self.use_photos = not options["no_photos"]
        self.fallbacks = 0

        if self.use_photos or options["prepare_photos"]:
            required = required_photo_specs()
            missing = [spec for spec in required if not fetch_photo(spec)]
            if missing:
                raise CommandError(f"Seed photos unavailable; database unchanged: {missing}")
            source_fields = ("source_url", "author", "license", "license_url", "adaptation")
            incomplete = {
                spec: [field for field in source_fields if not PHOTO_SOURCES[spec].get(field)]
                for spec in required
            }
            incomplete = {spec: fields for spec, fields in incomplete.items() if fields}
            if incomplete:
                raise CommandError(
                    f"Seed photo metadata incomplete; database unchanged: {incomplete}"
                )
        if options["prepare_photos"]:
            self.stdout.write(f"Prepared {len(required)} seed photos; database unchanged.")
            return

        # Delete protected dependencies before users.
        demo_users = User.objects.filter(email__in=DEMO_EMAILS)
        OwnedCard.objects.filter(owner__in=demo_users).delete()
        CardSet.objects.filter(creator__in=demo_users).delete()
        Image.objects.filter(owner__in=demo_users).delete()
        demo_users.delete()

        with transaction.atomic():
            fieldnote = User.objects.create_user(
                "ellis@example.com", "ellisgrant", "demopass123", is_demo=True
            )
            fieldnote.profile.display_name = "Ellis Grant"
            fieldnote.profile.bio = (
                "Weekend walks, native plants, and rocks picked up along the way."
            )
            fieldnote.profile.save()

            waverly = User.objects.create_user(
                "mara@example.com", "marabell", "demopass123", is_demo=True
            )
            waverly.profile.display_name = "Mara Bell"
            waverly.profile.bio = "Records, second-hand audio gear, and live sessions."
            waverly.profile.save()

            mabel = User.objects.create_user(
                "devon@example.com", "devonlee", "demopass123", is_demo=True
            )
            mabel.profile.display_name = "Devon Lee"
            mabel.profile.bio = "Old tools, pocket finds, and whatever is on the workbench."
            mabel.profile.save()

        Follow.objects.bulk_create(
            [Follow(follower=mabel, following=fieldnote), Follow(follower=mabel, following=waverly)]
        )

        plants = self._make_set(
            fieldnote,
            title="Plants Along the Trail",
            set_code="TRL",
            mark="leaf",
            pack_colour="moss",
            pack_finish="matte",
            pack_size=4,
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
                    {"stock": "bone", "accent": "green"},
                    copy(
                        "*Plantago major*. Broad ribbed leaves flat to the ground, wind-pollinated "
                        "spikes above.",
                        "A rosette of broad, strongly ribbed leaves with several flower spikes "
                        "standing up out of it, growing where the grass runs out against the "
                        "tarmac.",
                    ),
                    "Plantago major RF.jpg",
                ),
                (
                    "Wild Clover",
                    "common",
                    "classic",
                    {"stock": "bone", "accent": "green"},
                    copy(
                        "*Trifolium repens*. Creeping stems root at the nodes; heads brown from "
                        "the base up.",
                        "One white clover head at full size, the lower florets already browning "
                        "while the top ones are still fresh.",
                    ),
                    "Trifolium repens (inflorescense) Edit.jpg",
                ),
                (
                    "Dandelion Puff",
                    "common",
                    "polaroid",
                    {"tint": "none"},
                    copy(
                        "",
                        "A complete dandelion seed head with every parachute still attached, lit "
                        "against dark grass.",
                    ),
                    "Dandelion seed head (Taraxacum officinale).jpg",
                ),
                (
                    "Fern Frond",
                    "common",
                    "fieldnote",
                    {"accent": "green"},
                    copy(
                        "**Fern crozier**\n- New fronds unroll from the base upward\n- The coil "
                        "protects the growing tip\n- Ferns spread by spores, never seed",
                        "New fern fronds coming up beside a fallen branch, two still tightly "
                        "curled and one part opened.",
                    ),
                    "Unfurling Fern Fronds - geograph.org.uk - 6840619.jpg",
                ),
                (
                    "Trailside Moss",
                    "common",
                    "polaroid",
                    {"tint": "cool"},
                    copy(
                        "",
                        "A close view of moss sporophytes, each capsule held clear of the cushion "
                        "on a thin red stalk.",
                    ),
                    "Macro Photography of Moss Sporophytes.jpg",
                ),
                (
                    "Chicory Bloom",
                    "uncommon",
                    "classic",
                    {"stock": "bone", "accent": "blue"},
                    copy(
                        "*Cichorium intybus*. Each flower opens for one morning and is closed "
                        "again by midday.",
                        "A single chicory flower fully open, its pale blue rays square-cut and "
                        "fringed at the tips.",
                    ),
                    "Cichorium intybus-alvesgaspar1.jpg",
                ),
                (
                    "Milkweed Pod",
                    "uncommon",
                    "polaroid",
                    {"tint": "warm"},
                    copy(
                        "",
                        "Two views of the same plant: a closed green pod still on the stem, and a "
                        "split pod letting its silk out.",
                    ),
                    "Asclepias syriaca seed pod.jpg",
                ),
                (
                    "Foxglove Spire",
                    "rare",
                    "bold",
                    {"shape": "arch"},
                    copy(
                        "*Digitalis purpurea*. Leaves in the first year, one tall spike in the "
                        "second. Toxic throughout.",
                        "A foxglove with the lower bells open and the top of the spire still "
                        "closed in bud.",
                    ),
                    "Digitalis purpurea - Panoramic trail - Northern Black Forest 01.jpg",
                ),
                (
                    "Marsh Orchid",
                    "epic",
                    "minimal",
                    {
                        "gradient": "full",
                        "accent": "cream",
                        "border": "copper",
                        "border_width": "hairline",
                    },
                    copy(
                        "*Dactylorhiza*. A wet-meadow orchid; the spike opens from the bottom up.",
                        "A marsh orchid in flower with a fritillary butterfly settled on the "
                        "spike, wings open.",
                    ),
                    "Melitaea sp. and Dactylorhiza fuchsii.jpg",
                ),
                (
                    "Ghost Pipe",
                    "legendary",
                    "fieldnote",
                    {"stock": "ink", "accent": "gold"},
                    copy(
                        "**Monotropa uniflora**\n- No chlorophyll, so it is white rather than "
                        "green\n- Feeds through fungi joined to tree roots\n- Blackens as it goes "
                        "over",
                        "A tight group of pale ghost pipe stems standing in leaf litter, the "
                        "flower heads already blackening.",
                    ),
                    "Monotropa uniflora ghost pipe.jpg",
                ),
            ],
        )
        rocks = self._make_set(
            fieldnote,
            title="Pocket Geology",
            set_code="GEO",
            mark="crystal",
            pack_colour="ash",
            pack_finish="satin",
            pack_size=6,
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
                    copy(
                        "Silicon dioxide, hardness 7. Six-sided prisms ending in a point, and hard "
                        "enough to scratch glass.",
                        "A clear quartz crystal with its termination intact, photographed against "
                        "black.",
                    ),
                    "A clear quartz crystal with natural features.jpg",
                ),
                (
                    "Granite Block",
                    "common",
                    "bold",
                    {"shape": "square"},
                    copy(
                        "Coarse intrusive rock of quartz, feldspar and mica, cooled slowly well "
                        "below the surface.",
                        "A rough granite block resting on paving, with the photographer's shadow "
                        "falling across it.",
                    ),
                    "Granite 2641.jpg",
                ),
                (
                    "Contorted Slate",
                    "common",
                    "fieldnote",
                    {"accent": "blue"},
                    copy(
                        "**Slate**\n- Mudstone recrystallised under pressure\n- Splits along its "
                        "cleavage, not its bedding\n- The folding here came after the cleavage",
                        "Slate beds folded back on themselves in a coastal outcrop, the cleavage "
                        "catching the light.",
                    ),
                    "Contorted slate at Hayle Bay - geograph.org.uk - 629405.jpg",
                ),
                (
                    "Basalt Cobbles",
                    "common",
                    "classic",
                    {"stock": "pine", "accent": "red"},
                    copy(
                        "Fine-grained lava and the commonest rock of the ocean floor. Dark, dense "
                        "and tough.",
                        "Rounded basalt cobbles packed across a shoreline, every one worked smooth "
                        "by the surf.",
                    ),
                    "Basalt cobble-boulder shoreline (Yaquina Head, Oregon, USA) 3.jpg",
                ),
                (
                    "Sandstone Block",
                    "common",
                    "classic",
                    {"stock": "sand", "accent": "gold"},
                    copy(
                        "Cemented sand grains. The pink comes from iron oxide coating each grain.",
                        "A pink sandstone block with one fresh face, its bedding showing as faint "
                        "parallel lines.",
                    ),
                    "Sandstone sample, Vosges.jpg",
                ),
                (
                    "Shoreline Outcrop",
                    "uncommon",
                    "bold",
                    {"shape": "circle"},
                    copy(
                        "Weathering opens the grain of a rock face, and then frost and water carry "
                        "the rest away.",
                        "A weathered rock surface at the water's edge, its banding worn down to "
                        "faint pale streaks.",
                    ),
                    "Banded gneiss, Six Mile Lake.jpg",
                ),
                (
                    "Rose Quartz",
                    "uncommon",
                    "classic",
                    {"stock": "bone", "accent": "purple"},
                    copy(
                        "Quartz clouded pink by traces of titanium or manganese. It rarely forms "
                        "good crystals.",
                        "A fist-sized piece of rose quartz, cloudy pink and translucent where it "
                        "broke.",
                    ),
                    "Rose Quartz Macro 1.JPG",
                ),
                (
                    "Pyrite Cluster",
                    "rare",
                    "fieldnote",
                    {"stock": "charcoal", "accent": "gold"},
                    copy(
                        "**Iron sulphide, FeS2**\n- Grows in cubes with striated faces\n- Brassy "
                        "yellow, but much harder than gold\n- Hardness 6, with a greenish black "
                        "streak",
                        "Interlocking pyrite cubes with flat brassy faces and edges sharp enough "
                        "to look machined.",
                    ),
                    "Pyrite-232956.jpg",
                ),
                (
                    "Fossil Trilobite",
                    "epic",
                    "fieldnote",
                    {"stock": "slate", "accent": "gold"},
                    copy(
                        "**Trilobite**\n- Marine arthropod, three lobes lengthwise\n- Moulted its "
                        "shell as it grew\n- Cambrian to the end of the Permian",
                        "A trilobite in its matrix, the segmented thorax and tail standing clear "
                        "in relief.",
                    ),
                    "Trilobite fossil, Desert Museum.jpg",
                ),
                (
                    "Raw Amethyst",
                    "legendary",
                    "bold",
                    {"shape": "circle"},
                    copy(
                        "Purple quartz, coloured by iron and natural radiation. Heat turns it to "
                        "yellow citrine.",
                        "Two halves of a geode opened out, both lined with small purple crystals "
                        "over a white rim.",
                    ),
                    "Amethyst-geode 020 7765.jpg",
                ),
            ],
        )
        vinyl = self._make_set(
            waverly,
            title="Records on My Shelf",
            set_code="REC",
            mark="record",
            pack_colour="violet",
            pack_finish="holo",
            pack_size=5,
            emblem_layout="wordmark",
            emblem_text="cream",
            surface="linen",
            description=(
                "Records I return to, along with the sleeves, decks, and small parts around them."
            ),
            palette=((70, 55, 90), (20, 16, 28)),
            cards=[
                (
                    "Late Night Pressing",
                    "common",
                    "classic",
                    {"accent": "purple"},
                    copy(
                        "A twelve-inch LP runs at 33 rpm and holds around twenty minutes a side.",
                        "A record on the platter with the arm resting across it, and the mixer on "
                        "a shelf above the deck.",
                    ),
                    "Kazantip, Popovka, Crimea, Technics turntable, Vinyl turntable.jpg",
                ),
                (
                    "B-Side Blue",
                    "common",
                    "classic",
                    {"accent": "blue"},
                    copy(
                        "The colour is pigment in the PVC. It plays no differently from black "
                        "vinyl.",
                        "A translucent blue seven-inch propped against its sleeve, lit from behind "
                        "so the vinyl glows.",
                    ),
                    "True Blue vinyl record.jpg",
                ),
                (
                    "First Cut",
                    "common",
                    "fieldnote",
                    {"accent": "purple"},
                    copy(
                        "**Groove**\n- One continuous spiral, cut from the outside in\n- The shape "
                        "of the walls carries the stereo\n- Lead-in and run-out hold no audio",
                        "A close black and white view across the grooves, with the light picking "
                        "out every ridge.",
                    ),
                    "12in-LP-Vinyl-Record-Macro-Grooves.jpg",
                ),
                (
                    "Basement Tape",
                    "common",
                    "classic",
                    {"stock": "pine", "accent": "gold"},
                    copy(
                        "Belt drive or direct, the platter has one job: hold a steady 33 or 45 "
                        "rpm.",
                        "A turntable set up on a table with someone reaching past it, and an "
                        "electric guitar on the wall behind.",
                    ),
                    "Close-up of a dj reaching for a vinyl on the turntable, guitar in a blurry "
                    "background.jpg",
                ),
                (
                    "Corner Store 45",
                    "common",
                    "polaroid",
                    {"tint": "cool"},
                    copy(
                        "",
                        "A plain black seven-inch with the centre knocked out, one tab of the "
                        "spider still in place.",
                    ),
                    "45 rpm Single Record.jpg",
                ),
                (
                    "Sunday Matinee",
                    "uncommon",
                    "classic",
                    {"stock": "bone", "accent": "blue"},
                    copy(
                        "Slide a record out by its edges. Fingerprints on the playing surface "
                        "collect dust.",
                        "A record halfway out of its sleeve, lifted beside a turntable with the "
                        "lid standing open.",
                    ),
                    "Man reading vinyl record (Unsplash).jpg",
                ),
                (
                    "Reissue Green Wax",
                    "uncommon",
                    "classic",
                    {"stock": "forest", "accent": "green"},
                    copy(
                        "The stylus rides in the groove, and the counterweight sets how hard it "
                        "presses.",
                        "A teal pressing on the platter with the cartridge down and the stylus in "
                        "the groove.",
                    ),
                    "Audio-Technica turntable playing coloured vinyl.jpg",
                ),
                (
                    "Groove Macro",
                    "rare",
                    "bold",
                    {"shape": "square"},
                    copy(
                        "Raking light shows the groove wall. Dust caught in it is most of what "
                        "surface noise is.",
                        "A raking-light macro of the run-out grooves, close enough to show the "
                        "dust on the surface.",
                    ),
                    "Vinyl groove macro.jpg",
                ),
                (
                    "Sorting the Table",
                    "epic",
                    "fieldnote",
                    {"stock": "ink", "accent": "purple"},
                    copy(
                        "**Sorting a collection**\n- Sleeve and disc are graded separately\n- The "
                        "run-out carries the matrix number\n- Play-grade anything you cannot hear "
                        "first",
                        "Three collectors working through sleeves and loose discs spread out "
                        "across a table.",
                    ),
                    "Jaume Pujagut and his vinyl records sleeve collection.jpg",
                ),
                (
                    "Soundtrack Single",
                    "legendary",
                    "minimal",
                    {"gradient": "full", "accent": "gold"},
                    copy(
                        "A seven-inch label carries credits the sleeve often leaves out.",
                        "The green label of a seven-inch single, its credits and rights notice set "
                        "in small type around the edge.",
                    ),
                    "Chi Mai 45 rpm vinyl single label detail.jpg",
                ),
            ],
        )

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
                    {"stock": "pine", "accent": "gold"},
                    copy(
                        "Yi Peng, in the twelfth lunar month. The lanterns go up after dark.",
                        "A sky already full of lanterns drifting away, with one more being let go "
                        "in the foreground.",
                    ),
                    "Yi peng sky lantern festival San Sai Thailand.jpg",
                ),
                (
                    "Riverside Ceremony",
                    "common",
                    "polaroid",
                    {"tint": "warm"},
                    copy(
                        "",
                        "A family kneeling on a bamboo raft to set a lit krathong down on the "
                        "water.",
                    ),
                    "Thai people setting their candle-lit krathongs in the Ping river at night "
                    "during Loy Krathong 2015-10 (22715933524).jpg",
                ),
                (
                    "Festival Procession",
                    "common",
                    "classic",
                    {"stock": "pine", "accent": "gold"},
                    copy(
                        "Loi Krathong. Flowers, incense and a candle are floated out on the water.",
                        "A night procession in traditional dress, each person carrying a tray of "
                        "flowers and candles.",
                    ),
                    "Loi KRATHONG FESTIVAL CHIANG MAI 02.jpg",
                ),
            ],
            publish=False,
        )

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
                user = User.objects.create_user(
                    f"{username}@example.com", username, "demopass123", is_demo=True
                )
                user.profile.display_name = display
                user.profile.bio = bio
                user.profile.save()
                made[username] = user
        return made

    def _make_more_sets(self, fieldnote, waverly, mabel, extras) -> list:
        """Additional grounded sets for catalogue and interaction testing."""
        plans = [
            (
                extras["orla"],
                "Garden Birds",
                "Whatever lands on the feeder, catalogued from the kitchen window.",
                ((120, 150, 190), (40, 60, 90)),
                {
                    "set_code": "BRD",
                    "mark": "feather",
                    "pack_colour": "sky",
                    "pack_finish": "gloss",
                    "pack_size": 3,
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
                        {"stock": "cream"},
                        copy(
                            "*Erithacus rubecula*. Juveniles are spotted brown; the red front "
                            "arrives with the moult.",
                            "A young robin still in spotted brown plumage, on bare ground, before "
                            "the red breast comes through.",
                        ),
                        "search:European robin bird",
                    ),
                    (
                        "Blue Tit",
                        "common",
                        "polaroid",
                        {"tint": "cool"},
                        copy(
                            "",
                            "A blue tit seen from behind on a lichened branch, showing the blue "
                            "wing and the long blue-grey tail.",
                        ),
                        "search:Eurasian blue tit",
                    ),
                    (
                        "Goldfinch",
                        "common",
                        "classic",
                        {"stock": "butter", "accent": "ochre"},
                        copy(
                            "*Carduelis carduelis*. A fine bill for teasing seed out of thistles "
                            "and teasels.",
                            "A goldfinch on a hazel branch hung with catkins, its red face and "
                            "gold wing bar clear.",
                        ),
                        "search:European goldfinch",
                    ),
                    (
                        "Long-tailed Tit",
                        "uncommon",
                        "classic",
                        {"stock": "bone"},
                        copy(
                            "*Aegithalos caudatus*. Travels in family parties and roosts in a "
                            "huddle on cold nights.",
                            "A long-tailed tit on a bare branch, round-bodied with a tail longer "
                            "than the rest of it.",
                        ),
                        "search:long-tailed tit",
                    ),
                    (
                        "Wren",
                        "rare",
                        "fieldnote",
                        {},
                        copy(
                            "**Troglodytes troglodytes**\n- Among the smallest birds here, and the "
                            "loudest\n- Feeds low down, in cover\n- The male builds several nests "
                            "for the female to pick",
                            "A wren on a sawn log end, tail cocked, with the barring showing on "
                            "its wings.",
                        ),
                        "search:eurasian wren bird",
                    ),
                    (
                        "Kingfisher",
                        "legendary",
                        "bold",
                        {
                            "shape": "circle",
                            "border": "ocean",
                            "treatment": "foil",
                            "coverage": "reverse",
                        },
                        copy(
                            "*Alcedo atthis*. Takes fish and larvae from a perch over water, and "
                            "nests in a bank tunnel.",
                            "A female kingfisher on a bare log, holding a dragonfly larva across "
                            "her bill.",
                        ),
                        "search:common kingfisher",
                    ),
                ],
            ),
            (
                extras["bex"],
                "Film Cameras",
                ("Film cameras from compact rangefinders to large folding field cameras."),
                ((145, 110, 75), (35, 30, 25)),
                {
                    "set_code": "CAM",
                    "mark": "orbit",
                    "pack_colour": "charcoal",
                    "pack_finish": "satin",
                    "pack_size": 7,
                    "emblem_layout": "badge",
                    "emblem_shape": "tablet",
                    "emblem_style": "outline",
                    "emblem_text": "cream",
                    "surface": "linen",
                },
                [
                    (
                        "Canon AE-1",
                        "common",
                        "bold",
                        {
                            "stock": "charcoal",
                            "shape": "square",
                            "border": "copper",
                            "border_width": "medium",
                            "title_typeface": "display",
                            "tint": "none",
                        },
                        copy(
                            "1976. Shutter-priority SLR built around a microprocessor. FD mount, "
                            "50mm f/1.8 as standard.",
                            "A black AE-1 with the 50mm f/1.8 fitted, photographed square on "
                            "against a plain ground.",
                        ),
                        "camera:canon-ae1",
                    ),
                    (
                        "Pentax K1000",
                        "common",
                        "fieldnote",
                        {
                            "stock": "sand",
                            "accent": "rust",
                            "title_typeface": "spacemono",
                            "tint": "none",
                        },
                        copy(
                            "**Pentax K1000, 1976**\n- Fully mechanical; only the meter needs a "
                            "battery\n- K bayonet mount\n- Sold for two decades as a first camera",
                            "A silver K1000 carrying a zoom far larger than the body, with the "
                            "shutter dial and prism in view.",
                        ),
                        "camera:pentax-k1000",
                    ),
                    (
                        "Nikon F",
                        "uncommon",
                        "fieldnote",
                        {
                            "stock": "navy",
                            "accent": "slate",
                            "title_typeface": "spacemono",
                            "tint": "none",
                        },
                        copy(
                            "**Nikon F, 1959**\n- Nikon's first system SLR\n- Interchangeable "
                            "prisms and focusing screens\n- Built on the F bayonet mount, still in "
                            "use",
                            "A silver Nikon F with a Nikkor lens fitted, the flat-topped prism "
                            "giving it its familiar outline.",
                        ),
                        "camera:nikon-f",
                    ),
                    (
                        "Leica M3",
                        "rare",
                        "classic",
                        {
                            "stock": "forest",
                            "border": "silver",
                            "border_width": "hairline",
                            "title_typeface": "cinzel",
                            "finish": "metallic",
                            "tint": "none",
                        },
                        copy(
                            "1954. Bayonet M mount, with rangefinder and viewfinder combined in "
                            "one window.",
                            "A chrome M3 with a 5cm Summicron, its three front windows set across "
                            "the top plate. Photographed at the German Museum of Technology in "
                            "Berlin.",
                        ),
                        "camera:leica-m3",
                    ),
                    (
                        "Polaroid SX-70",
                        "legendary",
                        "minimal",
                        {
                            "gradient": "full",
                            "accent": "gold",
                            "border": "copper",
                            "border_width": "medium",
                            "title_typeface": "cinzel",
                            "finish": "satin",
                            "treatment": "foil",
                            "coverage": "full",
                            "tint": "none",
                        },
                        copy(
                            "1972. A folding SLR that develops its print out in the light.",
                            "A folding SX-70 in brown leather and brightwork, opened out to its "
                            "working shape.",
                        ),
                        "camera:sx70",
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
        """Fill each collector's profile binder, and bind it in a cover of its own."""
        slots: list[ShowcaseSlot] = []
        for user in users:
            owned = list(user.owned_cards.select_related("card").order_by("?")[:SHOWCASE_SLOTS])
            keep = owned if random.random() < 0.6 else owned[:4]
            slots.extend(
                ShowcaseSlot(user=user, position=i, owned_card=o) for i, o in enumerate(keep)
            )
            profile = user.profile
            profile.binder_colour = BINDER_COLOURS[
                zlib.crc32(user.username.encode()) % len(BINDER_COLOURS)
            ]
            profile.save(update_fields=["binder_colour"])
        ShowcaseSlot.objects.bulk_create(slots, ignore_conflicts=True)

    def _add_comments(self, users, sets) -> None:
        """A few short threads, leaving most set pages quiet."""
        openers = [
            "Pulled the {card} on my second pack.",
            "Is the {card} meant to be {rarity}? I have not seen it yet.",
            "Anyone got a spare {card}? Happy to trade a duplicate for it.",
            "The photo on the {card} came out well.",
            "The {card} was the last gap on my page.",
        ]
        replies = [
            "Same, still chasing it.",
            "Seconding this. It took me about fifteen packs.",
            "Trade you a duplicate for it if you still need one.",
            "That was my last one too.",
        ]
        creator_replies = [
            "That one took the longest to shoot. Waited three evenings for the light.",
            "Rarity is on purpose. It turns up as often as the others, just later in the run.",
            "Thanks. That card nearly did not make the cut.",
            "Good eye. I reshot it twice before it worked.",
        ]

        for card_set in random.sample(sets, k=min(2, len(sets))):
            cards = list(card_set.cards.all())
            if not cards:
                continue
            talkers = [u for u in users if u.id != card_set.creator_id]
            for _ in range(random.randint(1, 2)):
                card = random.choice(cards)
                top = Comment.objects.create(
                    card_set=card_set,
                    author=random.choice(talkers),
                    body=random.choice(openers).format(card=card.title, rarity=card.rarity),
                )
                for _ in range(random.randint(0, 1)):
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
        offer(mabel, fieldnote, 2, 1, "pending", "Two of mine for the robin?")
        offer(orla, fieldnote, 1, 2, "pending", "Long shot, but worth asking.")
        offer(fieldnote, kit, 1, 1, "pending", "Straight swap if you are up for it.")
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
        set_code="",
        mark="",
        pack_colour="",
        pack_finish="",
        pack_size=5,
        emblem_layout="",
        emblem_shape="",
        emblem_style="",
        emblem_text="",
        surface="",
    ) -> CardSet:
        cards = [*cards, *LAUNCH_EXPANSIONS.get(title, [])]
        card_set = CardSet.objects.create(
            creator=creator,
            title=title,
            description=description,
            set_code=set_code,
            mark=mark,
            binder_colour=BINDER_COLOURS[zlib.crc32(title.encode()) % len(BINDER_COLOURS)],
            pack_colour=pack_colour,
            pack_finish=pack_finish,
            pack_size=pack_size,
            emblem_layout=emblem_layout,
            emblem_shape=emblem_shape,
            emblem_style=emblem_style,
            emblem_text=emblem_text,
        )
        top, bottom = palette
        for i, (name, rarity, template_key, config, copy_text, photo) in enumerate(cards):
            printed_text, description_text = (
                copy_text if isinstance(copy_text, tuple) else (copy_text, copy_text)
            )
            card_top = tuple(_jitter(c) for c in top)
            card_bottom = tuple(_jitter(c) for c in bottom)
            image = self._upload_art(creator, photo, card_top, card_bottom)
            template_errors = template_problems(template_key, rarity)
            if template_errors:
                raise RuntimeError(f"Invalid template choice for {name}: {template_errors}")
            template = TEMPLATES_BY_KEY[template_key]
            unknown_options = sorted(set(config) - set(template["options"]))
            if unknown_options:
                raise RuntimeError(f"Invalid editor options for {name}: {unknown_options}")
            full_config = {**default_config(template_key), **config}
            body_face = _body_face(title, template_key)
            if body_face and "body_typeface" not in config:
                full_config["body_typeface"] = body_face
            if "corners" not in config and "corners" in template["options"]:
                full_config["corners"] = DEMO_CORNER_CUTS[i % len(DEMO_CORNER_CUTS)]
            variety = zlib.crc32(f"{title}:{name}".encode())
            for option, choices in {
                "stock": [
                    "cream",
                    "sage",
                    "peach",
                    "sky",
                    "lavender",
                    "pine",
                    "navy",
                    "cocoa",
                    "plum",
                ],
                "texture": ["linen", "grain", "canvas", "felt", "smooth"],
                "border": ["auto", "sage", "copper", "teal", "gold", "silver"],
                "border_width": ["hairline", "thin", "medium"],
            }.items():
                definition = template["options"].get(option)
                if option in config or definition is None:
                    continue
                allowed = [value for value in choices if value in definition["values"]]
                if allowed:
                    full_config[option] = allowed[variety % len(allowed)]
                    variety //= len(allowed)
            if surface and "texture" in full_config and "texture" not in config:
                full_config["texture"] = surface
            spend = SPECIALTY_BY_RARITY.get(rarity)
            if spend:
                for option, value in spend[zlib.crc32(name.encode()) % len(spend)].items():
                    # A template can narrow an option, so only spend what it offers.
                    definition = template["options"].get(option)
                    if option in config or definition is None:
                        continue
                    if value in definition["values"]:
                        full_config[option] = value
            config_errors = config_problems(template_key, full_config, rarity)
            if config_errors:
                raise RuntimeError(f"Invalid editor choices for {name}: {config_errors}")
            text_rules = template["text"]
            if len(name) > text_rules["title"]["max_length"]:
                raise RuntimeError(f"Title does not fit {template_key} for {name}")
            if text_rules["printed"] is None and printed_text:
                raise RuntimeError(f"Printed text is not supported by {template_key} for {name}")
            if text_rules["printed"] and len(printed_text) > text_rules["printed"]["max_length"]:
                raise RuntimeError(f"Printed text does not fit {template_key} for {name}")
            printed_markup = (text_rules["printed"] or {}).get("markup", "none")
            if printed_markup != "block" and printed_text.count("\n"):
                raise RuntimeError(f"Printed text needs one block on {template_key}: {name}")
            printed_issues = [i for i in description_issues(printed_text) if i != "too_long"]
            if printed_issues:
                raise RuntimeError(f"Printed markup is not allowed for {name}: {printed_issues}")
            CardDefinition.objects.create(
                card_set=card_set,
                image=image,
                title=name,
                rarity=rarity,
                description=description_text,
                printed_text=printed_text,
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
        card_set.refresh_from_db()
        return card_set

    def _upload_art(self, owner, photo, top, bottom) -> Image:
        data = fetch_photo(photo) if self.use_photos else None
        if data and data[:4] == PNG_MAGIC:
            # Sniff image type because Commons thumbnails are not always JPEGs.
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
            source_metadata=PHOTO_SOURCES.get(
                photo,
                {"kind": "local_placeholder", "adaptation": "Generated gradient placeholder."},
            ),
        )
