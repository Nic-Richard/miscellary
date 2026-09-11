# Curated demo photography and launch-content direction

The existing development seed contains a small group of manually curated collections and a larger
legacy set of search-selected images. It remains useful for local development, but it is not the target
production bootstrap catalogue. The launch-content pass can replace most of it and rework the strongest
grounded subjects, including records, film cameras, rocks/minerals, and other collections that feel like
things real hobbyists would make.

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

## Existing local preparation workflow

`apps/api/cards/management/commands/seed_photos.json` records the current curated development assets.
`seed_demo --prepare-photos` downloads only those assets into the ignored `tmp/seed-photos` cache and
returns without database writes. Docker uses the same cache through its repository mount. Once seeded,
images are served from the app's own media storage; clients do not need to contact source providers.

```bash
docker compose exec api uv run python manage.py seed_demo --prepare-photos
```

Normal `seed_demo` still deletes and recreates local demo accounts and associated data and requires
separate approval before use on a running review database. Curated download failure aborts before deletion.
`--no-photos` explicitly opts into placeholders.

The current approved development reset recreated eight collectors, eleven published sets, and one draft.
A pre-reset database backup remains in `tmp/demo-reset-backup/before-reset.dump`. Production bootstrap
content should use a separate persistent path and should not be recreated automatically on startup.
