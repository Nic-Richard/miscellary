# Miscellary Product / UI Roadmap

This document is the source of truth for remaining Miscellary product, UI, mobile, launch, and polish work.

The current GitHub baseline is commit `eb78aa3`, which includes the Miscellary rename, rarity/editor model, physical card materials, foil/holo treatments, and the 3D card inspector.

Items are ordered roughly by current priority. The order can change as dependencies or product decisions become clearer.

## 1. Card editor overhaul

The card editor is still the highest-priority UI problem.

### Main goals

- Revisit the editor as a whole rather than continuing to bolt options onto the existing controls.
- Remove options that are legacy, redundant, confusing, or no longer fit the current card/material system.
- Add enough meaningful design control that cards from the same template can still feel genuinely different.
- Keep lower rarities creatively useful. Rarity should gate specialty production treatments, not basic design freedom.
- Keep the editor understandable rather than exposing every tiny manufacturing detail as a separate control.

### Areas to review

- Template selection and whether the current set of templates is still the right set.
- Stock / board choices.
- Surface and texture choices.
- Typography choices and which templates should expose them.
- Accent, border, framing, corners, image treatment, tint, note paper, and other existing options.
- Rare+ specialty materials and whether more useful options should exist.
- Epic+ Full Art behavior.
- Legendary foil / holo treatment choices and coverage.
- Preview behavior while editing.
- Option naming and grouping.
- Locked rarity options and how they are communicated without making lower tiers feel restricted.
- Whether any controls can be made more visual instead of dropdown-heavy.

### Important cleanup

- Remove the old baked-in top-left card shine from the card renderer.
- Remove the automatic foil / holo travelling reflection animation from normal card rendering.
- Card lighting should come from the environment instead:
  - binder lighting in binder views
  - fixed scene lighting in the 3D inspector
  - other context-specific lighting where appropriate

The card itself should not carry fake baked lighting that conflicts with the newer physical material model.

## 2. Binder lighting and card presentation

Once the old baked shine is gone, binder views need deliberate environmental lighting so cards still feel physical and premium.

### Goals

- Add believable stationary binder lighting that reacts consistently across cards.
- Let pearl, metallic, foil, holo, clear coat, and other materials read naturally without canned animation.
- Keep lighting subtle enough that Common cards still look like printed cards rather than glossy UI tiles.
- Make sure light and dark templates both hold up.
- Preserve readability of photos and text.

This should visually connect the binder experience to the 3D card inspector.

## 3. Homepage redesign

The homepage was broken somewhere during the recent work and already needed a stronger rethink.

The homepage needs both regression repair and a broader product/design rethink.

### Goals

- Re-establish the visual identity immediately.
- Make the product understandable without turning the page into generic SaaS marketing.
- Show the strongest parts of Miscellary:
  - making sets
  - collecting
  - binders
  - packs
  - trading
  - card inspection
  - creator identity
- Use real seeded product content rather than placeholder marketing panels where possible.
- Give the page a more intentional graphic composition and stronger hierarchy.
- Preserve the tactile physical-product world established by packs, binders, cards, paper, leather, and print materials.
- Make sure the homepage is responsive and remains strong on mobile.

Separate regressions introduced in recent work from intentional redesign work.

## 4. Replace profile Showcase with a personal binder

The current Showcase concept should become a user's own public binder.

### Product direction

Each user should have a personal binder containing favorite cards they choose to display publicly.

Possible behavior:

- A dedicated binder on the user's profile.
- User chooses which owned cards appear.
- Binder is visible publicly.
- Existing showcase-slot rules can be adapted rather than discarded if useful.
- Binder should feel like an actual collection object rather than a generic grid.

### Customization

- Let the owner choose the leather / cover color of their personal binder.
- Consider a small curated set of materials or finishes later, but avoid turning it into a generic theme editor.
- Keep customization cosmetic and tasteful.

### Related set customization

The set editor should also allow the set creator to choose the binder color used on that set's public binder page.

This should be stored as part of the set's published identity / snapshot behavior where appropriate so published sets remain stable.

## 5. Binder page-turn interaction

The binder should feel more physical when moving between pages.

### Goal

Add a quick, restrained page-flip animation that gives the illusion of an actual binder page turning.

Important:

- It should be short and responsive.
- Do not make navigation feel slower.
- Avoid a full 3D book simulation unless necessary.
- The animation should support the physical illusion without becoming the focus.
- Respect reduced motion.
- Check touch behavior on mobile/tablet layouts.

## 6. Background and panel material pass

The global background and several panels still carry an older texture treatment that no longer fits the newer material direction.

### Review

- Global page background.
- Main content surfaces.
- Sidebar / navigation surfaces.
- Studio panels.
- Modals / sheets.
- Binder surroundings.
- Any repeated texture that makes unrelated surfaces look like the same material.

### Goal

Build a clearer material hierarchy.

Not every surface should use the same texture. The page background, paper/card surfaces, leather binder, and UI panels should feel related but physically distinct.

The goal is a clearer material hierarchy, not simply replacing one repeated noise texture with another.

## 7. Mark / emblem cleanup

Some set marks need geometry cleanup.

Known example:

- Key mark: the teeth do not line up correctly with the back / shaft.

### Pass goals

- Review every current mark at normal and small sizes.
- Fix alignment, joins, symmetry, stroke consistency, and optical balance.
- Make sure marks survive use on:
  - cards
  - pack fronts
  - card backs
  - navigation / identity areas
  - small thumbnails
- Preserve their existing character rather than redesigning all marks.

## 8. Pack tear interaction

The pack rip currently feels too rigid.

### Main issue

The tear has essentially no flexibility, so it reads like a predefined cut rather than foil/paper being pulled apart.

### Goals

- Give the tear line some flex and response to the user's drag.
- Make the ripped section deform naturally as it is pulled.
- Preserve the current physical pack material work.
- Keep the interaction responsive and not overly simulated.
- Make sure mouse and touch both work well.
- Avoid adding a physics dependency unless there is a real need.

The target is a convincing tactile illusion, not a full cloth/foil simulation.

## 9. Android / React Native product build-out

The Android app still needs substantial work and should eventually become a real first-class client rather than a secondary approximation of the web app.

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

## 10. Production-quality seed / launch content

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

## 11. Production deployment and live URL

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

## 12. Smoothness, responsiveness, and performance pass

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

# Suggested order of work

1. Card editor overhaul.
2. Remove baked card lighting / animation and establish binder lighting.
3. Homepage redesign.
4. Personal profile binder and set binder customization.
5. Binder page-turn interaction.
6. Background / panel material pass.
7. Mark cleanup.
8. Pack tear improvement.
9. Responsive / accessibility / empty-state polish alongside the UI work.
10. Production-quality launch content.
11. Android design and implementation.
12. Performance / responsiveness pass.
13. Deployment and production configuration.
14. Cross-browser, real-device, auth, upload, moderation, and launch QA.
15. Go live.

The exact order can move as the product develops. A coherent surface should generally be finished before work spreads across many unrelated areas.
