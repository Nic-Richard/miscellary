# Design system

Miscellary uses a tactile collector's-desk visual language. The web interface combines cream
cardstock, teal cloth, photographic binder and pack materials, restrained controls, and colorful
cards. The set binder is the main physical object; pack opening is the only dark, theatrical
surface.

## Foundations

Global tokens are defined in `apps/web/app/globals.css`.

| Token                            | Value                             | Use                                        |
| -------------------------------- | --------------------------------- | ------------------------------------------ |
| `--bg` / `--sur` / `--sur2`      | `#f4eee1` / `#f9f4ea` / `#ebe3d1` | Page ground, panels, and recessed surfaces |
| `--bdr` / `--bdr2`               | `#ddd3bf` / `#c7bba3`             | Hairlines and stronger rules               |
| `--text` / `--muted` / `--faint` | `#372e25` / `#6f6355` / `#9a8e7c` | Text hierarchy                             |
| `--cloth` / `--cloth-deep`       | `#93b8b2` / `#6c948e`             | Binder cloth, avatars, and identity cards  |
| `--accent` / `--accent-deep`     | `#278b82` / `#1e6e67`             | Buttons, links, and active states          |
| `--foil`                         | `#7ccdbf`                         | Default pack wrapper                       |
| `--gold`                         | `#b8903a`                         | Legendary effects, emblems, and card backs |
| `--danger`                       | `#ae4a3a`                         | Errors and destructive actions             |

Rarity colors are common teal `#3f8f88`, uncommon mustard `#b48a2c`, rare violet `#7b5fa3`,
epic terracotta `#c66a3c`, and legendary gold `#c9a24a`.

### Typography

Bebas Neue is the primary display face for titles, card numbers, labels, and buttons. Roboto
Condensed is the body face. Interface labels generally use uppercase text with tracking, while
body copy remains mixed case.

Creators can use Playfair Display, Cinzel, Archivo Black, Space Mono, Caveat, and Alfa Slab One
for card and pack display text. Font keys are validated in `apps/api/cards/identity.py` and mapped
to CSS variables in `apps/web/lib/fonts.ts`.

## Runtime assets

The committed files under `apps/web/public/materials` are production assets:

| Asset                                                                                 | Purpose                                            |
| ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `binder.png`                                                                          | Open binder and sleeve base used on set pages      |
| `binder-cloth.png`                                                                    | Tintable binder-cover layer                        |
| `pack-blank.png`                                                                      | Blank foil wrapper with a transparent silhouette   |
| `pack-shading.png`                                                                    | Neutral luminance layer that relights pack artwork |
| `paper.jpg`                                                                           | Seamless page texture                              |
| `cloth.jpg`                                                                           | Seamless cloth texture                             |
| `tex-linen.png`, `tex-canvas.png`, `tex-grain.png`, `tex-felt.png`, `tex-brushed.png` | Neutral card-stock textures                        |

Card-stock textures are centered on mid gray and use `mix-blend-mode: overlay`, allowing one
texture to work across light, dark, and foil colors. They can be rebuilt with
`scripts/make-card-textures.ps1`. Other visual elements, including tabs, controls, card faces,
rarity effects, card backs, and pack badges, are implemented with CSS or inline SVG.

## Shared interface primitives

`apps/web/components/ui.module.css` defines common typography, button, panel, form, statistic,
and ticket styles. Reusable form controls live under `apps/web/components/controls`.

`Sheet` provides the ruled page and header used for inventory-style grids. `CardGrid` provides a
consistent responsive card layout. Empty sheets include a compact explanation and a relevant
action so first-use states remain purposeful.

## Binder and set navigation

The binder is reserved for an individual set page. `components/binder/Binder.tsx` positions eight
card slots over the photographic sleeves and adds sleeve gloss. Empty slots cover the printed
base card. The geometry scales with the binder container.

`components/binder/FolderTabs.tsx` switches between Binder, All cards, and Collected. The binder
shows one spread at a time. The grid views sit on ruled sheets aligned with the binder so every
section belongs to the same physical system.

`components/BinderCover.tsx` represents closed binders on shelves in browse, profile, and studio
views. `components/SetCover.tsx` displays a set cover in a glassine sleeve and becomes editable
when given an `onChange` handler.

## Cards

`components/CardPreview.tsx` uses container-relative units so the same card markup works at every
display size. Cards use a 5:7 trading-card ratio and combine a header, photo, description, set
mark, dimensional stock, and a recessed image window. The card face carries no rarity label.

