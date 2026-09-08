# Android build-out plan

Status: native card fronts and backs are implemented, with standalone cards using the native renderer and an explicit WebView fallback. Native set and profile binders have received initial phone review, including portrait and landscape page turns. The final swipe, compositing, and image-fade adjustments still need device review. Inspector, pack, reveal, and editor surfaces remain on the shared WebView path.

## Native card renderer

The second batch reached web parity by bundling the web components with esbuild and running them in
a `react-native-webview` (`components/SharedSurface.tsx`, `surfaces/`, `scripts/build-surfaces.mjs`).
That was approved after the first native renderer failed to reproduce the desktop cards, binder,
pack, and inspector. It works, but it mounts one WebView per card in the collection, search, and
trade grids, each loading a ~1.95 MB document, and it puts desktop layouts on a phone.

The decision is to build a real native renderer with the desktop renderer as its specification.
The WebView stays in place as the reference and fallback until each native replacement is proven,
and is only removed once the native path is complete.

### Why the first native attempt failed

`CardPreview.tsx` is 126 lines; the specification is the 1374-line `CardPreview.module.css`, driven
by `data-*` attributes over 106 custom properties. The previous native renderer was 526 lines in
total, including card backs and marks, and `lib/cardAppearance.ts` hand-copied the palette into a
third place that returned 8 values where the stylesheet resolves far more. It was an approximation
by construction, not a broken implementation. The fix is to stop retyping the design.

### What the platform already provides

React Native 0.79.6 on the new architecture supports `mixBlendMode` (all 16 modes), `boxShadow`
including `inset`, `filter`, and `isolation` directly in `ViewStyle`. Those cover the 12 blend
modes, 11 shadows, and 2 filters the stylesheet uses. Container query units are replaced by an
explicit width, which is simpler on native than on the web.

The gaps are radial gradients (6), masks and clip paths (11), and linear gradients (32), covered by
the already-approved `react-native-svg` and `expo-linear-gradient`. Repeating gradients expand in
JS and `color-mix` is a short helper, so neither needs a dependency. **No new graphics dependency
is required for the card renderer.** `react-native-reanimated` and `react-native-gesture-handler`
are both in Expo 53's bundled modules and are decided at the inspector phase, only if the built-in
`PanResponder` and `Animated` cannot hold frame rate. Skia stays out: Expo 53 pins a prerelease.

`PackPouch.tsx` and `CardBack.tsx` are already SVG with geometry computed in TypeScript, so they
port to `react-native-svg` closely. The binder uses image assets with transforms and no masks.

### Phases

1. **Shared tokens.** Extract palette and print geometry into `@miscellary/shared` and move the web
   renderer onto it, so neither platform holds its own copy. Complete.
2. **Native primitives.** Stock, edge, window shapes, texture, finish coat, relief, and chase, built
   from tokens rather than from screenshots. Complete.
3. **Native `CardPreview`.** All six templates at 100, 150, and 300 px. Implemented and initially reviewed on the phone; further parity and integration QA remains.
4. **Card back and set marks.** Reworked after the initial phone review failed. The revised explicit
   native layers now tile the linen asset across the full card and are pending another phone review.
5. **Binder.** Existing binder assets and a native layout. The current page-turn effect is an initial
   prototype and was not ported unchanged. Placement resolves the web coordinates explicitly
   against the measured horizontal and vertical axes. Portrait pans across one full binder for the
   two pages in a spread. Crossing from a right page to the next left page combines leftward motion
   with a front-and-back page leaf instead of scrolling into another binder. Landscape turns a
   layered binder leaf: the destination spread sits below
   the leaf, the outgoing stationary page remains visible until the leaf covers it, and the landing
   page is drawn on the leaf back. Buttons use the same orientation-specific transition. Native image
   prefetch and explicit binder measurements prepare the current and neighboring cards before the
   transition. The web and WebView binder use the landscape layer order and preload neighboring
   spreads. Reduced-motion preferences remove settling and turn transitions. This interaction is
   pending phone and browser review.
6. **Inspector.** Touch rotation, and lighting driven by translation and opacity on prepared
   gradient layers rather than per-frame gradient recomputation. Until that replacement is ready,
   the shared inspector uses a full-screen mobile layout with a height-constrained landscape card.
