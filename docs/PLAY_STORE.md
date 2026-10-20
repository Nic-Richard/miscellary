# Play Store submission

Answers for the Play Console forms, taken from what the app actually does. Recheck them if
features change. Payment setup is in [BILLING.md](BILLING.md).

## Store listing

- **App name:** Miscellary
- **Short description (80 max):** Make card sets from your own photos, open packs, trade and collect.
- **Category:** Games > Card. **Tags:** Collectible card, Trading, Creativity.
- **Contact email:** support@miscellary.com. **Website:** https://miscellary.com
- **Privacy policy:** https://miscellary.com/privacy

Full description:

> Miscellary turns the things you collect into trading cards. Photograph anything — keys,
> stamps, sneakers, rocks — and build it into a set of cards with your own titles and notes.
>
> Publish a set and other collectors can open its packs, fill their binders and trade with
> you. Open a free pack every day for each set you follow, recycle duplicates into set points,
> and spend points on extra packs.
>
> Talk about your finds in the Lounge: show off cards, set up trades and ask questions.
>
> Want more? Tickets open extra packs, and a monthly membership adds bonus packs, tickets,
> more published sets, detailed creator stats and a supporter badge. Creators earn 20% of the
> tickets spent on their sets. Pack odds are shown before every paid pack.

Screenshots: at least four phone screenshots from the production app with real content
(binder, pack opening, a set, the Lounge). Feature graphic 1024×500. Icon from
`apps/mobile/assets/images`.

## App access

Review needs a signed-in account. Create a dedicated reviewer account on production (not
`nicqa`), verify its email, and give its email and password under App access with the note:
"Sign in with email. Packs, trading and the Lounge are available immediately."

## Ads, audience and other declarations

- **Ads:** No.
- **Target audience:** 13–15, 16–17 and 18+. Not designed for children; no Families program.
- **News, government, financial features, health:** No.
- **Account deletion:** in-app (Settings > Close account) and
  https://miscellary.com/privacy#delete-account
- **User-generated content:** yes. Terms are accepted at sign-up and before posting in the
  Lounge; posts, replies, comments, cards, sets and collectors can be reported and collectors
  can be blocked across the app. Reports go to the Django admin queue — check it daily.

## Content rating (IARC)

Category: Game. Expected rating around Teen / PEGI 12 because of user interaction and paid
random items.

- Violence, fear, sexuality, language, drugs, crude humour: No.
- Gambling: no real-money gambling and no simulated gambling. Answer Yes to "in-game purchases"
  and to "purchases of random items (loot boxes)".
- Users can interact and share content (Lounge, comments, trading): Yes.
- Shares the user's location: No. Digital purchases: Yes.

## Data safety

Data is encrypted in transit. Users can request deletion in-app or through
https://miscellary.com/privacy#delete-account. Include actual Google sign-in,
payment, hosting and alert-provider behavior. Apply Google's service-provider
sharing exceptions only when their conditions are met; do not use a blanket
"nothing is shared" answer.

| Data type                                      | Collected | Purpose                               | Optional |
| ---------------------------------------------- | --------- | ------------------------------------- | -------- |
| Email address                                  | Yes       | Account management, App functionality | No       |
| User IDs (username, account id)                | Yes       | Account management, App functionality | No       |
| Photos                                         | Yes       | App functionality (card images)       | Yes      |
| Purchase history                               | Yes       | App functionality, Account management | Yes      |
| Other user-generated content (posts, comments) | Yes       | App functionality                     | Yes      |
| App interactions (likes, follows, trades)      | Yes       | App functionality                     | Yes      |

No app feature requests location, contacts, advertising ID, health or payment-card
details. Pack reminders are local notifications; no remote push token is registered.
Include security/request logs and optional report text, which can reach the private
Alerts relay. Review the installed Google sign-in SDK's data disclosures too.

Photo uploads use the system picker, without broad photo-library access. Camera
permission stays available for taking card photos. Build 6 blocks broad image/video
and legacy storage permissions, microphone access and screen overlays. Verify the
signed manifest after rebuilding, not only the Expo configuration.

## Purchases by country

In Play Console, set every ticket product and the `supporter` base plan as unavailable in
Belgium (BE) and Brazil (BR). The API also refunds any purchase Google reports from those
countries, and the app hides purchases when its Play Store country is one of them.

## Release

1. Build locally from the repo root with
   `powershell -ExecutionPolicy Bypass -File apps/mobile/scripts/build-apk.ps1 -AppBundle`.
   Signing uses the existing upload key outside Git; no EAS credit is needed.
2. Code 5 is completed on Internal testing. After approval, upload code 6 to replace
   it. Production stays untouched.
3. Four ticket products and `supporter/monthly` are already ACTIVE; do not recreate
   them. Play prices still match the web. Nic wants Android prices reviewed to cover
   the store fee; no replacement prices are approved yet.
4. Use the Play-installed app and license-tester account for test-card purchase,
   restore, renewal, refund and cancellation/expiry. Real Play payments stay disabled
   until those checks pass and Nic approves them.
5. Complete listing assets, review access, content rating, Data safety and the
   closed test required by this account. Follow Console's production-access gate.
