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
- Published card definitions are immutable, including their image, text, rarity, and template
  snapshot.
- Set identity settings can remain editable after publication without changing published card
  definitions.
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

Sets also define their cover, mark, pack colors and finish, pack artwork layers, badge, free text,
and pack size. These settings give each set a recognizable identity across its binder, card backs,
and packs.

## Rarity and packs

Miscellary uses five rarity tiers:

- Common
- Uncommon
- Rare
- Epic
- Legendary

Rarity affects pull odds and visual treatment but does not represent a finite supply or monetary
value. Rarity is also a design capability: it widens the catalogue a creator may pick from
rather than dictating how a card looks. Common and uncommon have the full ordinary catalogue of
layout, stock, colour, typography, imagery, framing and surface, so a common can be as
well-designed as anything else. Higher tiers additionally unlock specialty production treatments -
pearlescent and metallic finishes and a brushed surface at rare, the Full Art template at epic -
and none of them are compulsory. Relief and cut edge are not creator choices: they are small
enough that the renderer applies whatever suits the tier. Legendary is the one tier with a required choice: it must carry a chase treatment,
picked by the creator, on an axis separate from its ordinary finish.

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

Profiles include identity, biography, created sets, collection counts, follows, and a six-card
showcase with a custom title. Public discovery includes people, sets, and cards. Users can follow
profiles, like sets and cards, comment on sets, and report public content or behavior.

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