7. **Pack.** Existing pack artwork with an SVG overlay. Pack opening needs a phone-specific layout;
   the current desktop composition becomes jumbled on the mobile viewport and is not the native
   layout specification.
8. **Editor strategy and hardening.** Treat native controls as a decision point, not a required
   rewrite. The card editor and pack designer may remain single WebView workflows if upload,
   keyboard, focus, performance, accessibility, back behavior, and draft recovery pass on the
   phone. On a narrow screen, pin the live design preview to roughly the top half while the controls
   scroll independently below it. Prefer a side-by-side layout where landscape width permits.

Phases 2 and 3 initially left all `SharedSurface` call sites unchanged. After phone review, the shared card-preview wrapper moved standalone card fronts to native rendering while retaining an explicit WebView option. Set and profile binders now default to native layouts with page turns and retain explicit WebView fallbacks. Inspector, pack, reveal, and editor surfaces remain unchanged until their native replacements are proven.

### Verifying parity

Pixel equality across Chromium and Android is not achievable, so parity is checked three ways:
exact assertions on `resolveCardTokens` against a shared fixture set; a side-by-side contact sheet
at the three widths for human review, which is the real gate; and a tolerant perceptual diff to
catch gross breakage. `scripts/verify-surfaces.mjs` already drives Chrome over CDP and is the seed
for the reference capture.

### Phase 1 outcome

`packages/shared/src/cardTokens.ts` resolves stock, edge, edge width, corner, ink, muted ink, art
background, accent, border, rarity, core, glow, and texture, and `CardPreview.tsx` sets them as
inline custom properties. The duplicated token assignments were removed from the stylesheet, which
keeps the drawing rules. The extraction was checked against 1692 option combinations. The cocoa/aubergine untextured fallback was subsequently corrected, so the original equality digest is no longer the expected result.

`app/dev/primitives.tsx` is a dev-only screen, reached from a temporary button or at
`miscellary://dev/primitives`, that checks the primitives on the physical phone. Android SDK tools
are still absent, so the check is visual.

All fourteen passed on the phone: `multiply`, `screen`, `overlay`, and `soft-light`; `boxShadow`
inset and outset; `grayscale`, `sepia`/`saturate`, and `brightness` filters;
`experimental_backgroundImage` and `expo-linear-gradient`; the SVG radial gradient and mask; and
blending across an SVG and a view. Nothing in the phase list needs a fallback, and no graphics
dependency beyond `react-native-svg` and `expo-linear-gradient` is required.

### Phases 2 and 3

`packages/shared/src/cardMaterial.ts` resolves coats, grain, sheen, relief, varnish, and foil/holo chase layers. The native primitives use those values for stock, edges, window geometry, textures, and material layers. The web renderer still owns its material values in CSS, with a drift-guard test until those values are shared.

`components/card/CardPreview.tsx` assembles all six templates. It reuses the existing set mark and description components, and shares caption splitting with the web through `cardText.ts`. The dev gallery includes 18 fixtures at 100, 150, and 300 px, plus live cards loaded through the existing API. Photos use the existing mobile media URL handling. No upload backend or `SharedSurface` call site changed.

The primitives and card previews received an initial phone review and were accepted as close enough for now. A Collection A/B review also accepted the native result, while the WebView collection took roughly 15 seconds to load on the test phone. This establishes a product reason to prefer native previews, but it is not a complete memory or frame-rate measurement. A complete upload/save/reopen round-trip and broader product-screen review are still required. Remaining differences include the Polaroid serif fallback, description clipping, long-title layout, Minimal scrim sizing, and very non-square arch geometry. Window and panel measurement, gradient-stop cost, and card-grid performance still need review.

Keep the PRIMITIVES screen until the native rendering path has been integrated and verified. `SetMark.tsx` is now used by the native renderer; the other legacy drawing components remain available during migration.

### Phase 4

The first native card-back review failed because mirroring the web SVG structure did not reproduce
its rendered composition on Android. The revised back uses explicit repeated marks, native borders,
circles, text, and explicitly tiled linen layers instead of relying on one SVG pattern paint server
or Android repeated-image coverage.
Pack colour adjustments moved into `@miscellary/shared`, so web and native use the same hue,
saturation, and brightness values. The PRIMITIVES screen includes coloured, neutral, marked, and
unmarked backs for another phone review.

## Current implementation and remaining work

