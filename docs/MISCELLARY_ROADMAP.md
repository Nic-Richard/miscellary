# Miscellary Product / UI Roadmap

This document is the source of truth for remaining Miscellary product, UI, mobile, launch, and polish work.

The repository on `main` is the implementation source of truth. This roadmap tracks what is complete, what still needs follow-up, and what remains before launch.

Status:

- **Complete**: implemented in the current web product; only normal QA/polish may remain.
- **In progress**: substantial work is done, but known product work remains.
- **Not started / remaining**: still needs dedicated implementation work.

Items are ordered roughly by current priority. The order can change as dependencies or product decisions become clearer.

## 1. Card editor overhaul: In progress

The main editor overhaul is implemented and the current renderer, material system, and mobile-adapted
shared editor are established. The remaining work is a final product pass rather than another broad
visual rewrite. It should follow the launch-content build so creating many realistic sets can expose
which controls, text limits, and template decisions still feel awkward in normal use.

### Completed

- Reorganized the editor around more intentional card-design controls.
- Expanded stocks, photo treatments, borders, inks, surfaces, and material choices.
- Added peach, lavender, sage, lilac, cocoa, and aubergine stock colors.
- Corrected stock swatches to match the rendered board colors.
- Exposed **Window shape** as visual choices on all five framed templates, including Polaroid.
- Added copper, ochre, silver, and sage inks.
- Extended border ink and four curated thickness choices to all framed templates, with a template-default option.
- Grouped border controls with the board and displayed thickness choices as visual samples.
- Fixed stock and rarity edges overriding selected border ink, including on existing seeded cards.
- Kept Full Art edge-to-edge, light stocks on Polaroid/Field Note, and dark stocks on Dossier.
- Kept ordinary creative freedom available across rarities while reserving specialty production treatments for higher tiers.
- Removed the printed rarity badge, baked-in top-left shine, and automatic travelling foil/holo animation.
- Moved card lighting responsibility to the surrounding scene.
- Kept published snapshots frozen and verified the shared editor/renderer across web and mobile surfaces.
- Made printed card copy part of the physical layout. Each template owns its usable text regions and
  enforces limits measured against the rendered card.
- Moved printed-copy editing onto the live proof, so the creator types into the card itself.
- Fitted printed text against the rendered card rather than by character count, so a title uses the
  whole width of its region before the type shrinks, and stops at a hard limit rather than overflowing.
- Gave captions, subtitles, and printed description boxes line and length budgets from their template
  geometry. Printed regions wrap inside that budget instead of scrolling or clipping.
- Opened the printed note panels to bold, italics and bullets through the shared description parser,
  and rewrote the seeded printed copy to carry a few grounded facts instead of a single caption.
- Separated the long-form description from printed copy and moved it below the card in the inspector.
- Added the small printed set/card identifier, such as `CAM-01 12/36`, below the bottom-right of the
  image box and at the bottom right of a Full Art face. It names the card definition, not an owned copy.
- Made the three-character set code creator-editable on a draft with a title-derived suggestion, and
  had publication allocate the next free two-character suffix under a unique constraint. The code, the
  card order and the published card count all freeze at publication.
- Removed the large printed card number the identifier replaces.
- Narrowed the desktop editor's control column so the live proof has room to be edited directly.
- Fixed the Full Art full-face scrim, which the photo had been covering, so titles and the printed
  identifier stay legible on bright images.
- Made relief automatic rather than a control. The image window and the description panel are
  recessed on every card, spot work belongs to uncommon and above and the struck rim to rare and
  above, and none of it reaches the option catalogue or a stored config.
- Widened spot work from varnish alone to varnish, pearl, foil and holo, resolved from the card's own
  coat and chase, and made a spot treatment read as a treatment applied to a region rather than a
  weaker version of the full-surface one.
- Rebuilt the lighting pass around a directional key light: an oversized coat gradient positioned by
  the light, a grazing edge highlight, an offset tooth pass on the stock texture, and per-coat
  blending, so matte, satin, gloss, pearl, foil and holo separate at a glance.
- Removed the description-panel paper choices, so a note box is plain apart from its relief and the
  card's own material.
- Returned people to what they were doing after signing in, through one internal-only return and
  continuation mechanism rather than a redirect per feature.

### Remaining editor finalization

