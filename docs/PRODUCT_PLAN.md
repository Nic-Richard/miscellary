# Miscellary product rules

This document describes the product principles and behavior that define Miscellary.

## Product vision

Miscellary is a creative collection platform where people turn subjects they care about into
custom trading-card sets. A set can catalogue plants, rocks, records, cars, insects, sneakers,
toys, souvenirs, or any other collection.

The product is built around creativity, collecting, discovery, pack openings, and social
trading. It is not a financial marketplace and does not create artificial digital scarcity.

## Product principles

- The public catalogue should be enjoyable to browse without requiring an account.
- Creating, collecting, opening packs, trading, sharing, and discovery are core features.
- Cosmetic or convenience features must not make the free collecting loop feel incomplete.
- Card text and images remain under the creator's control.
- Product mechanics and copy must avoid investment, token, wallet, and speculative language.
- Technical complexity must serve a concrete product or operational need.

## Sets and cards

- Creators build sets as private drafts and publish them when ready.
- A published set has a public binder containing its card definitions.
- Published sets are immutable, including their identity, pack and binder appearance, card images,
  text, rarities, and template snapshots.
- Creators collect cards from their own sets under the same rules as everyone else.
- A creator does not automatically receive owned copies of published cards.

`CardDefinition` is the source card within a set. `OwnedCard` is an individual collectible copy
created by a pack opening or received through a trade. Inventory, recycling, and trading operate
on owned copies.

### Card content and presentation

Each card has an image, title, rarity, description, template key, template version, and template
configuration. Descriptions support a small Markdown subset: bold, italics, bullet points, and
line breaks.

Templates provide framing, typography, image masks, stock textures, color controls, and rarity
treatments. Template settings are saved as a snapshot so a published card keeps the appearance
its creator approved.

The choices a creator makes are the ones that change the card: borders, colours, textures, the image
window, the material finish, and the foil. Relief is not among them. The image window and the
description panel are recessed on every card and the rim is struck from rare up, both as optical
shading the renderer applies rather than a control. Spot work is a choice: a card carries it only
where its creator asked for foil or holo, and a card without one has none whatever its tier or its
coat. A description or note panel stays plain apart from that relief and the card's own material,
with no ruled, gridded or patterned paper to choose between.

Sets also define their cover, mark, pack colors and finish, pack artwork layers, badge, free text,
and pack size. These settings give each set a recognizable identity across its binder, card backs,
and packs.

### Printed card copy and detail descriptions

Text printed on the physical card is separate from the longer description shown with it. Printed text
belongs to the template geometry and must fit the space available; the longer description is metadata
shown below the card in inspection/detail views.

- Printed titles, captions, subtitles, and description boxes have template-specific space constraints.
- The editor shows printed copy directly against the live card while it is being written.
- Text is fitted against the rendered card rather than by counting characters, so a region uses the
  whole width or line budget it has before the type shrinks. Every region also has a hard limit
  chosen so it is genuinely full at the smallest allowed size. The renderer must not solve overflow
  by making text unreadably small, by scrolling a printed region, or by clipping it.
- Larger printed regions carry a few useful lines rather than one caption, and take the same small
  formatting subset the description does: bold, italics and bullet points where the template has room
  for them. Printed copy stays grounded in the subject rather than narrating what a photo may not show.
- The longer card description is separate metadata and is not forced onto the printed face.
- Published cards carry a small printed identifier below the bottom-right of the image box, or at the
  bottom right of the face on Full Art. It combines the set code with the card definition's position
  and the set's card total, for example `CAM-01 12/36`. It is not a serial number for an owned copy
  and must not imply finite supply.
- A set code is a three-character base the creator chooses, and a two-character suffix the platform
  assigns at publication as the next one free for that base. The pair is unique across every published
  set, and it freezes with the card order and the published card count, so one card art always carries
  the same identifier and no two arts in a set share one.

The final editor option catalogue should be reviewed as one coherent system. Options should represent
meaningful design or production decisions, rarity should continue to gate specialty production rather
than ordinary creative quality, and automatic technical choices should not be exposed merely because
the renderer can vary them.

## Rarity and packs

Miscellary uses five rarity tiers:

- Common
- Uncommon
- Rare
- Epic
- Legendary