The native renderer now provides standalone card previews in Collection, Search, Trades, profiles, and Studio. The card-preview wrapper retains the WebView renderer as an explicit fallback, including a development A/B control in Collection. The set binder also defaults to native rendering and retains an explicit WebView path. Shared WebView surfaces still provide pack, inspector, reveal, and editor presentation. The other legacy native drawing components remain in the tree during migration.

The demo database contains eight collectors, eleven published sets, and one draft. Other Worlds and Shutter Shelf use curated, credited photos. Thirteen legacy photo downloads still fall back to gradients. See `DEMO_PHOTOGRAPHY.md`. Do not reset demo data without approval.

The next priority is reviewing binder swipe and turn behavior on the phone and in the browser. Binder review should cover both orientations, button and swipe navigation, slow drags, quick flicks, boundary resistance, vertical page scrolling, card taps, adjacent-page image readiness, and reduced motion. Inspector review should cover portrait and landscape fitting, full-screen background coverage, rotation, close behavior, and the compact like control. After that, continue with the native inspector and the remaining composed native surfaces in dependency order. Remaining work includes native parity, Android visual and gesture QA, remaining demo photography, and launch content.

The current code and `MISCELLARY_ROADMAP.md` take precedence over older product descriptions. This document is the detailed Android plan; the roadmap remains the overall source of truth.

## Existing foundation

- Expo 53, React Native 0.79.6, React 19, TypeScript, and Expo Router 5.
- Shared API contracts and description/rarity rules in `@miscellary/shared`.
- Django REST API, PostgreSQL, and presigned S3 uploads, with MinIO for local storage.
- Access tokens in memory and rotating refresh tokens in Expo SecureStore.
- Camera/gallery capture, system cropping, resizing, and direct uploads.
- Implemented screens for browse/search, collections/recycling, Studio, pack opening,
  trades/counters, profiles/follows, and reporting.

Retain this foundation. The first batch aligned React Native, Expo Router, and Screens with Expo
53's supported versions and declared the existing Expo font/icon packages directly. Evaluate SDK
generation upgrades and graphics/gesture dependencies separately against a concrete requirement.

## First-batch implementation

- Applied the current cream, paper, and teal palette, bundled display/body fonts, and accessible
  shared controls with larger touch targets and pressed states.
- Kept Browse, Collection, Studio, Trades, and Profile and the existing route structure.
- Added safe-area-aware Browse and tab navigation, status-bar styling, and consistent icons.
- Built colored, cloth-textured binder covers with photo windows, paper labels, and image fallbacks.
- Added paginated public discovery, sort switching, pull-to-refresh, retries, request cancellation,
  and request timeouts. Older responses cannot replace a refreshed or re-sorted shelf.
- Connected the Wi-Fi phone preview to the Docker API and adapted local read-only media URLs.
  Signed uploads and production URLs were left untouched.
- Added a Windows preview launcher and separate Wi-Fi/emulator setup instructions in
  `apps/mobile/README.md`.

Device review remains open. Check text sizes, shelf proportions, keyboard/search, sorting,
pull-to-refresh, scrolling, tab navigation, image fallback, and offline retry on the phone.
The seeded catalogue currently has 11 sets, below the API's 24-item page size; live continuation
onto a second real-data page has not yet been exercised.

## Remaining integration checks

- Verify collection, search, and trade rendering and scrolling on the physical phone.
- Verify portrait and landscape binder navigation, inspection, pack reveal, and editor preview/save behavior.
- Exercise a second discovery page with enough real data, offline retry, and session recovery.
- Verify camera uploads, permissions, persistence, Android back behavior, accessibility, and release builds.
- Keep ownership, trade holds, rarity restrictions, and published-card immutability authoritative on the backend.

## Validation and local setup

Use focused lint/type checks once per coherent batch and targeted regression coverage for changed
behavior. Prefer device smoke checks for layout and interaction; avoid repeatedly running the full
monorepo suite during implementation. An Android export alone does not establish device correctness.

The review targets are a physical Android phone over Wi-Fi and an Android emulator. The Android SDK
tools were not found on PATH or at the usual local SDK paths; an emulator has not been installed or
booted during this batch. Expo Go for SDK 53 provides the physical-phone preview without an SDK
generation upgrade. Emulator setup is documented separately.
Keep Docker serving the web/API; mobile runs through Metro against the same API. Do not run web
builds against an active host web development cache.