- Audit the editor option catalogue as one system before making more piecemeal changes. Confirm which
  controls belong on each template, which are automatic production decisions, how rarity unlocks are
  communicated, and whether any current options are redundant or contradictory.
- Use the realistic launch sets as the editor stress test. The goal is coherent sets with intentional
  variation, not maximum option usage on every card.

Responsive, cross-browser, accessibility, and real-device QA still belong to the later QA passes.

## 2. Binder lighting and card presentation: Complete

Binder views now provide the environmental lighting for cards rather than relying on baked card shine or canned chase animations.

Completed:

- Added shared stationary binder lighting.
- Let pearl, metallic, foil, holo, clear coat, sleeves, and other card materials react to the same scene.
- Kept Common cards readable as printed objects rather than glossy UI tiles.
- Connected the binder material language more closely to the 3D inspector.

Remaining work belongs under final responsive, browser, performance, and real-device QA rather than this feature.

## 3. Homepage redesign: Complete

The homepage was redesigned around the actual Miscellary product rather than generic marketing panels.

Completed:

- Re-established the tactile Miscellary visual identity.
- Centered real cards, packs, binders, and seeded product content.
- Improved hierarchy and product communication.
- Kept the physical-product language of print, paper, leather, packs, and cards.

Remaining responsive and mobile QA is tracked later in the roadmap.

## 4. Personal profile binder and set binder customization: Complete

The old Showcase concept was replaced with a user's public binder.

Completed:

- Added a public personal binder for favorite owned cards.
- Added binder cover/leather color customization for profiles.
- Added binder color customization for sets.
- Preserved card inspection from binder contexts.
- Fixed incomplete profile binders caused by paginated owned-card lookup.
- Allowed cards in a full profile binder to be replaced.
- Expanded profile binders to ten pages with 40 editable sleeves.

Any future binder-material expansion is optional polish, not required core work.

## 5. Binder page-turn interaction: Complete

A quick physical page-turn animation is implemented.

Completed:

- Added a restrained page-flip illusion.
- Kept navigation responsive rather than turning it into a full book simulation.
- Added reduced-motion handling for the page turn.

Touch and narrow-viewport behavior still need final real-device/responsive QA.

## 6. Background and panel material pass: Complete

The old repeated texture treatment was replaced with a clearer material hierarchy.

Completed:

- Reworked the main background and panels into distinct desk, board, paper, cloth, and card-like surfaces.
- Reduced the feeling that unrelated surfaces are made from the same texture.
- Kept the materials visually related without flattening them into one repeated noise treatment.

Further changes should be driven by specific visual problems rather than another broad material rewrite.

## 7. Mark / emblem cleanup: Complete

The built-in set marks received a geometry cleanup.

Completed:

- Fixed alignment and join problems across the mark set.
- Corrected known issues such as the key geometry.
- Improved consistency at normal and small display sizes.

Only revisit individual marks if a concrete rendering problem appears.

## 8. Pack tear interaction: Complete

The pack tear was reworked to feel less rigid and more physical.

Completed:

- Added flexible pull deformation.
- Added a more natural tear edge.
- Added visible inner foil.
- Preserved the existing physical pack material direction.

Final touch behavior and performance still need real-device QA.

## 9. Android / React Native product build-out and shared rendering: In progress

Android remains a native application, but duplicate native visual renderers are no longer the goal.
Native code owns navigation, authentication, camera and gallery access, uploads, and platform
integration. The canonical web renderer supplies the inspector, binder, pack opening, and editors
through mobile-adapted WebView surfaces. Superseded native visual renderers have been removed so
these surfaces do not drift into parallel products.

Published cards use baked presentation assets instead of reconstructing their static layers in each
context. Each frozen card definition can reference a thumbnail, a detailed front, a shared set back,
and optional material masks. The original definition and source image remain authoritative and allow
regeneration when the renderer version changes. Drafts continue to render live.

The detailed implementation plan is [MOBILE_BUILDOUT_PLAN.md](MOBILE_BUILDOUT_PLAN.md).

### Completed foundation

- Current cream/teal app shell, bundled typography, navigation icons, status bar, and shared controls.
- Phone-sized Browse binder shelf with sorting, pagination, refresh, and loading/error/retry states.
- Wi-Fi API/media connectivity and documented Expo Go SDK 53 phone/emulator preview paths.
- Existing routes and five main destinations preserved.
- Shared WebView bridge for API calls, uploads, navigation, sizing, and locally bundled web surfaces.
- Shared binder, inspector, pack, and editor surfaces adapted for mobile layout and interaction.
- Baked published-card display with lightweight native material response for repeated card contexts.
- Render cache contract, renderer signatures, deterministic render-only modes, and local generation
  and import commands for new development data.