The available templates are:

- Classic: framed photo on a configurable card stock
- Polaroid: open photo with a wide caption margin
- Full Art: full-bleed photo with text on scrims (Epic and above)
- Bold: strong border, large title, and configurable image shape
- Field Note: warm note stock with a larger description panel
- Dossier: dark or oxblood stock with a structured description panel

Template configuration controls stock, accent, border, display font, texture, corners, and
template-specific treatments. Each published card stores its template snapshot.

Every card carries the same physical treatment: a pale die-cut rim, a contact shadow over two
ambient steps, a print grain above the face, and one press curve across the photo so uneven
uploads still sit in the same print. The clear coat uses the same 104deg light angle as the pack
wrapper.

Every card is printed to the same standard; rarity never lowers material quality. A card's coat
is whatever its creator chose - matte, satin, gloss, pearl or metallic - and grain and sheen are
properties of that coat, so a matte card shows more tooth than a gloss one at any rarity.

Rarity gates which specialty values a creator may pick, not how much treatment is applied. Relief
and cut-edge colour follow the tier rather than a control, since they are too small to be worth
choosing. The legendary chase treatment is a separate axis layered over the chosen coat, so a
foiled legendary can still be matte linen underneath. Each treatment is two sibling layers, a
field and a travelling band, kept as siblings because a blended layer that owns a stacking
context would make its children blend against that instead of against the card. Coverage decides
where they mount: over the picture, in a struck band round the rim, or across the whole face.
Foil struck on bare board is opaque metal; over a photo it keys off the backdrop so the picture
survives. Holo carries its spectrum in the band rather than painted flat, because a static
full-surface lattice reads as tartan and buries the artwork. Snapshots saved before the finish option
existed fall back to a per-rarity coat, which is why the `:not([data-finish])` rules exist.

The exact rarity is not printed on the card face.

## Pack and set identity

`components/PackPouch.tsx` renders the foil wrapper, creator artwork, set badge, free text, and
shading in a clipped stack. The underlying wrapper is always present so transparent artwork shows
foil instead of an empty area.

Pack artwork supports up to five image or badge layers. Each layer can be hidden, positioned,
scaled, rotated, flipped, and faded. Uploaded artwork remains PNG or WebP so transparency is
preserved. `components/ArtPicker.tsx` uses a checkerboard preview to make transparency clear.

Set badges support seal, stacked, wordmark, badge, and crest layouts; several plate shapes;
filled, outline, and transparent styles; configurable ink; title sizing; and a set mark. Free text
supports up to six positioned lines with font, size, color, rotation, and letter spacing.

Pack appearance is stored on `CardSet`, including color, finish, layers, badge options, free text,
and pack size. Identity presentation can change without modifying published card snapshots.

`components/CardBack.tsx` gives every card in a set a shared back using the set mark, foil color,
gold linework, and a repeating background motif.

## Trading and profiles

Trade construction presents both collectors' cards as two grouped sheets and keeps the proposed
exchange visible in a pinned deal bar. Duplicate copies are grouped into a single selectable pile,
and cards held by another pending offer remain visible but unavailable.

`components/ShowcaseCase.tsx` presents six profile cards on dark felt behind glass with a brass
title plate. Empty mounts remain visible as space for future additions. The same component is used
for profile display and showcase editing.

## Motion

- Pack opening begins with a pointer or keyboard-operated foil tear.
- Releasing after the tear threshold completes the rip; an earlier release returns the wrapper.
- Cards flip into the reveal area one at a time.
- Rare pulls receive a burst, while legendary pulls receive a gold bloom and ring.
- Legendary cards carry a travelling pass: foil a narrow specular every 6.5s, holo a wider
  spectral band every 4.8s. Both rest off-card for most of the cycle.
- Shelves, controls, and pickers use short, restrained transitions.

Pointer events provide one interaction path for touch, pen, and mouse. Keyboard users can focus
the pack and open it with Enter.

## Demo content

`apps/api/cards/management/commands/seed_demo.py` creates collectors, published and draft sets,
owned cards, likes, comments, follows, showcases, pack history, and trade offers. It uses
Wikimedia Commons photographs when available and supports `--no-photos` for offline placeholders.

```bash
docker compose up -d
docker compose exec api uv run python manage.py migrate
docker compose exec api uv run python manage.py seed_demo
```
