# Curated demo photography

Deep Cuts and Garden Birds were retained. Other Worlds replaced Night Sky with six
specific NASA mission images. Shutter Shelf replaced Market Saturday with five named
film cameras. These are shared demo collections, not a separate Android seed.

`apps/api/cards/management/seed_photos.json` records each selected asset's download URL,
source, photographer or mission credit, and usage terms. The eleven images were
downloaded and visually reviewed. The camera photos use named files, including static
thumbnails and an original Flickr image; these collections do not use Commons search.

Credits, source URLs, license URLs, and a crop notice were included in seeded card
descriptions. The original image bytes were preserved; the card renderer crops their
display. CC BY-SA photo adaptations remain subject to the indicated photo license.
NASA attribution does not imply endorsement.

## Preparing without resetting data

Run `docker compose exec api uv run python manage.py seed_demo --prepare-photos`.
This downloads only the curated assets into the ignored repository `tmp/seed-photos`
cache and returns without database writes. Docker uses that same cache through its
repository mount. Once seeded, images are served from the app's own media storage;
clients never need to contact the source providers.

Normal `seed_demo` still deletes and recreates demo accounts and their associated
collections, sets, and trades. It requires separate approval before use on the running
review database. Curated download failure aborts before deletion. `--no-photos` explicitly
opts into placeholders and omits photo credits.

The other demo collections still contain legacy Commons references and search-based
photo selection, with placeholder fallback. They have not received the same subject-by-
subject review. An approved reset subsequently recreated eight collectors, eleven published sets,
and one draft. All eleven curated images served successfully; thirteen legacy downloads fell back
to gradients. A pre-reset database backup was saved in `tmp/demo-reset-backup/before-reset.dump`.
Production launch content remains unfinished.