- Published set content and appearance locked at the model and API layers.

### Remaining shared-renderer work

- The seeded baked assets and mobile shared surfaces have been reviewed on a physical Android phone
  and accepted for this checkpoint.
- Measure grid load time, memory, and scrolling on a normal physical Android phone.
- Profile slow loading and interaction before deciding whether it comes from application code or the
  local Docker and Expo development workflow.
- Verify missing render assets, slow networks, image caching, reduced motion, and accessibility.
- Decide when automated production generation is needed. Publication remains independent from
  browser rendering.

### Product and device testing

- Verify auth refresh, SecureStore behavior, camera/gallery uploads, keyboard behavior, and Android
  back handling.
- Repeat the accepted binder, inspector, pack, and editor phone pass after any performance changes.

## 10. Production-quality seed / launch content: Complete

### Completed

- Eighteen curated demo sets in production, from 15 to 24 cards, with varied pack sizes, rarity
  orders, colour, creators and pack designs.
- Demo accounts carry a Demo badge with an accessible label on web and mobile.
- Seeded demo activity follows real pull odds, with uneven likes, follows, comments and binders.
- Production bootstraps from the reviewed photos staged by hash, never from a fresh download.
- `pnpm reseed --set <slug>` rebuilds one set in development.

More sets can follow the standards below; the catalogue is no longer a launch blocker.

### Demo-account transparency

- Production bootstrap creators may be synthetic, but they must be clearly identified as demo accounts.
- Show a small robot icon or similarly compact **Demo** indicator beside their name wherever account
  identity is presented. Provide an accessible label such as "Demo account" rather than relying on the
  icon alone.
- Demo accounts can have realistic names, bios, interests, collections, and activity, but the product
  must never imply that they are real users.

### Set quality

- Start with roughly 50 believable public sets across a range of ordinary interests and collection
  types. Grounded examples include minerals, records, film cameras, birds, houseplants, sneakers,
  watches, guitars, game consoles, transit, and other subjects a real hobbyist might catalogue.
- Prefer larger, useful collections rather than tiny showcase demos. Roughly 20-40 cards is a good
  normal range, with smaller or larger sets when the subject justifies it.
- Give every set a natural title and description. Avoid whimsical naming for its own sake, polished
  marketing language, lore-like copy, and meta wording such as "this collection explores" or comments
  about how the set was generated.
- Make the editor choices intentional. Each set should have a recognizable visual direction while its
  cards still vary enough to feel collected rather than duplicated. Use the available templates,
  stocks, inks, image treatments, windows, finishes, and rarity treatments where they fit the subject,
  not merely to demonstrate features.
- Vary pack sizes, set sizes, rarity distributions, binder colors, pack identities, and creator style.
  Rarity should remain balanced enough for pack opening while not looking mechanically identical across
  every set.
- Use the launch-content build as a practical stress test for the editor. Record controls or template
  decisions that fight normal set creation and feed those findings into the editor-finalization pass.

### Photography and source records

- Every launch card image needs a deliberate open-source, public-domain, or otherwise appropriately
  licensed source with durable source and license metadata kept by the seed/bootstrap tooling.
- Choose images subject by subject rather than relying on broad search results or accepting weak matches.
- Preserve source URLs, author/photographer attribution, license information, and any required adaptation
  notes in seed metadata or other internal records.
- Do not print image-source URLs, license notes, crop notices, or other sourcing metadata on the card
  face or in the card's user-facing description. Attribution obligations should be satisfied in an
  appropriate product/legal/source surface without making the collectible itself read like seed data.
- Preserve the original image bytes where practical and let the renderer perform the intended crop.

### Social activity

- Seed follows and likes in varied amounts so discovery, profiles, and counters do not look empty.
- Comments are optional and should be used selectively rather than on every set. When present, keep them
  short, ordinary, and specific enough to sound like something a person would actually say.
- Vary activity levels. Some demo creators can be quiet while others collect, follow, like, trade, or
  comment more often. Avoid perfectly distributed engagement that makes the data look generated.
