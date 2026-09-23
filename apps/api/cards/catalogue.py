import hashlib
import json
import struct
import uuid
import zlib
from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.management.base import CommandError
from django.db import connection, transaction
from django.utils.text import slugify

from accounts.models import User
from cards.identity import ART_SCALE_MAX, BINDER_COLOURS, SET_TITLE_MAX_LENGTH
from cards.markdown import description_issues
from cards.models import CardDefinition, CardSet
from cards.packlayers import DEFAULTS as PACK_LAYER_DEFAULTS
from cards.packlayers import problems as pack_layer_problems
from cards.packtext import DEFAULTS as PACK_TEXT_DEFAULTS
from cards.publishing import publish_set
from cards.tags import SET_TAG_MAX
from cards.templates import TEMPLATES_BY_KEY, config_problems, default_config, template_problems
from cards.views import apply_tags
from uploads import storage
from uploads.models import Image

from .catalogue_photos import PHOTO_SOURCES, PNG_MAGIC, fetch_photo, jpeg_size

MANIFEST_PATH = Path(__file__).with_name("catalogue_manifest.json")
CATALOGUE_NAMESPACE = uuid.UUID("167d75d9-c665-4bb5-a716-59c2351d4bd7")
SOURCE_FIELDS = ("source_url", "author", "license", "license_url", "adaptation")
CORNER_CUTS = ("round", "round", "soft", "sharp")
PACK_COVER_RATIO = 886 / 530
SPECIALTY_BY_RARITY: dict[str, list[dict[str, str]]] = {
    "uncommon": [{}, {}, {"tint": "punch"}],
    "rare": [
        {"finish": "pearl"},
        {"finish": "metallic", "texture": "brushed"},
        {"finish": "gloss", "window": "mat"},
    ],
    "epic": [{"finish": "metallic"}, {"finish": "pearl"}, {"finish": "gloss"}],
    "legendary": [
        {"treatment": "foil", "finish": "matte", "coverage": "reverse"},
        {"treatment": "holo", "finish": "gloss", "coverage": "full"},
        {"treatment": "holo", "finish": "satin", "coverage": "spot"},
        {"treatment": "foil", "finish": "gloss", "coverage": "spot"},
    ],
}


def load_manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def stable_id(*parts: object) -> uuid.UUID:
    return uuid.uuid5(CATALOGUE_NAMESPACE, ":".join(str(part) for part in parts))


def _keyed_sources() -> dict[str, str]:
    return json.loads(
        (Path(__file__).parent / "management" / "cutouts" / "sources.json").read_text(
            encoding="utf-8"
        )
    )


def _photo_targets(manifest: dict) -> dict[str, list[uuid.UUID]]:
    targets: dict[str, list[uuid.UUID]] = {}
    for card_set in manifest["sets"]:
        for position, card in enumerate(card_set["cards"]):
            identity = stable_id("card-image", card_set["title"], position)
            targets.setdefault(card[5], []).append(identity)
        for index, cutout in enumerate(_pack_cutouts(card_set["pack_design"])):
            identity = _pack_art_id(card_set["title"], index)
            targets.setdefault(_cutout_spec(cutout), []).append(identity)
    return targets


def required_photo_specs(manifest: dict | None = None) -> tuple[str, ...]:
    return tuple(_photo_targets(manifest or load_manifest()))


def prepare_photos(manifest: dict | None = None) -> dict[str, bytes]:
    manifest = manifest or load_manifest()
    photos: dict[str, bytes] = {}
    missing: list[str] = []
    incomplete: dict[str, list[str]] = {}
    changed: dict[str, list[str]] = {}
    source_records = manifest.get("sources", {})
    for spec, identities in _photo_targets(manifest).items():
        # A stored copy is authoritative once created; sources re-encode their files over time.
        if Image.objects.filter(pk__in=identities).count() == len(set(identities)):
            continue
        data = fetch_photo(spec)
        if not data:
            missing.append(spec)
            continue
        photos[spec] = data
        absent = [field for field in SOURCE_FIELDS if not PHOTO_SOURCES.get(spec, {}).get(field)]
        if absent:
            incomplete[spec] = absent
            continue
        expected = source_records.get(spec)
        if not expected:
            incomplete[spec] = ["manifest source record"]
            continue
        source = PHOTO_SOURCES[spec]
        differences = [field for field in SOURCE_FIELDS if source[field] != expected.get(field)]
        if hashlib.sha256(data).hexdigest() != expected.get("sha256"):
            differences.append("sha256")
        if differences:
            changed[spec] = differences
    if missing:
        raise CommandError(f"Catalogue photos unavailable; database unchanged: {missing}")
    if incomplete:
        raise CommandError(f"Catalogue photo metadata incomplete; database unchanged: {incomplete}")
    if changed:
        raise CommandError(f"Catalogue photos changed from the reviewed sources: {changed}")
    return photos


