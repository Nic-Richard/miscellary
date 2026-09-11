# API surface

Base path: `/api/v1`. All bodies are JSON. Errors are `{ "error": string, "fields"?: {...} }`.
Interactive docs: `/api/v1/docs/` (OpenAPI at `/api/v1/schema/`).

| Method | Path                            | Auth                 | Notes                                                                        |
| ------ | ------------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| GET    | `/health/`                      | –                    | DB round-trip                                                                |
| POST   | `/auth/register/`               | –                    | `{email, username, password}` → 201 `{user, access}` (+ cookie or `refresh`) |
| POST   | `/auth/login/`                  | –                    | `{email, password}` → `{user, access}`                                       |
| POST   | `/auth/refresh/`                | cookie / `{refresh}` | rotates; → `{access}` (+ cookie or `refresh`)                                |
| POST   | `/auth/logout/`                 | cookie / `{refresh}` | blacklists, clears cookie → 204                                              |
| GET    | `/auth/me/`                     | bearer               | current user + profile                                                       |
| PATCH  | `/auth/me/`                     | bearer               | `{display_name?, bio?, showcase_title?, binder_colour?}`                     |
| POST   | `/auth/password/change/`        | bearer               | `{current_password, new_password}` → 204                                     |
| POST   | `/auth/verify-email/request/`   | bearer               | resend verification → 204                                                    |
| POST   | `/auth/verify-email/confirm/`   | –                    | `{token}` → 204                                                              |
| POST   | `/auth/password-reset/request/` | –                    | `{email}` → 204 always                                                       |
| POST   | `/auth/password-reset/confirm/` | –                    | `{uid, token, password}` → 204                                               |

Send `X-Client-Platform: mobile` to receive refresh tokens in the body instead of a cookie.

## Uploads

| Method | Path                      | Notes                                                                                                                  |
| ------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| POST   | `/uploads/`               | `{kind: card\|cover\|avatar\|pack, content_type}` → 201 `{image, upload_url, max_size}`; PUT the bytes to `upload_url` |
| POST   | `/uploads/{id}/complete/` | `{width, height}` → image with `ready: true`                                                                           |

## Templates, sets, cards

| Method           | Path                             | Auth     | Notes                                                                                 |
| ---------------- | -------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| GET              | `/templates/`                    | –        | platform templates with their options                                                 |
| GET              | `/sets/`                         | –        | published sets, paginated (`?page=`)                                                  |
| GET              | `/sets/{slug}/`                  | optional | binder: set + cards. Drafts only for their creator                                    |
| GET              | `/me/sets/`                      | bearer   | my sets                                                                               |
| POST             | `/me/sets/`                      | bearer   | `{title, description?}` → 201 draft                                                   |
| GET/PATCH/DELETE | `/me/sets/{id}/`                 | bearer   | PATCH drafts only; DELETE hard-deletes drafts and soft-deletes published sets         |
| GET              | `/me/sets/{id}/publish/`         | bearer   | `{problems: []}`, showing what blocks publishing                                      |
| POST             | `/me/sets/{id}/publish/`         | bearer   | publish; 400 `{error, problems}` if blocked                                           |
| POST             | `/me/sets/{id}/cards/`           | bearer   | `{image_id, title, rarity, description, printed_text, template_key, template_config}` |
| PATCH/DELETE     | `/me/sets/{id}/cards/{card_id}/` | bearer   | draft only                                                                            |

Each template option is `{label, values, default, type, group, unlocks?}`. `type` is how the value
is picked (`choice`, `swatch`, `font`), `group` is the editor section it belongs to (`board`,
`print`, `type`, `press`), and `unlocks` maps individual values to the rarity that opens them.
Clients render the option set they are given; the API is the only place the catalogue is defined.
Production work that is not a decision is not an option: relief, cut-edge colour and spot work are
applied by the renderer from the card's rarity and its own coat, and never appear in the catalogue
or in a stored config.

Each template also carries `text`: a `printed_label` naming its printed region, plus `title` and
`printed` rules of `{max_length, min_scale, lines, markup}`. A region is fitted against the rendered
card and shrinks no further than `min_scale`, and `max_length` is the point past which even that
would not fit, so it is a hard cutoff rather than where overflow starts. `markup` is `none`,
`inline` (bold and italics) or `block` (those plus `- ` bullets and line breaks), and the same
description subset is validated on `printed_text` as on `description`. `printed` is `null` on
templates with no separate printed region.

