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
display size. Cards use a 5:7 trading-card ratio and combine a header, photo, description, set
mark, dimensional stock, and a recessed image window. The card face carries no rarity label.

The available templates are:

- Classic: framed photo on a configurable card stock
- Polaroid: open photo with a wide caption margin, on pale stock
- Full Art: full-bleed photo with text on scrims (Epic and above)
- Bold: strong border, large title, and configurable image shape
- Field Note: pale note stock with a ruled description panel
- Dossier: deep stock with the same rulings printed on a dark panel

Field Note and Dossier share one layout and one set of panel rulings; what separates them is the
stock family each is limited to and the register the rulings print in.

### Card options

A card is four decisions, and each option declares which one it belongs to. The `group` an option
carries is what the editor sections itself by, so adding a server option places itself.

| Group        | Decides                          | Options                                                       |
| ------------ | -------------------------------- | ------------------------------------------------------------- |
| Board        | What it is printed on and cut to | stock, surface, corner cut                                    |
| Print        | How the photo is reproduced      | photo treatment, photo window, and the template's own control |
| Type and ink | The face and the colour          | typeface, accent or border ink                                |
| Press        | What happens after printing      | coat, relief, chase, chase coverage                           |

Photo treatment reaches every template, because the picture is most of a card and gating it would
leave a Common card with little to decide. It is applied as one reproduction curve on the image
rather than an overlay, so it replaces the standard press curve instead of stacking on it. The
photo window - rule, bare, mount, or sunk - is offered wherever a template mounts the photo on
visible board.

Every card is printed to the same standard; rarity never lowers material quality. A card's coat
is whatever its creator chose - matte, satin, gloss, pearl or metallic - and grain and sheen are
properties of that coat, so a matte card shows more tooth than a gloss one at any rarity.

Rarity gates specialty production, not design freedom, and every tier below Legendary opens
something: Uncommon spot varnish, Rare pearl and metallic coats, the brushed surface and struck
relief, Epic the Full Art template, Legendary the foil and holo chase. Cut-edge colour still
follows the tier rather than a control, since it is too small to be worth choosing. A locked value
stays visible in its control, hatched and tagged with the tier that opens it, so the ladder is
legible from Common rather than only from the top.

The chase is a separate axis layered over the chosen coat, so a foiled legendary can still be
matte linen underneath. Each treatment is two sibling layers, a field and a specular band, kept as
siblings because a blended layer that owns a stacking context would make its children blend
against that instead of against the card. Coverage decides where they mount: over the picture, in
a struck band round the rim, or across the whole face. Foil struck on bare board is opaque metal;
over a photo it keys off the backdrop so the picture survives. Holo carries its spectrum in the
band rather than painted flat, because a static full-surface lattice reads as tartan and buries
the artwork. Snapshots saved before the finish and relief options existed fall back to a per-rarity
coat and rim, which is why the `:not([data-finish])` and `:not([data-relief])` rules exist.

The exact rarity is not printed on the card face.

### Card lighting

Every card carries the same physical treatment: a pale die-cut rim, a contact shadow over two
ambient steps, a print grain above the face, and a recessed image window.

The card carries no light of its own. It reads `--lit-angle` and `--lit-strength` with fallbacks
rather than declaring them, so whatever surrounds it supplies the light: fixed scene lighting in
the 3D inspector, binder lighting in a binder. Coats, chase bands, and spot varnish all key off
those two properties, and nothing about the card's material animates on its own.

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

`components/ProfileBinder.tsx` gives every collector a personal binder at the top of their
profile: one page of eight sleeves holding cards they own and chose to display, publicly visible.
Empty sleeves stay visible as space to fill, and become the pick targets when the owner is
editing. The same component serves the public profile and the account editor.

Binder covers are chosen, not themed. `BINDER_COLOURS` is a curated shelf of twelve bound covers,
mirrored between `apps/api/cards/identity.py` and `apps/web/lib/setIdentity.ts`. The cloth is one
photograph recoloured by rotating its hue, so a cover costs no new artwork and the cream pages,
rings and sleeves stay put underneath. A collector picks the cover of their profile binder; a
creator picks the cover their set's public binder is bound in, and because it is set identity
rather than card data it stays editable after publishing.

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