def _lock_catalogue() -> None:
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [2026091901])


def _slug(title: str) -> str:
    return slugify(title)[:60]


def _image_format(data: bytes) -> tuple[str, str, int, int]:
    if data[:4] == PNG_MAGIC:
        width, height = struct.unpack(">II", data[16:24])
        return "image/png", "png", width, height
    width, height = jpeg_size(data)
    return "image/jpeg", "jpg", width, height


def _source_metadata(spec: str, data: bytes) -> dict[str, str]:
    return {
        **PHOTO_SOURCES[spec],
        "catalogue_source": spec,
        "catalogue_sha256": hashlib.sha256(data).hexdigest(),
    }


def _stored_image(
    owner: User,
    identity: uuid.UUID,
    kind: str,
    spec: str,
    sources: dict[str, dict[str, str]],
    adaptation: str | None = None,
) -> Image | None:
    image = Image.objects.filter(pk=identity).first()
    if image is None:
        return None
    _verify(image, {"owner_id": owner.id, "kind": kind, "ready": True}, f"image {identity}")
    expected = {field: sources[spec][field] for field in SOURCE_FIELDS}
    if adaptation:
        expected["adaptation"] = adaptation
    expected["catalogue_source"] = spec
    stored = image.source_metadata or {}
    changed = [field for field, value in expected.items() if stored.get(field) != value]
    if changed:
        raise CommandError(
            f"image {identity} differs from the catalogue manifest: {', '.join(changed)}"
        )
    return image


def _create_image(
    owner: User,
    identity: uuid.UUID,
    kind: str,
    data: bytes,
    source: dict[str, str],
) -> Image:
    content_type, extension, width, height = _image_format(data)
    key = f"{kind}/catalogue/{identity}.{extension}"
    conflict = Image.objects.filter(key=key).exclude(pk=identity).first()
    if conflict:
        raise CommandError(f"Catalogue image key is already used by {conflict.id}: {key}")
    storage.put_object(key, data, content_type)
    return Image.objects.create(
        id=identity,
        owner_id=owner.id,
        kind=kind,
        key=key,
        content_type=content_type,
        size=len(data),
        width=width,
        height=height,
        ready=True,
        source_metadata=source,
    )


def _catalogue_image(
    owner: User,
    identity: uuid.UUID,
    kind: str,
    spec: str,
    photos: dict[str, bytes],
    sources: dict[str, dict[str, str]],
) -> Image:
    return _stored_image(owner, identity, kind, spec, sources) or _create_image(
        owner, identity, kind, photos[spec], _source_metadata(spec, photos[spec])
    )


def _verify(instance, expected: dict, label: str) -> None:
    changed = [field for field, value in expected.items() if getattr(instance, field) != value]
    if changed:
        raise CommandError(f"{label} differs from the catalogue manifest: {', '.join(changed)}")