A set carries a `set_code`: exactly three uppercase letters or digits chosen by the creator, which
they can PATCH on a draft and `suggested_set_code` derives from the title. Publishing fills a blank
code in from the title and appends a two-character base-36 suffix, allocated as the lowest one that
code has not used, from `01` up to `ZZ`; `00` is reserved. `printed_set_code` is the base on its own
while the set is a draft, because no suffix is reserved until publication, and the frozen pair such
as `CAM-01` afterwards. Published cards expose
`printed_set_code` and `set_total` alongside `position`; all three freeze together, so a card's
printed identifier is the same on every copy and unique within its set. It is not a serial number
for an owned copy.

Published sets and cards are frozen at the model layer. Set content, identity, pack and binder
appearance, card definitions, and template snapshots cannot change after publication. Creator
deletion and platform removal remain lifecycle operations. Pack artwork must be uploaded with
`kind: pack` before its image ID can be used in `pack_layers`.

Published cards include a `render` presentation cache with a signature, renderer version, status,
300 by 420 thumbnail, 1000 by 1400 front, `spot`, a mask pair, and set back. `spot` is
`{material, area}` for a card produced with spot work and `null` for one printed plain, and the mask
pair is present only for the former, because that is what confines the material to its region.
Published sets also include `render_back`. Drafts return `null`. Missing or stale assets report
`pending`; publishing does not wait for browser rendering.

## Packs and collection

| Method | Path                       | Notes                                                                                                                                                                    |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/sets/{slug}/packs/`      | `{free_available, points, pack_cost, pack_size, recycle_values, resets_at}`                                                                                              |
| POST   | `/sets/{slug}/packs/open/` | `{use_points?: bool}` → 201 opening with `cards[]` (each has `copies`) and refreshed `status`; 400 with a plain `error` if today's free pack is used or points are short |
| GET    | `/me/cards/?set=slug`      | owned cards, paginated, with `copies` and set slug, title, mark, and pack colour                                                                                         |
| POST   | `/me/cards/{id}/recycle/`  | duplicates only → `{points, earned, set_slug}`                                                                                                                           |
| GET    | `/me/points/`              | non-zero set point balances                                                                                                                                              |

One free pack per user per set per UTC day is a database constraint, so concurrent requests can't
double-open. Points balances are locked with `SELECT … FOR UPDATE` while spending or recycling.

## Trading

| Method | Path                                     | Notes                                                                             |
| ------ | ---------------------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/me/trades/?box=inbox\|outbox\|history` | pending offers to me / from me, or closed ones                                    |
| POST   | `/me/trades/`                            | `{recipient, give: [owned ids], want: [owned ids], message?}` → 201               |
| GET    | `/me/trades/{id}/`                       | only sender or recipient can see it                                               |
| POST   | `/me/trades/{id}/accept/`                | recipient only; swaps owners atomically                                           |
| POST   | `/me/trades/{id}/reject/`                | recipient only                                                                    |
| POST   | `/me/trades/{id}/cancel/`                | sender only                                                                       |
| POST   | `/me/trades/{id}/counter/`               | recipient only; closes this offer as `countered` and creates a new one back → 201 |

Offers are immutable. A card in a pending offer is held: it can't be recycled or put in another
offer. Accepting locks the offer row and every card row, re-checks ownership, then swaps; if a card
moved in the meantime the offer is cancelled instead.

## Social

| Method      | Path                                          | Auth     | Notes                                                                                                                      |
| ----------- | --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET         | `/users/{username}/`                          | optional | profile: counts, `showcase_title`, `is_following`, `is_me`, showcase, published sets                                       |
| POST/DELETE | `/users/{username}/follow/`                   | bearer   | → `{following, follower_count}`                                                                                            |
| GET         | `/users/{username}/followers/`, `/following/` | –        | up to 200 people                                                                                                           |
| GET/PUT     | `/me/showcase/`                               | bearer   | PUT `{slots: [{position, owned_card_id}]}` replaces up to 40; positions are 1 through 40 and only owned cards are accepted |
| POST/DELETE | `/sets/{slug}/like/`, `/cards/{id}/like/`     | bearer   | → `{liked, like_count}`                                                                                                    |
| GET/POST    | `/sets/{slug}/comments/`                      | optional | GET `{count, results}`; authenticated POST `{body, parent_id?}` creates a comment or reply                                 |
| DELETE      | `/comments/{id}/`                             | bearer   | author or set creator; comments with replies remain as tombstones                                                          |
| POST        | `/reports/`                                   | bearer   | exactly one of `set_slug`, `card_id`, `comment_id`, `username` + `reason` + `details?`                                     |
| GET         | `/search/?q=`                                 | –        | `{users, sets, cards}`; Postgres full-text for sets/cards, name match for people                                           |

Platform removal of a set (admin action) wipes every distributed copy and cancels pending trades
that included them. A creator's own delete keeps collectors' copies.
