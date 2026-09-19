import html
import json
import re
import struct
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

CACHE_DIR = Path(tempfile.gettempdir()) / "miscellary-seed-photos"
PHOTO_MANIFEST = Path(__file__).resolve().parent / "management" / "seed_photos.json"
CURATED_PHOTOS = json.loads(PHOTO_MANIFEST.read_text(encoding="utf-8"))
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
PUBLIC_DOMAIN_MARK = "https://creativecommons.org/publicdomain/mark/1.0/"
SOURCE_AUTHOR_OVERRIDES = {"Vinyl groove macro.jpg": "Shane Gavin"}
PNG_MAGIC = bytes([0x89]) + b"PNG"
AGENT = {"User-Agent": "miscellary-catalogue/1.0 (nic@nicrichard.dev)"}
MIN_GAP = 0.8

PHOTO_SOURCES: dict[str, dict[str, str]] = {}
_last_request = 0.0
_requests_blocked_until = 0.0


def _open(url: str, attempts: int = 4):
    global _last_request, _requests_blocked_until
    if not url:
        return None
    if time.monotonic() < _requests_blocked_until:
        return None
    for attempt in range(attempts):
        gap = time.monotonic() - _last_request
        if gap < MIN_GAP:
            time.sleep(MIN_GAP - gap)
        _last_request = time.monotonic()
        try:
            request = urllib.request.Request(url, headers=AGENT)
            return urllib.request.urlopen(request, timeout=30)
        except urllib.error.HTTPError as error:
            if error.code != 429:
                return None
            if attempt == attempts - 1:
                _requests_blocked_until = time.monotonic() + 60
                return None
            retry_after = error.headers.get("Retry-After")
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


def _commons_query(parameters: dict[str, str]) -> dict:
    response = _open(f"{COMMONS_API}?{urllib.parse.urlencode(parameters)}")
    if response is None:
        return {}
    try:
        with response:
            return json.loads(response.read())
    except (OSError, ValueError):
        return {}


def search_commons(term: str) -> tuple[bytes, dict[str, str]] | None:
    payload = _commons_query(
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
    pages = (payload.get("query") or {}).get("pages") or {}
    for page in sorted(pages.values(), key=lambda item: item.get("index", 0)):
        info = (page.get("imageinfo") or [{}])[0]
        if not str(info.get("mime", "")).startswith("image/"):
            continue
        data = _get(info.get("thumburl", ""))
        if data:
            return data, _commons_source(page)
    return None


def fetch_commons_file(filename: str) -> tuple[bytes, dict[str, str]] | None:
    payload = _commons_query(
        {
            "action": "query",
            "format": "json",
            "titles": f"File:{filename}",
            "prop": "imageinfo",
            "iiprop": "url|mime|extmetadata",
            "iiurlwidth": "900",
        }
    )
    pages = (payload.get("query") or {}).get("pages") or {}
    page: dict[str, Any] = next(iter(pages.values()), {})
    info = (page.get("imageinfo") or [{}])[0]
    data = _get(info.get("thumburl", ""))
    return (data, _commons_source(page)) if data else None


def fetch_photo(spec: str) -> bytes | None:
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
                return cached.read_bytes()
            except (OSError, ValueError):
                pass
        result = (
            search_commons(spec.removeprefix("search:"))
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
                json.dumps(PHOTO_SOURCES[spec], ensure_ascii=False, indent=2), encoding="utf-8"
            )
    return data


def jpeg_size(data: bytes) -> tuple[int, int]:
    index = 2
    while index < len(data) - 9:
        if data[index] != 0xFF:
            index += 1
            continue
        marker = data[index + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack(">HH", data[index + 5 : index + 9])
            return width, height
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            index += 2
            continue
        (length,) = struct.unpack(">H", data[index + 2 : index + 4])
        index += 2 + length
    return 900, 900
