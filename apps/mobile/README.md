# mobile

The Android client (Expo + Expo Router). Same API and `@miscellary/shared` types as the web app,
written as plain React Native screens.

- Browse and search, binder with daily pack opening and staged reveal
- Collection with duplicate recycling
- Studio: create sets, **camera-first card creation** (system crop → resize → presigned S3 upload)
- Trade offers with counters
- Profiles, follows, showcase editor, reports

Refresh tokens live in SecureStore; the access token stays in memory and refreshes on 401.

```bash
cp .env.example .env            # EXPO_PUBLIC_API_URL; 10.0.2.2 reaches the host from the emulator
pnpm --filter mobile dev        # then press `a` for Android
```
