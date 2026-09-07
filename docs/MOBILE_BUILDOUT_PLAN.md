# Android build-out plan

Status: native drawing primitives and all six card previews are implemented and have received an initial phone review. They are not yet connected to product screens. The WebView remains the active renderer.

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
4. **Card back and set marks.** SVG ports of the existing geometry.
5. **Binder.** Existing binder assets, native layout, page turn through transforms.
6. **Inspector.** Touch rotation, and lighting driven by translation and opacity on prepared
   gradient layers rather than per-frame gradient recomputation.
7. **Pack.** Existing pack artwork with an SVG overlay.
8. **Editor controls.** `CardForm` already iterates the API's `template.options` with `unlocks`
   gating, so the rules stay on the server and native supplies the control widgets.

Phases 2 and 3 leave all `SharedSurface` call sites unchanged. Later phases replace one call site at a time after the native replacement is proven, leaving the rest on the WebView.

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

The primitives and card previews received an initial phone review and were accepted as close enough for now. A complete upload/save/reopen round-trip and product-screen integration have not been established by that review. Remaining differences include the Polaroid serif fallback, description clipping, long-title layout, Minimal scrim sizing, and very non-square arch geometry. Window and panel measurement, gradient-stop cost, and card-grid performance still need review.

Keep the PRIMITIVES screen until the native rendering path has been integrated and verified. `SetMark.tsx` is now used by the native renderer; the other legacy drawing components remain available during migration.

## Current implementation and remaining work

The shared WebView surfaces provide the current card, binder, pack, inspector, and editor presentation. The earlier native renderer remains in the tree but is not the active rendering path. Its assets and approved dependencies are retained for the native replacement.

The demo database contains eight collectors, eleven published sets, and one draft. Other Worlds and Shutter Shelf use curated, credited photos. Thirteen legacy photo downloads still fall back to gradients. See `DEMO_PHOTOGRAPHY.md`. Do not reset demo data without approval.

The next priority is proving and integrating the native renderer. Before replacing card-list call sites, measure WebView memory and scrolling on the phone. Remaining work includes native parity, Android visual and gesture QA, remaining demo photography, and launch content.

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