- Seed enough owned cards and trades for collection and social surfaces to feel alive without implying
  real-user activity.

### Persistence

Launch content uses a versioned manifest and the idempotent `bootstrap_catalogue` command. Existing
published rows are verified and never rewritten; a manifest mismatch aborts. Synthetic social activity
has a separate `refresh_demo_activity` lifecycle. None of these commands runs automatically on application startup.

## 11. Production deployment and live URL: In progress

`miscellary.com` and `api.miscellary.com` are live on Vercel and ECS, with the catalogue bootstrapped and
its renders served from the media CDN. Confirm the remaining items below before calling it launched.

### Deployment checklist

- Final production environment variables.
- Production PostgreSQL database.
- S3 media bucket and permissions.
- Django production deployment.
- Web deployment.
- Android production API configuration.
- Domain / DNS setup.
- HTTPS.
- Email / SES configuration.
- CORS / CSRF / cookie configuration.
- Production media URLs.
- Migrations.
- Initial production/bootstrap content.
- Health checks.
- Error logging.
- Backup strategy for database and media.
- Verify no local/demo credentials or defaults leak into production.

The deployed site should be tested from a clean browser session rather than assumed correct because local Docker works.

## 12. Smoothness, responsiveness, and performance pass: Remaining

After the main product/UI work settles, do a focused performance and interaction pass.

### Areas to inspect

- Route transitions.
- Binder page changes.
- Card inspector open/close.
- 3D rotation performance.
- Foil/holo/material rendering cost.
- Large collections and binders.
- Image loading and sizing.
- Pack opening.
- Studio preview updates.
- Search.
- Comments and social mutations.
- Trade flows.
- Mobile scrolling.
- Layout shifts.
- Slow network behavior.

### Goals

- Avoid unnecessary rerenders.
- Lazy-load expensive UI where appropriate.
- Keep card effects from causing excessive GPU work.
- Ensure images are appropriately sized and cached.
- Make controls respond immediately.
- Remove visual jank before adding more animation.
- Check reduced-motion behavior.
- Test at realistic mobile widths and on a real Android device.

Performance work should be based on observed slow interactions rather than theoretical micro-optimizations.

# Additional items worth keeping on the roadmap

These were not all in the initial messy list, but they should be tracked before launch.

## Card inspector completion

The initial 3D inspector is good enough for the first build, but still needs final product testing later:

- repeat real-device touch/performance checks after any renderer or loading changes
- reduced-motion test
- responsive/narrow viewport test
- bright Full Art title/scrim contrast
- confirm every intended card-display context can inspect
- confirm no interactive selection/editing context accidentally opens it
- revisit lighting after binder/environment lighting becomes the source of truth

## Responsive design audit

Do a deliberate pass across common breakpoints rather than fixing mobile issues one at a time.

Especially:

- homepage
- binder
- profile binder
- Studio
- trades
- collection
- search
- pack opening
- card inspector
- authentication/account pages

## Accessibility

Before launch:

- keyboard navigation
- visible focus states
- modal/dialog focus management
- reduced motion
- labels and accessible names
- touch target sizes
- contrast on bright/dark cards and Full Art scrims
- screen-reader behavior for card inspector front/back controls

## Empty, loading, and error states

The seeded environment hides many empty states.

Review:

- brand-new user
- no collection
- no created sets
- no trades
- no comments
- failed image upload
- unavailable media
- API/network failure
- expired auth
- empty search
- deleted/archived set

These should still feel like Miscellary, not generic fallback boxes.

## Image pipeline

Before real users upload content:

- validate image resizing/compression behavior
- verify EXIF/orientation handling
- confirm reasonable upload limits
- confirm oversized upload cleanup
- check transparent images
- test portrait/landscape/extreme aspect ratios
- ensure poor phone photos still print well on cards

## Social and account layer: Complete

The social layer was scoped around collecting, creators, sets, discovery and trades rather than
around a general social network.

Completed:

- Added set following as the only save concept, and built Packs on it: a feed of the sets a collector
  follows, the pack itself the hero of each post, with free-pack availability counted per set, the
  point balance and collection progress, free packs first. Packs open in place.
- Added discovery tags on sets and cards, editable by the creator after publication because they are
  not part of the frozen snapshot. Search returns tags and uses them to find the sets and cards
  carrying them, and a tag anywhere in the product runs that search.
