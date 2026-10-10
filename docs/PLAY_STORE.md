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

Data is encrypted in transit. Users can ask for deletion (in-app and by email). No data is
shared with third parties for their own use; Stripe, Google Play and hosting providers process
it on Miscellary's behalf, which the form does not count as sharing.

| Data type                                      | Collected | Purpose                               | Optional |
| ---------------------------------------------- | --------- | ------------------------------------- | -------- |
| Email address                                  | Yes       | Account management, App functionality | No       |
| User IDs (username, account id)                | Yes       | Account management, App functionality | No       |
| Photos                                         | Yes       | App functionality (card images)       | Yes      |
| Purchase history                               | Yes       | App functionality, Account management | Yes      |
| Other user-generated content (posts, comments) | Yes       | App functionality                     | Yes      |
| App interactions (likes, follows, trades)      | Yes       | App functionality                     | Yes      |

Not collected by the app: location, contacts, device IDs, advertising ID, crash logs,
financial account details (payment providers handle cards), health, messages. Pack reminders
are local notifications, so no push token is collected.

## Purchases by country

In Play Console, set every ticket product and the `supporter` base plan as unavailable in
Belgium (BE) and Brazil (BR). The API also refunds any purchase Google reports from those
countries, and the app hides purchases when its Play Store country is one of them.

## Release

1. Build the production AAB with EAS and upload it to Internal testing.
2. Create the products (see BILLING.md), add licence testers, test purchases, a refund and a
   cancellation on a real phone.
3. Promote to Closed or Production. New personal developer accounts must run a closed test
   with at least 12 testers for 14 days before production access; check Play Console.
