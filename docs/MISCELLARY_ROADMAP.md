# Miscellary Product / UI Roadmap

This document is the source of truth for remaining Miscellary product, UI, mobile, launch, and polish work.

The repository on `main` is the implementation source of truth. This roadmap tracks what is complete, what still needs follow-up, and what remains before launch.

Status:

- **Complete**: implemented in the current web product; only normal QA/polish may remain.
- **In progress**: substantial work is done, but known product work remains.
- **Not started / remaining**: still needs dedicated implementation work.

Items are ordered roughly by current priority. The order can change as dependencies or product decisions become clearer.

## 1. Card editor overhaul — In progress

The main overhaul was implemented. Phone review reopened the creative-control follow-up:
Full Art borders, better description panels, automatic technical production choices, and restored
demo variety are being addressed alongside Android batch 2. These changes still need visual review.

### Completed in the follow-up

- Added peach, lavender, sage, lilac, cocoa, and aubergine stock colors.
- Corrected stock swatches to match the rendered board colors.
- Exposed **Window shape** as visual choices on all five framed templates, including Polaroid.
- Added copper, ochre, silver, and sage inks.
- Extended border ink and four curated thickness choices to all framed templates, with a template-default option.
- Grouped border controls with the board and displayed thickness choices as visual samples.
- Fixed stock and rarity edges overriding selected border ink, including on existing seeded cards.
- Kept Full Art edge-to-edge, light stocks on Polaroid/Field Note, and dark stocks on Dossier.
- Kept template versions unchanged; published reads still returned stored configurations without applying editor defaults.
- Verified the controls in the web editor, shared renderer, binder, and inspector in desktop Chromium.

Remaining responsive, cross-browser, and real-device QA belongs to the later QA passes.

### Completed in the overhaul

- Reorganized the editor around more intentional card-design controls.
- Expanded stocks, photo treatments, borders, relief, and material choices.
- Kept ordinary creative freedom available across rarities.
- Made rarity unlock specialty production treatments rather than base card quality.
- Kept Epic Full Art and Legendary chase-treatment rules.
- Removed the printed rarity badge from the card face.
- Removed the old baked-in top-left card shine.
- Removed automatic foil/holo travelling animation from normal card rendering.
- Moved card lighting responsibility to the surrounding scene.

## 2. Binder lighting and card presentation — Complete

Binder views now provide the environmental lighting for cards rather than relying on baked card shine or canned chase animations.

Completed:

- Added shared stationary binder lighting.
- Let pearl, metallic, foil, holo, clear coat, sleeves, and other card materials react to the same scene.
- Kept Common cards readable as printed objects rather than glossy UI tiles.
- Connected the binder material language more closely to the 3D inspector.

Remaining work belongs under final responsive, browser, performance, and real-device QA rather than this feature.

## 3. Homepage redesign — Complete

The homepage was redesigned around the actual Miscellary product rather than generic marketing panels.

Completed:

- Re-established the tactile Miscellary visual identity.
- Centered real cards, packs, binders, and seeded product content.
- Improved hierarchy and product communication.
- Kept the physical-product language of print, paper, leather, packs, and cards.

Remaining responsive and mobile QA is tracked later in the roadmap.

## 4. Personal profile binder and set binder customization — Complete

The old Showcase concept was replaced with a user's public binder.

Completed:

- Added a public personal binder for favorite owned cards.
- Added binder cover/leather color customization for profiles.
- Added binder color customization for sets.
- Preserved card inspection from binder contexts.
- Fixed incomplete profile binders caused by paginated owned-card lookup.
- Allowed cards in a full profile binder to be replaced.

Any future binder-material expansion is optional polish, not required core work.

## 5. Binder page-turn interaction — Complete

A quick physical page-turn animation is implemented.

Completed:

- Added a restrained page-flip illusion.
- Kept navigation responsive rather than turning it into a full book simulation.
- Added reduced-motion handling for the page turn.

Touch and narrow-viewport behavior still need final real-device/responsive QA.

## 6. Background and panel material pass — Complete

The old repeated texture treatment was replaced with a clearer material hierarchy.

Completed:

- Reworked the main background and panels into distinct desk, board, paper, cloth, and card-like surfaces.
- Reduced the feeling that unrelated surfaces are made from the same texture.
- Kept the materials visually related without flattening them into one repeated noise treatment.

Further changes should be driven by specific visual problems rather than another broad material rewrite.

## 7. Mark / emblem cleanup — Complete

The built-in set marks received a geometry cleanup.

Completed:

- Fixed alignment and join problems across the mark set.
- Corrected known issues such as the key geometry.
- Improved consistency at normal and small display sizes.

