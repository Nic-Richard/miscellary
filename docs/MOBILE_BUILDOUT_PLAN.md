# Android build-out plan

Status: the Android architecture now uses canonical web components for complex visual surfaces and
baked images for repeated published cards. Native navigation, authentication, camera and gallery
access, uploads, and platform integration remain native. Complex visual surfaces have one shared
implementation instead of parallel web and native renderers.

## Rendering boundary

Inspector, binder, pack opening, card editing, and pack editing are shared WebView surfaces. They use
the same React components and drawing rules as web, with mobile-specific layout, safe-area, touch,
loading, and keyboard behavior. A full surface uses one WebView. Large card lists must not mount one
WebView per card.

Published card definitions provide reusable baked assets:

- a 300 by 420 thumbnail for grids and small binder cards
- a 1000 by 1400 front for inspection and other detailed views
- a 1000 by 1400 back shared by the set
- optional thumbnail and detail masks for foil or holo coverage

The baked face contains all static print work, including the source image, stock, typography,
textures, borders, fixed shading, and optical relief. Foil, holo, and finish sheen remain lightweight
layers driven by the surrounding scene. The inspector rotates one card slab with baked front and
back images and preserves the existing thin card core.

Drafts continue to use the live shared renderer so editor changes appear immediately. If a published
render is missing or unavailable, repeated-card contexts show a lightweight loading state until the
baked asset is available. They do not mount one WebView per card.

## Authority and immutability

The frozen definition, template snapshot, and source image remain the source of truth. Rendered files
are presentation caches referenced by every owned copy. They do not affect ownership, rarity, packs,
trades, recycling, reactions, or moderation.

Publishing locks the complete set, including title, description, cover, mark, pack and binder colors,
pack artwork and text, card definitions, and every other content or appearance setting. Creator
deletion and platform removal remain lifecycle operations rather than edits.

The render signature includes the renderer version and every input used by the face or back. A newer
renderer version can regenerate assets from the frozen source without changing the definition.
Publication itself never waits for browser rendering.

## Current implementation

- `SharedSurface` bundles the canonical web components locally and bridges API calls, uploads,
  navigation, sizing, and close or selection events.
- Card and pack editors already use the shared renderer with responsive pinned previews.
- Binder, inspector, and pack opening now default to shared surfaces on mobile.
- The profile binder has a shared surface using the canonical ten-page binder.
- Superseded native card, card-back, binder, inspector, pack, and pack-opening renderers have been
  removed after the shared surfaces became the chosen product direction.
- Published card responses expose render status, signatures, thumbnail and detail faces, masks, and
  the set back. Draft card responses do not expose a render cache.
- Render-only front, back, and mask modes use the bundled canonical renderer and wait for fonts and
  images before capture.
- `pnpm --filter mobile renders:generate` captures current published development cards through an
  existing Chromium debugging connection and writes a local manifest.
- `python manage.py import_card_renders <manifest>` uploads those files to configured object storage
  and attaches only signatures that still match current published definitions.
- Collection, search, trade, profile selection, and published Studio grids prefer baked thumbnails.
  They show a lightweight loading state when a published render is unavailable.
- Canonical web binders, inspector, pack opening, profile binder, and normal web grids use the same
  baked assets when ready.
- The seeded baked assets and shared mobile surfaces have been reviewed on a physical Android phone
  and accepted for this checkpoint.

## Local render workflow

The API and MinIO must be reachable from the host, and the shared surface bundle must be current.
Start Chromium with remote debugging on port 9224, then run:

```powershell
pnpm --filter mobile renders:generate
docker compose exec api uv run python manage.py import_card_renders /repo/tmp/card-renders/manifest.json
```

Generation writes only under `tmp/card-renders`. Import rejects mismatched renderer versions,
publication states, signatures, and local paths before attaching those assets. Re-seeding
development data and running the commands again is the intended path. There is no legacy backfill.

## Next focused work

1. Measure collection, search, and trade grid load time, scrolling, memory, and image transitions on
   the physical Android phone.
2. Compare local Docker and Expo performance with a production-like build before changing the
   renderer or loading architecture.
3. Exercise pending and failed image loads, slow networks, cache reuse, reduced motion, and accessible
   labels.
4. Repeat binder, inspector, pack, and editor phone checks after any performance changes.
5. Add automated production generation only when deployment needs are concrete. Keep publication
   independent and do not introduce queue or worker infrastructure prematurely.

## Existing native foundation

- Expo 53, React Native 0.79.6, React 19, TypeScript, and Expo Router 5.
- Shared API contracts and description, rarity, card-material, and identity rules in
  `@miscellary/shared`.
- Django REST API, PostgreSQL, and presigned S3 uploads, with MinIO for local storage.
- Access tokens in memory and rotating refresh tokens in Expo SecureStore.
- Camera and gallery capture, system cropping, resizing, and direct uploads.
- Implemented screens for browse and search, collections and recycling, Studio, pack opening,
  trades and counters, profiles and follows, and reporting.
- Existing `react-native-svg` and `expo-linear-gradient` dependencies for lightweight material layers
  on baked cards and renderer capability checks.

## Remaining product and integration checks

- Verify shared binder navigation and inspection in portrait and landscape.
- Verify pack tear gestures, card sequencing, duplicate labels, close, and Android back behavior.
- Verify the card and pack editor pinned previews, camera and gallery uploads, keyboard and focus,
  saving, cancellation, and draft recovery.
- Exercise a second discovery page with enough real data, offline retry, and session recovery.
- Verify accessibility, release exports, auth refresh, and SecureStore behavior.
- Keep ownership, trade holds, rarity restrictions, and published immutability authoritative in the
  backend.

## Validation and local setup

Use focused lint and type checks during implementation and the normal full suite at a checkpoint.
An Android export does not establish device correctness. The primary review target remains a
physical Android phone over Wi-Fi, with an emulator as a secondary target.

Keep Docker serving web and API while mobile runs through Metro against the same API. Do not run a
web production build against an active development `.next` cache.
