# Android preview

The Android client uses Expo Router and native screens, with canonical web components bundled for
binders, pack opening, inspection, and editing. It uses the same API and `@miscellary/shared`
contracts as the web app.

- Browse: phone-sized binder shelf, sorting, pagination, refresh, and search
- Existing set binder with daily pack opening and staged reveal
- Collection with duplicate recycling
- Studio: create sets, **camera-first card creation** (system crop → resize → presigned S3 upload)
- Trade offers with counters
- Profiles, follows, personal binders, reports

Refresh tokens live in SecureStore; the access token stays in memory and refreshes on 401.

Published card grids prefer baked thumbnails and never mount one WebView per card. Shared WebView
surfaces are the default for set and profile binders, card inspection, pack opening, and both
editors. Draft editing stays live, with pinned previews on narrow screens and side-by-side landscape
layouts. Published cards without an available baked image show a lightweight loading state.

## Phone over Wi-Fi

1. Keep Docker running (`docker compose up -d`).
2. Install [Expo Go for SDK 53](https://expo.dev/go?device=true&platform=android&sdkVersion=53)
   on the Android phone. A different SDK version of Expo Go will not load this project.
3. Connect the PC and phone to the same network. Keep `EXPO_PUBLIC_API_URL` blank in
   `apps/mobile/.env` to use Metro's host automatically.
4. Add the PC's LAN IPv4 address to `ALLOWED_HOSTS` in `apps/api/.env`, retaining localhost
   and 127.0.0.1. Run `docker compose up -d --no-deps api` after changing it.
5. From the repo root, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-mobile.ps1
```

Use `-Address 10.0.0.84` to select an interface explicitly. Scan Metro's QR code in Expo Go
or enter its `exp://<PC-IP>:8081` URL. The script's execution-policy setting applies only to
that invocation, not the machine's global policy.

The phone needs access to TCP 8081 (Metro), 8000 (API), and 9000 (local images). If it cannot
connect, check that Windows Firewall allows these on the private network and that Wi-Fi client
isolation is off. A Metro tunnel alone does not expose the local API or MinIO.

Local media URLs are adapted to the same host in development only. Remote media and signed upload
URLs are preserved. Camera/upload review is a later batch; local signed uploads require MinIO's
public endpoint to be configured for the device before signing URLs.

## Android emulator

Install Android Studio's SDK/platform tools and create an Android Virtual Device, then boot it.
Use the same Metro session and Expo Go SDK 53 build, or run `pnpm --filter mobile android` when
Metro is not already running. The LAN host works for both targets. If necessary, set
`EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` for an emulator-only session and include `10.0.2.2`
in the API's allowed hosts. Restart Metro after changing environment settings.

## Release builds and validation

Set `EXPO_PUBLIC_API_URL` to the production HTTPS API origin for release builds. Automatic host
selection and local media rewriting are restricted to development.

```sh
pnpm --filter mobile lint
pnpm --filter mobile typecheck
pnpm --filter mobile test
pnpm --filter mobile build
```

The Android export checks bundling; it does not install or validate the app on a device.
Keep Docker serving web/API while Metro runs. Avoid simultaneous host web builds/dev servers
sharing `apps/web/.next`.

The detailed Android plan is [MOBILE_BUILDOUT_PLAN.md](../../docs/MOBILE_BUILDOUT_PLAN.md).
The overall source of truth is [MISCELLARY_ROADMAP.md](../../docs/MISCELLARY_ROADMAP.md).
