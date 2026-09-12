"""Cut seed photographs out of their backgrounds, for printing on pack wrappers.

Several of the seeded photographs are shot against a flat studio backdrop or
plain black. Keying that away leaves the subject alone, which is what a pack
wants: the wrapper's own colour and foil then show around it instead of being
hidden under a rectangle.

The key floods in from the edges rather than removing every pixel of that
colour, so a white camera body or a black shadow inside the subject survives.

Run from the repository root, after the photo cache has been filled:

    docker compose exec api uv run python manage.py seed_demo --prepare-photos
    python scripts/make-cutouts.py

It writes PNGs and a source record into apps/api/cards/management/cutouts/.
"""

from __future__ import annotations

import json
import uuid
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tmp" / "seed-photos"
OUT = ROOT / "apps" / "api" / "cards" / "management" / "cutouts"

# Only sources with a clean, contiguous backdrop are keyed.
WANTED: dict[str, dict[str, object]] = {
    "planets-and-moons": {"spec": "nasa:PIA02873", "tolerance": 17},
    "pocket-geology": {"spec": "A clear quartz crystal with natural features.jpg", "tolerance": 56},
    # A black body cannot be leaked into, so the cast shadow can be keyed
    # away wholesale. The Pentax chrome is the same value as its backdrop.
    "film-cameras": {"spec": "camera:canon-ae1", "tolerance": 62},
    "records-on-my-shelf": {"spec": "45 rpm Single Record.jpg", "tolerance": 26},
}


def cached(spec: str) -> Path:
    return CACHE / (uuid.uuid5(uuid.NAMESPACE_URL, spec).hex + ".jpg")


def background(image: Image.Image) -> tuple[int, int, int]:
    """The colour the edges are, taken as the median of the border."""
    width, height = image.size
    edge = [image.getpixel((x, 0)) for x in range(0, width, 4)]
    edge += [image.getpixel((x, height - 1)) for x in range(0, width, 4)]
    edge += [image.getpixel((0, y)) for y in range(0, height, 4)]
    edge += [image.getpixel((width - 1, y)) for y in range(0, height, 4)]
    return tuple(sorted(band)[len(edge) // 2] for band in zip(*edge, strict=True))  # type: ignore[return-value]


def key(image: Image.Image, tolerance: int) -> Image.Image:
    """Flood the background in from every edge and clear it."""
    width, height = image.size
    pixels = image.load()
    back = background(image)
    limit = tolerance * tolerance * 3

    def matches(x: int, y: int) -> bool:
        r, g, b = pixels[x, y][:3]
        return (r - back[0]) ** 2 + (g - back[1]) ** 2 + (b - back[2]) ** 2 <= limit

    clear = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        for y in (0, height - 1):
            if matches(x, y) and not clear[y * width + x]:
                clear[y * width + x] = 1
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if matches(x, y) and not clear[y * width + x]:
                clear[y * width + x] = 1
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and not clear[ny * width + nx]:
                if matches(nx, ny):
                    clear[ny * width + nx] = 1
                    queue.append((nx, ny))

    out = image.convert("RGBA")
    mask = Image.frombytes("L", (width, height), bytes(0 if f else 255 for f in clear))
    out.putalpha(mask)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    record: dict[str, str] = {}
    for name, want in WANTED.items():
        spec = str(want["spec"])
        source = cached(spec)
        if not source.exists():
            print(f"{name}: no cached photo for {spec}")
            continue
        image = Image.open(source).convert("RGB")
        image.thumbnail((900, 900))
        cut = key(image, int(want["tolerance"]))  # type: ignore[arg-type]
        box = cut.split()[-1].getbbox()
        if box:
            cut = cut.crop(box)
        cut.save(OUT / f"{name}.png")
        clear = cut.split()[-1].histogram()[0] / (cut.width * cut.height)
        record[name] = spec
        print(f"{name}: {cut.size} {clear * 100:.0f}% clear from {spec}")
    (OUT / "sources.json").write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