Only revisit individual marks if a concrete rendering problem appears.

## 8. Pack tear interaction — Complete

The pack tear was reworked to feel less rigid and more physical.

Completed:

- Added flexible pull deformation.
- Added a more natural tear edge.
- Added visible inner foil.
- Preserved the existing physical pack material direction.

Final touch behavior and performance still need real-device QA.

## 9. Android / React Native product build-out — In progress

The Android app still needs substantial work and should eventually become a real first-class client rather than a secondary approximation of the web app.

The detailed implementation plan is [MOBILE_BUILDOUT_PLAN.md](MOBILE_BUILDOUT_PLAN.md).
Android was confirmed as the next priority ahead of production launch content.

First batch implemented, pending actual-phone review:

- Current cream/teal app shell, bundled typography, navigation icons, status bar, and shared controls.
- Phone-sized Browse binder shelf with sorting, pagination, refresh, and loading/error/retry states.
- Wi-Fi API/media connectivity and documented Expo Go SDK 53 phone/emulator preview paths.
- Existing routes and five main destinations preserved.

The physical phone loaded successfully. Batch 2 added template-aware rendering, paged binders,
landscape supporting panels, front/back inspection, bundled editor fonts, directional material
lighting, editor follow-up, and trade-offer styling. Two shared demo collections received curated
photography and richer styling, applied in an approved demo reset. Thirteen legacy photo downloads
fell back to gradients and still need replacement. Device review and
remaining rendering fidelity are still open. Pack opening and broader Studio/trade workflow
redesigns remain later work.

### Product / design work

- Revisit each major flow specifically for a phone screen.
- Do not simply shrink the desktop layouts.
- Decide what the mobile navigation should prioritize.
- Make pack opening feel good on touch.
- Adapt binder browsing to a narrow viewport.
- Make card inspection practical on touch.
- Rework Studio / creation flows for mobile if they remain in scope.
- Revisit trading, collections, profiles, search, and notifications for mobile ergonomics.

### Card rendering

The React Native card renderer currently differs from web.

Decide how closely mobile should reproduce:

- stock/material hierarchy
- rarity treatments
- Full Art
- foil / holo
- card backs
- inspector lighting / tilt

It does not need identical CSS effects, but it should preserve the same visual language and rarity logic.

### Testing

- Real Android-device testing is still required.
- Verify auth refresh / SecureStore behavior.
- Verify camera/gallery uploads.
- Verify touch interactions and scrolling.
- Verify performance on a normal mid-range device.

## 10. Production-quality seed / launch content — Remaining

The current demo seed is useful for development, but launch should not feel like an empty database or an obviously fake demo.

### Goal

Start with roughly 50 believable public sets from creators who look like real users.

### Seed quality

- Use varied creator names, usernames, bios, avatars, and interests.
- Avoid obviously generated naming patterns.
- Give creators different levels of activity.
- Vary set sizes, rarity distributions, styles, binder colors, pack identities, descriptions, reactions, comments, and collections.
- Include a realistic mix of polished and ordinary sets rather than making every creator look like a professional designer.
- Seed followers / following relationships where useful.
- Seed enough owned cards and trades for the social/collection surfaces to feel alive.
- Make discovery/search useful immediately.

### Persistence

Launch seed content should persist in production and should not behave like the destructive local `seed_demo` command.

Create a clear distinction between:

- local/demo seeding
- one-time production/bootstrap content

Production startup should not automatically recreate seed users.

## 11. Production deployment and live URL — Remaining

Miscellary still needs to go live.

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

## 12. Smoothness, responsiveness, and performance pass — Remaining

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

- real-device touch test
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

## Moderation / abuse UX

Backend rules exist, but the public product should have complete UI flows for:

- reporting cards/sets/users/comments where supported
- blocked/removed content behavior
- creator deletion vs platform removal
- moderation-facing messaging that does not expose internal implementation

## Authentication / account UX

Before launch:

- registration
- verification
- forgot/reset password
- logout
- expired session refresh
- mobile token behavior
- account deletion
- error messages
- production email delivery

## SEO / sharing

For the public web product:

- title/description metadata
- canonical URLs
- social/Open Graph cards for sets and profiles
- favicon/app icons
- sitemap
- robots.txt
- shareable set/profile/card URLs where appropriate

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

1. Android design and implementation.
2. Production-quality launch content.
3. Responsive, accessibility, empty-state, and inspector QA.
4. Smoothness and performance pass.
5. Image/upload, auth, moderation, browser, and real-device QA.
6. SEO/sharing and lightweight production observability.
7. Deployment and production configuration.
8. Go live.

The order can move as dependencies become clearer, but completed sections 2-8 should not be reopened without a specific reason.
