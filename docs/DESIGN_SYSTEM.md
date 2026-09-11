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

Rarity colors are common grey `#7a8085`, uncommon blue `#3f6ea8`, rare violet `#7b5fa3`,
epic pink `#c0568c`, and legendary gold `#c9a24a`.

### Typography

Bebas Neue is the primary display face for interface titles, labels and buttons, and for the
printed card identifier, which is the same face on every card so a code reads the same wherever it
is seen. Roboto Condensed is the body face. Interface labels generally use uppercase text with
tracking, while body copy remains mixed case.

A card is set in two faces: one for its title and one for everything else. Fourteen are offered,
chosen to cover what trading cards are actually set in - a flared Roman small caps and engraved caps
for card names, old-style and contemporary serifs for rules text, humanist and geometric sans, a
condensed grotesque, a slab, a monospace and a hand. They are named after the typeface rather than a
category, because a creator picking type wants to know what they are picking.

Faces are validated in `apps/api/cards/identity.py`, mapped to CSS variables in
`apps/web/lib/fonts.ts`, loaded by `apps/web/app/layout.tsx` on the web, and declared again in
`apps/mobile/surfaces/surface.css` for the WebView bundle, which has no access to the web app's
variables. A face added in one place and not the others silently falls back.

## Runtime assets

The committed files under `apps/web/public/materials` are production assets:

| Asset                                                                                 | Purpose                                            |
| ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `binder.png`                                                                          | Open binder and sleeve base used on set pages      |
| `binder-cloth.png`                                                                    | Tintable binder-cover layer                        |
| `pack-blank.png`                                                                      | Blank foil wrapper with a transparent silhouette   |
| `pack-shading.png`                                                                    | Neutral luminance layer that relights pack artwork |
| `tex-paper.png`                                                                       | Near-white paper tile, seamless by construction    |
| `cloth.jpg`                                                                           | Seamless cloth texture                             |
| `tex-linen.png`, `tex-canvas.png`, `tex-grain.png`, `tex-felt.png`, `tex-brushed.png` | Neutral card-stock textures                        |

Card-stock textures are centered on mid gray and use `mix-blend-mode: overlay`, allowing one
texture to work across light, dark, and foil colors. They can be rebuilt with
`scripts/make-card-textures.ps1`. Other visual elements, including tabs, controls, card faces,
rarity effects, card backs, and pack badges, are implemented with CSS or inline SVG.

### Material hierarchy

Surfaces are told apart by what they are, not by tiling one photograph at different sizes. The
rule is that unrelated surfaces must not resolve to the same material.

| Material  | Surfaces                                         | Treatment                                                                                  |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Desk**  | the page ground                                  | colour, one key light, soft non-repeating unevenness, pinned to the viewport               |
| **Rail**  | the navigation sidebar                           | flat, a shade deeper than the desk, lit inner edge                                         |
| **Board** | `ui.panel`, auth forms, comments                 | flat matte card, hairline, slight lift off the desk                                        |
| **Paper** | `Sheet`, `ui.ticket`, the set-cover mount        | `tex-paper.png` multiplied over the surface's own colour, kept for what is literally paper |
| **Cloth** | binder covers, shelf covers, the pack-open stage | `cloth.jpg` and `binder-cloth.png`, recoloured                                             |
| **Stock** | card faces                                       | the neutral card-stock textures above                                                      |

The desk carries no repeating texture. A tiled grain on a near-white ground either disappears or
has to be pushed until it dirties the page, and the paper photograph it replaced both read as one
more sheet of paper and left a visible seam where its 768px tile met itself. Its light is placed
where the binder's lamp is (`apps/web/lib/lighting.ts`), so a page and the props standing on it
agree about where the light comes from.

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
display size. Cards use a 5:7 trading-card ratio and combine a header, photo, printed copy, set
mark, dimensional stock, and a recessed image window. The card face carries no rarity label and no
large card number.

The available templates are:

- Classic: photo above a recessed note panel
- Minimal: framed photo, title bar, caption below
- Polaroid: open photo with a wide caption margin
- Bold: strong border, large title, and configurable image shape
- Full Art: full-bleed photo with text on scrims (Epic and above)

Every template offers every stock and every face: a template is a layout, not a palette. What
differs between them is only which board and faces they start on.