- Added notifications for set likes, card likes, set comments, comment replies and new followers,
  written in the request that causes them. Nothing you do yourself notifies you, one unread row
  stands for one actor and target, and undoing an action withdraws its unread notification.
- Turned the account page into profile, binder and sign-in sections, with username, email
  verification and password management, and room for subscription management later.
- Allowed username changes on a 30-day cooldown, holding the vacated name in reserve for its owner
  until their next change replaces it.
- Gave followers and following real lists on profiles, using the endpoint that had none.
- Brought mobile to parity: set following, the packs tab, notifications, the account screen, tag
  display and editing, and the comment thread mobile had never had.
- Unified the secondary controls (follow, like, report) into one shape with one on state, and
  replaced the account page's binder tabs with a segmented control.
- Gave the emptier pages a composition rather than a stretched column: a centre column with the sets
  down one side and what you are holding down the other, held in `pageWide.module.css`. The homepage
  and a published set page run the full width beside the rail instead, because their content is
  large objects.
- Made looking for something one control across the product: a search box on browse that asks the
  catalogue, and the same box filtering in place on packs, my cards, the trade builder and the
  binder's sleeve picker.
- Paged the two lists that were capped: followers and following 50 a page, notifications 30, each
  with a control that says how many are still behind it.

Remaining: the narrow breakpoints on the rebuilt pages have not been checked on a real device, and
the responsive, accessibility and performance passes below still cover these surfaces.

## Moderation / abuse UX

Backend rules exist, but the public product should have complete UI flows for:

- reporting cards/sets/users/comments where supported
- blocked/removed content behavior
- creator deletion vs platform removal
- moderation-facing messaging that does not expose internal implementation

## Authentication / account UX: In progress

Done:

- Registration, verification, forgot/reset password, logout and username changes on web and mobile.
- Token refresh is single-flight on both clients, so parallel 401s no longer race the rotation.
- A failed verification email no longer fails signup; the account stands and can ask for a link.
- Changing or resetting a password signs out every other session.
- Publishing and trading (sending, countering, accepting) wait on a verified email, with a notice
  and resend link where those actions live.
- Account deletion: password-confirmed, on web and mobile. Published sets and comments stay under
  a deleted user; the collection, drafts, follows, likes, notifications and open trades go, and the
  username and email are released.

- Signing up lands on Packs, where a collector who follows nothing picks sets from a shelf of
  popular packs and follows them in place, on web and mobile.
- Account emails are sent as HTML alongside plain text.

Remaining:

- Production email delivery confirmed from the live site.
- Expired-session and mobile token behaviour checked on a real device.

## SEO / sharing

For the public web product:

- title/description metadata
- canonical URLs
- social/Open Graph cards for sets, cards and profiles
- favicon/app icons
- sitemap
- robots.txt
- a URL for every card, not only for its set
- a share control on sets, cards and profiles that behaves like the major social platforms: the
  native share sheet where there is one, copy link otherwise

## Interaction and control consistency

The product still has loose ends in how controls are laid out and ordered from page to page. Before
launch, audit the web and mobile surfaces and settle one pattern for:

- where primary, secondary and overflow actions sit on a set, card, profile and post
- what goes in an overflow menu (share, report, unfollow) versus on the surface
- button hierarchy and sizing, following the conventions people know from major social platforms
- repeated byline, header and empty-state compositions, drawn once and reused

## Browser support

Test current Chrome, Firefox, Safari, and mobile Chromium/Safari where practical.

The 3D inspector, masks, blend modes, backdrop filters, and advanced card materials deserve particular attention because they use newer rendering behavior.

## Production observability

Keep this lightweight, but before launch there should be a way to answer:

- Is the API healthy?
- Are requests failing?
- Are uploads failing?
- Are emails failing?
- Is the database healthy?
- Are there server exceptions?

Observability should stay lightweight and proportional to a portfolio project.

# Suggested remaining order of work

1. Card editor finalization using the launch sets as the stress test.
2. Production-like web/Android performance measurement and targeted smoothness fixes.
3. Responsive, accessibility, empty-state, and inspector QA.
4. Image/upload, auth, moderation, browser, and real-device QA.
5. SEO/sharing and lightweight production observability.
6. Deployment and production configuration.
7. Go live.

The order can move as dependencies become clearer, but completed sections 2-8 and 10 should not be reopened without a specific reason.