Rarity affects pull odds and the catalogue a creator may pick from, but does not represent a finite
supply or monetary value. It never applies a treatment on its own: a tier opens options, and the
creator decides whether to spend them. Rarity is also a design capability: it widens the catalogue a creator may pick from
rather than dictating how a card looks. Common and uncommon have the full ordinary catalogue of
layout, stock, colour, typography, imagery, framing and surface, so a common can be as
well-designed as anything else. Higher tiers additionally unlock specialty production treatments -
pearlescent and metallic finishes and a brushed surface at rare, the Full Art template and foil at
epic, holo and the rainbow pattern at legendary -
and none of them are compulsory. Relief and cut edge are not creator choices: they are small enough
that the renderer applies whatever suits the tier. No tier is required to carry a foil, and foil sits
on an axis separate from a card's ordinary finish.

Gating applies only when a card is saved. A published card renders from its stored snapshot and is
never re-validated, so changing the unlock rules later cannot alter a card a collector already
owns. Publishing enforces a balanced rarity distribution so a set remains suitable for packs.
The current caps, pull odds, and recycle values live in the shared and API rarity modules and must
stay synchronized.

Each user receives one free pack per published set per UTC day. Creators choose a pack size from
one to ten cards. Pack openings create owned copies and use an interactive reveal sequence.

Duplicate cards can be recycled for points associated with their source set. Those points buy
additional packs from the same set. Set-specific balances prevent activity in one collection from
funding packs in another.

Pack opening, point spending, and recycling use database transactions and row-level safeguards.
The daily free-pack rule is also enforced by a database constraint.

## Trading

- A trade offer can include multiple owned cards from each participant.
- The recipient can accept, reject, or counter an offer.
- A counter closes the original offer and creates a new offer in the opposite direction.
- Offers are immutable after creation.
- Cards in pending offers are held and cannot be recycled or offered elsewhere.
- Acceptance locks the offer and card rows, verifies ownership, and swaps the cards atomically.
- The platform does not assign monetary prices or exchange rates to cards.

## Profiles and social features

Profiles include identity, biography, created sets, collection counts, follows, and a public personal
binder with up to 40 owned cards chosen by the collector. Public discovery includes people, sets, and
cards. Users can follow profiles, like sets and cards, comment on sets, and report public content or
behavior.

Comments support replies. Authors and set creators can remove comments, while comments with
replies remain as tombstones so conversations retain their structure.

## Deletion and moderation

- Deleting a draft removes it permanently.
- A creator deleting a published set removes it from discovery and disables new packs.
- Owned copies from a creator-deleted set remain archived in collectors' inventories.
- Administrative removal for a serious policy violation removes distributed copies and cancels
  affected pending trades.
- Public sets, cards, comments, and profiles support reporting.
- Uploaders are responsible for having the right to use submitted text and images.

## Bootstrap and demo accounts

Production bootstrap content may use synthetic creators to make discovery and collecting useful on day
one, but those accounts must be visibly identified as demo accounts, such as with a small robot icon
and accessible "Demo account" label beside their name. Their profiles and activity can be realistic,
but the product must not present them as real people.

Bootstrap sets should use grounded subjects, deliberate licensed or public-domain imagery, natural
titles and descriptions, coherent editor choices, varied pack sizes and rarities, and enough cards to
feel like real collections. Source/license metadata belongs in internal seed records or an appropriate
attribution surface, not in card copy. Seeded likes, follows, collections, trades, and occasional comments
may make the product feel active, but activity should be varied and restrained rather than uniformly
distributed.

## Architecture

Miscellary is a monorepo with separate web, mobile, API, shared-code, and configuration packages.

- `apps/web`: Next.js and TypeScript
- `apps/mobile`: React Native, Expo, and TypeScript
- `apps/api`: Django and Django REST Framework
- `packages/shared`: shared TypeScript types, constants, and validation fixtures
- `packages/config`: shared TypeScript and ESLint configuration

PostgreSQL is the primary database. Web and mobile clients use the same REST API. Django owns
authentication through SimpleJWT. Access tokens are short-lived; refresh tokens rotate and are
blacklisted after use. The web transport uses an HttpOnly refresh cookie, while mobile stores the
refresh token in SecureStore.

Clients upload images directly to S3-compatible storage through presigned URLs. MinIO provides
the local S3-compatible service. Background infrastructure should only be added when a concrete
job requires it.

Production uses Vercel for the web client and AWS App Runner, RDS PostgreSQL, S3, and SES for the
API and supporting services.

## Validation

- pytest covers API behavior, transactions, and concurrency-sensitive operations.
- Vitest covers shared and web TypeScript logic.
- Ruff, mypy, ESLint, Prettier, and TypeScript checks run in CI.
- CI builds the Next.js application and exports the Expo Android bundle.

Release-specific operational checks live in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md).
