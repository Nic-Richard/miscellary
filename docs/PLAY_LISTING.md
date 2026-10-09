# Google Play listing

Draft for the first Play submission. Keep it in step with the privacy policy and the app.

## Store listing

- **App name:** Miscellary
- **Short description (80 max):** Turn the things you collect into trading cards, then open, swap and binder them.
- **Category:** Entertainment
- **Contact email:** support@miscellary.com
- **Website:** https://miscellary.com
- **Privacy policy:** https://miscellary.com/privacy

**Full description:**

Miscellary turns real collections into trading card sets.

Photograph the things you collect, from film cameras and pocket watches to garden gnomes and rubber
ducks, and make a set of cards out of them. Give each card a title, a few lines of text and a rarity,
design its pack, and publish it.

Every set you follow gives you a free pack each day. Tear it open, reveal the cards one by one, and
file them in your binder. Spare copies can be recycled into points for extra packs, or traded with
other collectors for the cards you are missing.

- Make your own sets from your own photos
- Open a free pack from every set you follow, every day
- Keep your cards in binders, and show off your favourites on your profile
- Trade spares with other collectors
- Get a reminder when your next free pack is ready

Miscellary has no ads and no purchases.

## Graphics

- **App icon:** 512×512 PNG, from `apps/mobile/assets/images/icon.png`.
- **Feature graphic:** 1024×500.
- **Phone screenshots:** 2–8, between 320 and 3840 px, no taller than 2:1. Captured at 1080×2160 on
  the emulator with a clean status bar (`adb shell wm size 1080x2160` and System UI demo mode), kept
  outside the repo in `play-assets/`: Browse, a set, a sealed pack, a reveal, My cards, the landscape
  binder and Studio, plus the 512×512 icon and the 1024×500 feature graphic.

## Data safety

Nothing is sold. All data is encrypted in transit. Users can delete their account in the app
(Profile, Account settings, Close account) or on the website. Optional Google sign-in adds a
Google identity provider; recheck its SDK disclosures and the form's sharing definitions against
the final Android build before submitting. Do not reuse the old blanket "nothing is shared" answer.

| Data type                                                   | Collected | Purpose                                          | Optional |
| ----------------------------------------------------------- | --------- | ------------------------------------------------ | -------- |
| Email address                                               | Yes       | Account management, service email                | Required |
| User IDs (username; Google account ID if connected)         | Yes       | Account management, app functionality            | Mixed    |
| Photos                                                      | Yes       | App functionality (card images the user uploads) | Optional |
| Other user-generated content (sets, comments, profile text) | Yes       | App functionality                                | Optional |
| App interactions (follows, likes, trades, packs opened)     | Yes       | App functionality                                | Required |
| Crash logs, diagnostics                                     | No        |                                                  |          |
| Location, contacts, financial info, device IDs              | No        |                                                  |          |

Notes for the form:

- Pack-ready reminders are scheduled on the device; no push service or token is involved.
- Server request logs (including IP addresses) are kept for security and troubleshooting, as the
  privacy policy says; they are not used for location.
- The app does not include analytics. TraceTray runs on the website only.
- Google sign-in is optional. The API retains the Google account identifier and
  account email, not the credential token, Google name or Google photo. Closing the
  account removes its Google connection; disconnecting requires a password first.
- Review the final Google SDK against [Google's data-disclosure guidance](https://developers.google.com/android/guides/play-data-disclosure)
  before completing the form. Google sign-in is not authorization for Gmail, contacts
  or Drive access. Username is required; Google account ID is optional.

## Content rating and audience

- Target audience: 13 and over (matches the terms).
- User-generated content: users can report sets, cards, comments and profiles; reports are reviewed
  by hand.

## Release

- Personal developer accounts need a closed test with at least 12 testers opted in for 14 days before
  production access.
- Build the AAB with `pnpm dlx eas-cli build --platform android --profile production` from
  `apps/mobile`; EAS keeps the upload key and the version code.
