# Curated demo photography and launch-content direction

The demo catalogue in `apps/api/cards/catalogue_manifest.json` is the production bootstrap content:
eighteen curated sets by demo creators. This document is the standard new sets are held to.

## Launch photography standard

Launch/bootstrap images must be chosen deliberately, subject by subject. Use public-domain, open-source,
or otherwise appropriately licensed sources with durable source records. Avoid broad search results that
produce weak or generic matches.

For every selected image, keep source URL, photographer/author or institution, license and license URL,
and any required adaptation/crop notes in seed metadata or another internal attribution record. Preserve
the original image bytes where practical; the card renderer is responsible for the display crop.

Card copy has to describe the picture that was actually chosen. Say what the photograph shows and add a
couple of facts the subject supports; do not invent behaviour, weather, places, or moments the frame
does not contain. When a chosen image turns out not to show its subject, replace the image rather than
writing around it.

Source URLs, license text, crop notices, and other seed metadata must not be printed on the card face or
placed in the card's normal user-facing description. Attribution requirements should be satisfied in an
appropriate product/legal/source surface without making the collectible itself read like generated seed
data.

The earlier development seed placed credits and crop notices in some card descriptions. That behavior is
not the launch-content target and can be removed when those sets are replaced or reworked.

## Launch set standard

Production bootstrap sets should generally be substantial enough to browse and collect, commonly around
20-40 cards when the subject supports it. Titles and descriptions should sound natural and specific, not
whimsical, try-hard, promotional, or self-aware about being demo content. Avoid formulaic wording such as
"this collection explores".

Each set should have a coherent visual direction with intentional editor choices, while individual cards
still vary enough to remain interesting. Vary pack size, rarity distribution, binder/pack identity, and
creator style across the catalogue. Building these sets is also an editor stress test: awkward controls,
text constraints, or template combinations found during seeding should feed the final editor pass.

Production bootstrap creators must be clearly marked as demo accounts in the UI, for example with a small
robot icon and accessible "Demo account" label beside their name. They can have realistic profiles and
activity without being presented as real users. Seed follows and likes in varied amounts. Comments are
optional and should be sparse, short, and ordinary when used. Collections and trades can also be seeded so
the product feels lived in without fabricating real-user activity.

## Catalogue workflows

`apps/api/cards/catalogue_manifest.json` records the persistent demo creators, published sets, cards,
pack designs, tags, and source references. `bootstrap_catalogue --prepare-photos` downloads and checks
every image not yet stored, against its source record and pinned hash, without database writes. Once
stored, a copy is authoritative: later runs check its recorded source instead of downloading it again, so
a provider re-encoding its file does not block the catalogue. Images are served from the app's own media
storage; clients do not need to contact source providers.

A set's `pack_design` lists its `cutouts`: transparent images given either as a source (`{"spec": ...}`)
or as a PNG keyed out by `scripts/make-cutouts.py` (`{"keyed": ...}`). Its `art` list is the layer stack
from bottom to top. A layer names a cutout by index (`{"cutout": 1}`) or a card photo (`{"pick": "rare"}`),
with the pack editor's `scale`, `x`, `y`, `rotate`, `flip_x`, `flip_y` and `opacity`. `{"emblem": true}`
places the set's lockup in the stack; without it the lockup sits on top. The stack is held to the editor's
own limits, including five layers.

A keyed PNG floods the backdrop in from the photo's edges. Set `shadows` to follow a cast shadow across
the backdrop as well, `holes` to name points (as fractions of the photo) inside enclosed gaps such as a
watch bow, and `crop` to keep only part of the photo. Look at each cutout on a strong colour before
using it: grey silver and steel can match a grey backdrop, and the shadow pass will eat into them.

```bash
docker compose exec api uv run python manage.py bootstrap_catalogue --prepare-photos
```

Production bootstraps from the reviewed copies instead of downloading: `--export-photos <dir>` writes
every pinned photo from the development cache under its hash, and `--photos <dir or s3:// prefix>`
reads them back. `scripts/bootstrap-production-catalogue.sh` does both.

`bootstrap_catalogue` creates missing manifest entries and verifies existing published entries. It never
rewrites a published set or card; a mismatch aborts the command. Adding a reviewed set to the manifest and
running the command creates only that set. `refresh_demo_activity` replaces synthetic collections, likes,
follows, showcases, and set follows belonging to demo accounts. Demo-only trades require
`--include-trades`. Real-user rows are outside its deletion scope.

Neither catalogue command runs automatically on application startup.