def _creator(definition: dict) -> User:
    identity = stable_id("creator", definition["username"])
    by_email = User.objects.filter(email=definition["email"]).first()
    by_username = User.objects.filter(username=definition["username"]).first()
    existing = by_email or by_username or User.objects.filter(pk=identity).first()
    if existing:
        if existing != by_email or existing != by_username or existing.id != identity:
            raise CommandError(f"Demo creator identity conflicts with @{definition['username']}.")
        _verify(
            existing,
            {
                "email": definition["email"],
                "username": definition["username"],
                "is_demo": True,
                "email_verified": True,
            },
            f"demo creator @{definition['username']}",
        )
        user = existing
    else:
        user = User.objects.create_user(
            definition["email"],
            definition["username"],
            uuid.uuid4().hex,
            id=identity,
            is_demo=True,
            email_verified=True,
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
    profile = user.profile
    profile_values = {
        "display_name": definition["display_name"],
        "bio": definition["bio"],
    }
    changed = [field for field, value in profile_values.items() if getattr(profile, field) != value]
    if changed:
        for field in changed:
            setattr(profile, field, profile_values[field])
        profile.save(update_fields=[*changed, "updated_at"])
    return user


def _card_config(card_set: dict, card: list, position: int) -> dict:
    name, rarity, template_key, config = card[:4]
    template = TEMPLATES_BY_KEY[template_key]
    full = {**default_config(template_key), **config}
    body_faces = card_set.get("body_faces", {})
    body_face = body_faces.get(template_key, body_faces.get(""))
    if body_face and "body_typeface" not in config:
        full["body_typeface"] = body_face
    if "corners" not in config and "corners" in template["options"]:
        full["corners"] = CORNER_CUTS[position % len(CORNER_CUTS)]
    variety = zlib.crc32(f"{card_set['title']}:{name}".encode())
    choices_by_option = {
        "stock": ["cream", "sage", "peach", "sky", "lavender", "pine", "navy", "cocoa", "plum"],
        "texture": ["linen", "grain", "canvas", "felt", "smooth"],
        "border": ["auto", "sage", "copper", "teal", "gold", "silver"],
        "border_width": ["hairline", "thin", "medium"],
    }
    for option, choices in choices_by_option.items():
        option_definition = template["options"].get(option)
        if option in config or option_definition is None:
            continue
        if option == "stock" and template_key == "minimal":
            continue
        allowed = [choice for choice in choices if choice in option_definition["values"]]
        if allowed:
            full[option] = allowed[variety % len(allowed)]
            variety //= len(allowed)
    surface = card_set.get("surface")
    if surface and "texture" in full and "texture" not in config:
        full["texture"] = surface
    specialty = SPECIALTY_BY_RARITY.get(rarity)
    if specialty:
        for option, choice in specialty[zlib.crc32(name.encode()) % len(specialty)].items():
            option_definition = template["options"].get(option)
            if option not in config and option_definition and choice in option_definition["values"]:
                full[option] = choice
    problems = template_problems(template_key, rarity) + config_problems(template_key, full, rarity)
    if problems:
        raise CommandError(f"Invalid catalogue card {name}: {problems}")
    return full


def _card_values(card_set: dict, card: list, position: int, image: Image) -> dict:
    name, rarity, template_key, _config, copy_text = card[:5]
    printed_text, description = copy_text
    text_rules = TEMPLATES_BY_KEY[template_key]["text"]
    if len(name) > text_rules["title"]["max_length"]:
        raise CommandError(f"Catalogue title does not fit {template_key}: {name}")
    if text_rules["printed"] is None and printed_text:
        raise CommandError(f"Catalogue printed text is not supported by {template_key}: {name}")
    if text_rules["printed"] and len(printed_text) > text_rules["printed"]["max_length"]:
        raise CommandError(f"Catalogue printed text does not fit {template_key}: {name}")
    printed_issues = [issue for issue in description_issues(printed_text) if issue != "too_long"]
    if printed_issues:
        raise CommandError(f"Catalogue printed text is invalid for {name}: {printed_issues}")
    return {
        "image_id": image.id,
        "title": name,
        "rarity": rarity,
        "description": description,
        "printed_text": printed_text,
        "template_key": template_key,
        "template_version": TEMPLATES_BY_KEY[template_key]["version"],
        "template_config": _card_config(card_set, card, position),
        "position": position,
    }


KEYED_ADAPTATION = "Background keyed out for pack artwork."


def _pack_cutouts(design: dict) -> list[dict[str, str]]:
    if "cutouts" in design:
        return design["cutouts"]
    if design.get("cutout"):
        return [{"spec": design["cutout"]}]
    if design.get("keyed"):
        return [{"keyed": design["keyed"]}]
    return []


def _cutout_spec(cutout: dict[str, str]) -> str:
    return cutout["spec"] if "spec" in cutout else _keyed_sources()[cutout["keyed"]]


def _pack_art_id(title: str, index: int) -> uuid.UUID:
    # The first cutout keeps the single-cutout identity already published.
    return stable_id("pack-art", title) if index == 0 else stable_id("pack-art", title, index)


def _pack_images(
    card_set: CardSet,
    definition: dict,
    photos: dict[str, bytes],
    sources: dict[str, dict[str, str]],
) -> list[Image]:
    images = []
    for index, cutout in enumerate(_pack_cutouts(definition["pack_design"])):
        identity = _pack_art_id(definition["title"], index)
        creator = card_set.creator
        if "spec" in cutout:
            images.append(
                _catalogue_image(
                    creator, identity, Image.Kind.PACK, cutout["spec"], photos, sources
                )
            )
            continue
        spec = _cutout_spec(cutout)
        stored = _stored_image(creator, identity, Image.Kind.PACK, spec, sources, KEYED_ADAPTATION)
        if stored:
            images.append(stored)
            continue
        path = Path(__file__).parent / "management" / "cutouts" / f"{cutout['keyed']}.png"
        data = path.read_bytes()
        source = {**_source_metadata(spec, data), "adaptation": KEYED_ADAPTATION}
        images.append(_create_image(creator, identity, Image.Kind.PACK, data, source))
    return images


def _pack_values(
    card_set: CardSet,
    definition: dict,
    photos: dict[str, bytes],
    sources: dict[str, dict[str, str]],
) -> tuple[list, list]:
    design = definition["pack_design"]
    cards = list(card_set.cards.select_related("image").order_by("position"))
    cutouts = _pack_images(card_set, definition, photos, sources)

    def pick(which: str):
        if which in {"legendary", "epic", "rare"}:
            found = next((card for card in cards if card.rarity == which), None)
            if found:
                return found
        return cards[0]

    emblem = {
        **PACK_LAYER_DEFAULTS,
        "kind": "emblem",
        "scale": design.get("emblem_scale", 100),
        "y": design.get("emblem_y", 0),
        "hidden": design.get("emblem_hidden", False),
    }
    layers = []
    for spec in design.get("art", []):
        if spec.get("emblem"):
            layers.append(emblem)
            continue
        if "cutout" in spec:
            # True is the original single-cutout form and means the first one.
            index = 0 if spec["cutout"] is True else spec["cutout"]
            if not isinstance(index, int) or not 0 <= index < len(cutouts):
                raise CommandError(f"{definition['title']} pack art has no cutout {index}.")
            image_id = cutouts[index].id
            scale = spec.get("scale", 60)
            y = spec.get("y", -12)
        else:
            card = pick(spec.get("pick", "first"))
            image_id = card.image_id
            if spec.get("fit") == "flood":
                wide = (card.image.width or 4) / (card.image.height or 5)
                scale = min(ART_SCALE_MAX, round(PACK_COVER_RATIO * wide * 100) + 14)
                y = 0
            else:
                scale = spec.get("scale", 60)
                y = spec.get("y", -13)
        layers.append(
            {
                **PACK_LAYER_DEFAULTS,
                "kind": "image",
                "image_id": str(image_id),
                "scale": scale,
                "x": spec.get("x", 0),
                "y": y,
                "rotate": spec.get("rotate", 0),
                "flip_x": spec.get("flip_x", False),
                "flip_y": spec.get("flip_y", False),
                "opacity": spec.get("opacity", 100),
            }
        )
    if emblem not in layers:
        layers.append(emblem)
    problems = pack_layer_problems(layers)
    if problems:
        raise CommandError(f"{definition['title']} pack art is invalid: {problems}")
    text = [
        {
            **PACK_TEXT_DEFAULTS,
            "text": line[0].format(pack=card_set.pack_size, code=card_set.set_code),
            "colour": line[1],
            "size": line[2],
            "y": line[3],
            "tracking": line[4],
            "font": line[5],
            # Optional trailing x and rotate, for text set off the centre line.
            "x": line[6] if len(line) > 6 else 0,
            "rotate": line[7] if len(line) > 7 else 0,
        }
        for line in design.get("lines", [])
    ]
    return layers, text


def _set_values(definition: dict, creator: User) -> dict:
    return {
        "creator_id": creator.id,
        "title": definition["title"],
        "slug": _slug(definition["title"]),
        "description": definition["description"],
        "mark": definition.get("mark", ""),
        "set_code": definition.get("set_code", ""),
        "pack_colour": definition.get("pack_colour", ""),
        "binder_colour": BINDER_COLOURS[
            zlib.crc32(definition["title"].encode()) % len(BINDER_COLOURS)
        ],
        "pack_finish": definition.get("pack_finish", ""),
        "emblem_layout": definition.get("emblem_layout", ""),
        "emblem_shape": definition.get("emblem_shape", ""),
        "emblem_style": definition.get("emblem_style", ""),
        "emblem_text": definition.get("emblem_text", ""),
        "pack_size": definition.get("pack_size", 5),
    }


def _bootstrap_set(
    definition: dict,
    creator: User,
    photos: dict[str, bytes],
    sources: dict[str, dict[str, str]],
) -> tuple[CardSet, bool]:
    if len(definition["title"]) > SET_TITLE_MAX_LENGTH:
        raise CommandError(f"Catalogue set title does not fit the card back: {definition['title']}")
    identity = stable_id("set", definition["title"])
    expected = _set_values(definition, creator)
    try:
        CardSet(id=identity, **expected).clean_fields(exclude=["creator", "cover"])
    except ValidationError as error:
        raise CommandError(f"{definition['title']} is invalid: {error.message_dict}") from error
    card_set = CardSet.objects.filter(pk=identity).first()
    conflict = CardSet.objects.filter(slug=expected["slug"]).exclude(pk=identity).first()
    if conflict:
        raise CommandError(
            f"Catalogue slug is already used by set {conflict.id}: {expected['slug']}"
        )
    code_conflict = (
        CardSet.objects.filter(set_code=expected["set_code"], set_code_suffix="01")
        .exclude(pk=identity)
        .first()
    )
    if code_conflict:
        raise CommandError(
            f"Catalogue code {expected['set_code']}-01 is already used by set {code_conflict.id}."
        )
    if card_set:
        _verify(
            card_set,
            {
                **expected,
                "set_code_suffix": "01",
                "cover_id": stable_id("card-image", definition["title"], 0),
                "status": CardSet.Status.PUBLISHED,
            },
            definition["title"],
        )
        expected_cards = definition["cards"]
        cards = list(card_set.cards.order_by("position"))
        if len(cards) != len(expected_cards):
            raise CommandError(f"{definition['title']} differs from the catalogue manifest: cards")
        for position, (card, card_definition) in enumerate(zip(cards, expected_cards, strict=True)):
            card_id = stable_id("card", definition["title"], position)
            image_id = stable_id("card-image", definition["title"], position)
            if card.id != card_id or card.image_id != image_id:
                raise CommandError(
                    f"{definition['title']} card {position + 1} has a different stable identity."
                )
            image = _catalogue_image(
                creator, image_id, Image.Kind.CARD, card_definition[5], photos, sources
            )
            _verify(
                card,
                {
                    **_card_values(definition, card_definition, position, image),
                    "set_total": len(expected_cards),
                },
                f"{definition['title']} card {position + 1}",
            )
        layers, text = _pack_values(card_set, definition, photos, sources)
        _verify(card_set, {"pack_layers": layers, "pack_text": text}, definition["title"])
        apply_tags(card_set, definition["tags"], SET_TAG_MAX)
        return card_set, False

    with transaction.atomic():
        card_set = CardSet.objects.create(id=identity, **expected)
        for position, card_definition in enumerate(definition["cards"]):
            image = _catalogue_image(
                creator,
                stable_id("card-image", definition["title"], position),
                Image.Kind.CARD,
                card_definition[5],
                photos,
                sources,
            )
            CardDefinition.objects.create(
                id=stable_id("card", definition["title"], position),
                card_set=card_set,
                **_card_values(definition, card_definition, position, image),
            )
        card_set.cover = card_set.cards.get(position=0).image
        card_set.save(update_fields=["cover"])
        layers, text = _pack_values(card_set, definition, photos, sources)
        card_set.pack_layers = layers
        card_set.pack_text = text
        card_set.save(update_fields=["pack_layers", "pack_text"])
        problems = publish_set(card_set)
        if problems:
            raise CommandError(f"Could not publish {definition['title']}: {problems}")
        apply_tags(card_set, definition["tags"], SET_TAG_MAX)
    card_set.refresh_from_db()
    return card_set, True


def bootstrap_catalogue(
    manifest: dict | None = None, photos: dict[str, bytes] | None = None
) -> tuple[list[CardSet], list[CardSet]]:
    manifest = manifest or load_manifest()
    if manifest.get("version") != 1:
        raise CommandError("Unsupported catalogue manifest version.")
    if photos is None:
        photos = prepare_photos(manifest)
    created: list[CardSet] = []
    verified: list[CardSet] = []
    with transaction.atomic():
        _lock_catalogue()
        creators = {
            _definition["username"]: _creator(_definition) for _definition in manifest["creators"]
        }
        for definition in manifest["sets"]:
            card_set, was_created = _bootstrap_set(
                definition, creators[definition["creator"]], photos, manifest["sources"]
            )
            (created if was_created else verified).append(card_set)
    return created, verified