A note panel stays plain: it is a thin white plate over the board, so a dark card still gets a light
box, and it takes its depth from the default relief. It carries no ruling, grid or paper pattern of
its own. A title sits on the same plate, thinner still and bevelled the other way, so the grammar is
that sunk means printed copy and proud means a label.

### Card options

A card is four decisions, and each option declares which one it belongs to. The `group` an option
carries is what the editor sections itself by, so adding a server option places itself.

| Group        | Decides                          | Options                                                      |
| ------------ | -------------------------------- | ------------------------------------------------------------ |
| Board        | What it is printed on and cut to | stock, texture, corners, border ink and width                |
| Print        | How the photo is reproduced      | tint, photo window, window shape, the template's own control |
| Font and ink | The faces and the colour         | title typeface, body typeface, accent                        |
| Press        | What happens after printing      | finish, foil, foil covers, foil pattern                      |

Spot work is not in that table because it is not a decision; see [Spot work](#spot-work).

Photo treatment reaches every template, because the picture is most of a card and gating it would
leave a Common card with little to decide. It is applied as one reproduction curve on the image
rather than an overlay, so it replaces the standard press curve instead of stacking on it. The
photo window - rule, bare, mount, or sunk - is offered wherever a template mounts the photo on
visible board.

Every card is printed to the same standard; rarity never lowers material quality. A card's coat
is whatever its creator chose - matte, satin, gloss, pearl or metallic - and grain and sheen are
properties of that coat, so a matte card shows more tooth than a gloss one at any rarity.

Rarity gates specialty production, not design freedom: Rare opens pearl and metallic coats and the
brushed surface, Epic the Full Art template and foil, Legendary holo and the rainbow pattern a
secret rare is worked with. A locked value stays
visible in its control, hatched and tagged with the tier that opens it, so the ladder is legible from
Common rather than only from the top.

Some production work is not a choice at all, because it is either on every card or too small to be
worth deciding. Cut-edge colour follows the tier, and so does the struck rim, which the card gets
from Rare up. Relief in the sense of depth is simply part of how a card is built, so the image
window and the description panel are recessed into the board on every card at every tier. All of it
is optical shading rather than geometry, and none of it appears in the editor or in a stored config.

### Spot work

Above Common every card carries a spot treatment, and which material it is follows the card rather
than a separate stored setting. `resolveCardSpot` in `packages/shared/src/cardMaterial.ts` is the
one rule: a chosen foil wins and brings its own coverage and pattern, otherwise a metallic coat is
spotted in foil, a pearl coat in pearl, and anything else in clear varnish over the picture.
`card_spot` in `apps/api/cards/rendering.py` mirrors it, so the API knows which cards are produced
with a mask without re-deriving the rule.

A pattern is a working of the foil film, so it only applies where there is one. A card with no foil
takes its material's own ruling, and the editor does not ask about a pattern or a coverage it has no
use for.

Each material is two sibling layers, a field and a specular band, kept as siblings because a
blended layer that owns a stacking context would make its children blend against that instead of
against the card. The four read differently on purpose. Varnish has no colour of its own and is
seen only as a hard narrow specular against the board it was screened onto. Pearl shifts hue across
a wide soft sweep, so its interference lives in the field rather than in the band. Foil is opaque
metal with a bright rolled band. Holo carries its spectrum in the band rather than painted flat,
because a static full-surface lattice reads as tartan and buries the artwork.

Over any of them the pattern says how the film is worked: mirror is polished and unworked, so the
whole read is one hard sweep; linear is ruled; cosmos is a drifting starfield that catches the light
as the card turns; rainbow replaces the travelling band with a secret rare's pastel spectrum.

Area is spot, reverse or the whole face, and it is what separates a spot treatment from a
full-surface one. A spot stops somewhere, so the region carries an edge highlight and the band is
tight enough to travel across it. Reverse is the inverse: the picture is left alone and everything
around it is foiled, which is the treatment that suits a photograph best. Over the whole
face the same material has nowhere to stop, so the field drops to about half strength and the band
widens several times over into a low wash. The difference between spot foil and full foil is that
contrast, not a different set of colours.

Snapshots saved before the finish option existed fall back to a per-rarity coat, which is why the
`:not([data-finish])` rules exist.

The exact rarity is not printed on the card face.

### Printed copy

Printed text obeys the geometry of each template. `apps/api/cards/templates.py` owns the limits and
`packages/shared/src/cardText.ts` mirrors them for display. Every region declares a maximum length, a
minimum type scale, a line budget, and how much formatting it prints.

`components/CardCopy.tsx` fits each region against the rendered card rather than by counting
characters: it measures the run at full size and, only if it does not fit, searches down to the
region's minimum scale. A single-line region is fitted to its width, a wrapped one to its line
budget, and a region printed inside a panel to the panel itself. So a title uses the whole width it
has before the type shrinks at all, and `max_length` is the point past which even the smallest
allowed size would not fit. Nothing scrolls and nothing is clipped away.

Printed regions take the same small description subset: `inline` regions print bold and italics,
`block` regions add `- ` bullets and line breaks, and titles are plain. Both go through the shared
parser in `packages/shared/src/markdown.ts` and render as React elements, so the card, the editor
proof and the baked asset agree and no markup reaches the DOM as HTML. The larger note panels are
written to hold a few useful lines rather than a single caption.

Printed copy is edited on the live proof rather than in detached fields, so the creator sees the
final composition while typing. The long-form description is separate metadata and appears below the
card in the inspector rather than on the face.

Every published card prints a small identifier below the bottom right of its image box, or at the
bottom right of the face on Full Art: a set code, then the card's position and the set's card total,
as in `CAM-01 12/36`. The set code is a three-character base the creator picks on the draft, plus a
two-character base-36 suffix the platform allocates at publication as the lowest that base has not
used, counting from `01` and reserving `00`. The pair is unique across every published set, and it
freezes with the card order and the card total, so a given card art always carries the same
identifier and no two arts in a set share one. It names the card, not an owned copy, and implies
nothing about supply.

### Card lighting

Every card carries the same physical treatment: a pale die-cut rim, a contact shadow over two
ambient steps, a print grain above the face, and a recessed image window.

The card carries no light of its own. It reads `--lit-angle`, `--lit-strength` and the two
`--lit-shift` offsets with fallbacks rather than declaring them, so whatever surrounds it supplies
the light: fixed scene lighting in the 3D inspector, binder lighting in a binder. `lib/lighting.ts`
resolves one key light into those variables per binder slot.

The light is directional rather than a flat wash. The coat is a gradient more than twice the size of
the card, positioned by the shift offsets, so where the card sits relative to the key light decides
which part of the coat it is seen through; a small ambient term underneath keeps the far corner from
going dead. A grazing highlight along the lit edge in the stock's own shadow stack does most of the
work of telling matte from gloss, and an offset copy of the surface texture gives an uncoated stock
the tooth a raking light would find. The coat blends through soft light on paper coats and overlay
on the hard ones, because a gloss or metal coat has to be able to reach white and soft light cannot.
Spot bands ride the same offsets, which is why they travel with the card in a binder and with the
slab's rotation in the inspector. Nothing about a card's material animates on its own.

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
and pack size. Draft identity can change while the creator is editing. Publishing freezes the complete
set identity and pack/binder appearance together with its card definitions.

`components/CardBack.tsx` gives every card in a set a shared back using the set mark, foil color,
gold linework, and a repeating background motif.

## Trading and profiles

Trade construction presents both collectors' cards as two grouped sheets and keeps the proposed
exchange visible in a pinned deal bar. Duplicate copies are grouped into a single selectable pile,
and cards held by another pending offer remain visible but unavailable.

`components/ProfileBinder.tsx` gives every collector a personal binder at the top of their
profile: ten pages of four sleeves holding up to 40 cards they own and chose to display, publicly
visible. Empty sleeves stay visible as space to fill, and become the pick targets when the owner
is editing. The same component serves the public profile and the account editor.

Binder covers are chosen, not themed. `BINDER_COLOURS` is a curated shelf of twelve bound covers,
mirrored between `apps/api/cards/identity.py` and `apps/web/lib/setIdentity.ts`. The cloth is one
photograph recoloured by rotating its hue, so a cover costs no new artwork and the cream pages,
rings and sleeves stay put underneath. A collector can change their profile binder cover. A creator
chooses the cover for a set's public binder before publishing, when it becomes frozen with the rest
of the set.

## Motion

- Pack opening begins with a pointer or keyboard-operated foil tear.
- Releasing after the tear threshold completes the rip; an earlier release returns the wrapper.
- Cards flip into the reveal area one at a time.
- Rare pulls receive a burst, while legendary pulls receive a gold bloom and ring.
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
