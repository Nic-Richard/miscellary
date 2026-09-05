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
| PATCH  | `/auth/me/`                     | bearer               | `{display_name?, bio?, showcase_title?}`                                     |
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

| Method           | Path                             | Auth     | Notes                                                                                               |
| ---------------- | -------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| GET              | `/templates/`                    | –        | platform templates with their options                                                               |
| GET              | `/sets/`                         | –        | published sets, paginated (`?page=`)                                                                |
| GET              | `/sets/{slug}/`                  | optional | binder: set + cards. Drafts only for their creator                                                  |
| GET              | `/me/sets/`                      | bearer   | my sets                                                                                             |
| POST             | `/me/sets/`                      | bearer   | `{title, description?}` → 201 draft                                                                 |
| GET/PATCH/DELETE | `/me/sets/{id}/`                 | bearer   | PATCH draft fields or published identity fields; DELETE hard-deletes drafts, soft-deletes published |
| GET              | `/me/sets/{id}/publish/`         | bearer   | `{problems: []}`, showing what blocks publishing                                                    |
| POST             | `/me/sets/{id}/publish/`         | bearer   | publish; 400 `{error, problems}` if blocked                                                         |
| POST             | `/me/sets/{id}/cards/`           | bearer   | `{image_id, title, rarity, description, template_key, template_config}`                             |
| PATCH/DELETE     | `/me/sets/{id}/cards/{card_id}/` | bearer   | draft only                                                                                          |

Published cards are frozen at the model layer (`CardDefinition.save()` refuses changes to
image, title, rarity, description, and the template snapshot).

Set identity remains editable after publishing. Identity fields are `mark`, `pack_colour`,
`pack_finish`, `pack_layers`, `emblem_layout`, `emblem_shape`, `emblem_style`, `emblem_text`,
`emblem_type_scale`, `mark_scale`, `pack_subtitle`, `pack_text`, and `pack_size`. Other set fields,
including the cover, remain draft-only. Pack artwork must be uploaded with `kind: pack` before its
image ID can be used in `pack_layers`.

## Packs and collection

| Method | Path                       | Notes                                                                                                                                                                    |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/sets/{slug}/packs/`      | `{free_available, points, pack_cost, pack_size, recycle_values, resets_at}`                                                                                              |
| POST   | `/sets/{slug}/packs/open/` | `{use_points?: bool}` → 201 opening with `cards[]` (each has `copies`) and refreshed `status`; 400 with a plain `error` if today's free pack is used or points are short |
| GET    | `/me/cards/?set=slug`      | owned cards, paginated, `copies` per card                                                                                                                                |
| POST   | `/me/cards/{id}/recycle/`  | duplicates only → `{points, set_slug}`                                                                                                                                   |
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

| Method      | Path                                          | Auth     | Notes                                                                                        |
| ----------- | --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| GET         | `/users/{username}/`                          | optional | profile: counts, `showcase_title`, `is_following`, `is_me`, showcase, published sets         |
| POST/DELETE | `/users/{username}/follow/`                   | bearer   | → `{following, follower_count}`                                                              |
| GET         | `/users/{username}/followers/`, `/following/` | –        | up to 200 people                                                                             |
| GET/PUT     | `/me/showcase/`                               | bearer   | PUT `{slots: [{position, owned_card_id}]}` replaces up to six; only owned cards are accepted |
| POST/DELETE | `/sets/{slug}/like/`, `/cards/{id}/like/`     | bearer   | → `{liked, like_count}`                                                                      |
| GET/POST    | `/sets/{slug}/comments/`                      | optional | GET `{count, results}`; authenticated POST `{body, parent_id?}` creates a comment or reply   |
| DELETE      | `/comments/{id}/`                             | bearer   | author or set creator; comments with replies remain as tombstones                            |
| POST        | `/reports/`                                   | bearer   | exactly one of `set_slug`, `card_id`, `comment_id`, `username` + `reason` + `details?`       |
| GET         | `/search/?q=`                                 | –        | `{users, sets, cards}`; Postgres full-text for sets/cards, name match for people             |

Platform removal of a set (admin action) wipes every distributed copy and cancels pending trades
that included them. A creator's own delete keeps collectors' copies.
