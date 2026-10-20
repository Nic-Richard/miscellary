# Billing

Website sales are enabled. Stripe is the selected website provider, with Xsolla as
the fallback; Android needs Google Play Billing.
Our own accounts, ticket ledger and paid-period benefits remain authoritative.

## Launch status and remaining Android checks

- Nic confirms separate written Stripe approval is not a launch requirement. Confirm
  the selected account's Managed Payments availability, or settle the ordinary Stripe
  tax setup before changing the integration mode.
- Set up Google Play products, the service account and notifications (below), make the
  products unavailable in Belgium and Brazil, then test with licence testers on an
  internal-testing build.
- Stripe sandbox checkout, tax, renewal, cancellation, refund and closure checks pass,
  including Checkout billing-country data. Automatic Managed Payments renewal grants
  another 100 tickets and 10 bonus packs for the next contiguous paid month; duplicate
  initial and renewal invoice events do not repeat grants. These checks do not establish
  ongoing product eligibility.
- Read the updated terms and privacy pages and set their effective date at launch.
- Approve costs, configuration and deployment separately.

Current configuration: Miscellary's separate live Stripe account has its five
products/prices and customer portal. Its API key and webhook signing secret are in
the existing AWS `miscellary/app` secret and the ignored `.env.deploy` file. The
production API now has the new configuration and pack economy. Nic approves enabling
website sales after the renewal check. Do not reuse TraceTray's key. Google Play purchases
remain disabled until their separate setup and licence-tester checks pass.

The live webhook is registered at `/api/v1/billing/stripe/webhook/`, with snapshot
API version `2026-09-30.endive` matching the Python SDK. It is enabled: a real
expired-checkout event redelivered by Stripe returns 204 and creates one receipt.
Both live ticket and membership Managed Payments validation sessions
are accepted and immediately expired without payment. Products use
`txcd_10000000` (General - Electronically Supplied Services), rather than claiming
the virtual tickets have an expiry. This is one of Stripe's supported digital
service classifications; API acceptance does not replace ongoing eligibility checks.

The separate Miscellary sandbox is now connected through `apps/api/.env`. Its five
products have the USD prices below, and its portal allows payment-detail updates,
invoice history and cancellation at the paid-period end, with plan changes disabled.
Sandbox Managed Payments Checkout creation succeeds through the actual application
code for both tickets and membership. Nic completes both hosted sandbox payments;
their actual provider events grant the disposable local account 125 purchased
tickets, 100 membership tickets and 10 bonus packs. Replays do not duplicate grants.
A sandbox ticket refund reverses its grant, and period-end cancellation retains
paid benefits while stopping renewal. App closure cancels the sandbox subscription.
These events are retrieved and processed locally, not delivered through a public
webhook. Actual HTTP delivery is subsequently verified with the harmless live
expired-checkout event above. A subsequent disposable test-clock subscription uses
the real Managed Payments Checkout and automatically pays its next monthly invoice.
Both actual paid-invoice events pass through the local Django webhook HTTP handler
with valid test signatures, including duplicate delivery. The two paid periods are
contiguous, each has 10 bonus packs, the balance totals 200 tickets, and no billing
review is created. The simulation and local test account are removed afterwards.
Public HTTP delivery of a paid invoice and a completed live purchase remain untested.
The sandbox used streamed video-game tax codes during
these checks; the live products use the general digital-service classification above.

The API accepts standard (`sk_`) and restricted (`rk_`) secret keys. Both live key
types remain blocked until `STRIPE_LIVE_APPROVED` is enabled.

Terraform now supports `stripe_configured`, `stripe_price_ids` and
`stripe_portal_configuration`. Before enabling `stripe_configured`, add
`stripe_secret_key` and `stripe_webhook_secret` to the existing `miscellary/app`
JSON secret without replacing its other fields. Terraform references the keys;
it does not store their values in configuration or state. The deployed settings
set `stripe_configured`, `stripe_live_approved`, `monetization_enabled` and
`stripe_checkout_enabled` true. Play Billing remains off.
The API service allows 120 seconds for workers to start before enforcing load
balancer health checks.

## Pack economy

The approved rebalance applies to free, points, tickets and membership packs alike.
Each pull uses the same rarity odds; missing tiers fall back to the next lower tier,
and the purchase quote discloses the effective set and per-card odds.

| Rarity    | Per-pull odds | Recycle points per duplicate |
| --------- | ------------- | ---------------------------- |
| Common    | 68%           | 1                            |
| Uncommon  | 22%           | 2                            |
| Rare      | 7%            | 5                            |
| Epic      | 2.25%         | 10                           |
| Legendary | 0.75%         | 20                           |

Extra packs still cost 50 points/tickets, with existing mixed-payment rules. Pack
sizes, card rarities, owned cards and existing points balances are unchanged.

## Account closure and provider cleanup

Web Account and Android Settings both require the current password or a fresh,
account-bound Google confirmation. Closure cancels Stripe/Play billing before
deactivating the account, revokes refresh sessions and removes private collections,
drafts and feedback. Published cards, pack artwork and public threads remain under
a deleted-user label.

Migration `accounts.0011_account_cleanup` adds a durable queue for bot-alert and
private-upload removal. The production entrypoint runs
`python manage.py process_account_cleanup --watch` beside Gunicorn; one-off task
overrides still run without starting either service. Local development can run
`docker compose exec api uv run python manage.py process_account_cleanup`.
Failures preserve progress and retry automatically. Completed cleanup identifiers
expire after 30 days. Use stable account/report/payment references; never erase
alerts by username alone, since names can be reused. Unidentifiable older messages
need review rather than broad matching.

Deploy the relay's authenticated `/erase` route first and verify Miscellary channel
history permissions. Back up the production database, apply the migration and
deploy the API and legal pages, then verify closure with a newly disposable account.
Do not delete `nicqa`, a demo owner, a reviewer or a real collector as a test. Provider
tests remain mocked until that deployment is approved. Confirm media-cache and
backup retention as part of the live privacy check.

Purchases are refused in `PURCHASE_BLOCKED_COUNTRIES` (Belgium and Brazil, in
`common/monetization.py`). Play purchases from there are refunded through the Orders API;
website payments whose billing country is listed are refunded automatically and logged as a
resolved review. The website hides purchases using Vercel's country header (`/region`), the
app using its Play Store country.

## Website configuration

Configure the API, not the browser. There is no public Stripe key or card form in
Miscellary; the API returns the hosted Checkout or customer portal URL.

| Variable                      | Purpose                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `MONETIZATION_ENABLED`        | Ticket spending, monthly allowances and supporter features; defaults false                    |
| `STRIPE_CHECKOUT_ENABLED`     | New website purchases; defaults false                                                         |
| `STRIPE_LIVE_APPROVED`        | Explicit live-key/event gate; defaults false, pending all release checks                      |
| `STRIPE_SECRET_KEY`           | Server-only test/live secret                                                                  |
| `STRIPE_WEBHOOK_SECRET`       | Server-only signing secret for this endpoint                                                  |
| `STRIPE_PRICE_IDS`            | JSON map of internal products to fixed USD Stripe price IDs                                   |
| `STRIPE_PORTAL_CONFIGURATION` | Portal configuration with cancellation at paid-period end                                     |
| `STRIPE_RETURN_URL`           | Fixed HTTPS account URL, without query/fragment; defaults to `https://miscellary.com/account` |
| `STRIPE_MANAGED_PAYMENTS`     | Defaults true; ordinary Stripe requires a separately agreed tax/compliance setup              |

Products are `credits_125` ($5), `credits_275` ($10), `credits_600` ($20),
`credits_1500` ($50) and `subscription` ($4.99 every month). No annual, trial,
quantity changes, promo codes or subscription upgrades are implemented. Configure
tax-exclusive USD pricing and the provider-approved product tax codes. Disable
portal price/quantity changes; cancellation must retain the current paid period.
The server rejects unexpected currency, amount, quantity or recurrence.

Register `/api/v1/billing/stripe/webhook/` for:

- `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.expired`
- `invoice.paid`
- `customer.subscription.updated`, `customer.subscription.deleted`
- `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`

Use the SDK-compatible snapshot API version and verify its invoice/session fields
in sandbox. The signature covers the raw request body with the SDK timestamp
tolerance. Events and provider payment references both deduplicate fulfillment.
Temporary failures roll back the event receipt so Stripe can retry. Payments
that can never match their purchase are acknowledged and queued for review. Returning to
the website never grants tickets or confirms success by itself.

Purchase intents/customer binding survive ambiguous checkout failures; retries reuse
the same request key, price, metadata and expiry. Account locks serialize spending,
checkout creation and closure. Renewal benefits come only from verified paid invoices;
normal cancellation preserves benefits through their paid expiry. Subscription
updates read current provider state rather than trusting an old event's status.

Account closure expires owned checkout sessions and cancels website subscriptions
before closing the local account. Provider failure leaves the account open for retry.
Late payments to closed accounts go to the review queue rather than disappearing
or granting spendable tickets. Financial history is read-only in Django admin.

To pause new website sales, disable `STRIPE_CHECKOUT_ENABLED`; retain the provider
configuration, webhook and portal so existing payments and cancellations still work.
Do not use the global feature flag as a routine sales pause after launch.

## Refunds and disputes

A refund takes back the refunded share of the tickets that payment granted, even when
they were already spent, so the balance can go negative. Cards are never taken back,
since they may have been traded on, and other collectors keep the creator rewards they
earned. A fully refunded membership month ends at once and loses its bonus packs.
A collector with a negative balance can't send, counter or accept trades until new
tickets bring it back to zero; others can still send them offers, which keeps the
reason private. Opening a dispute takes the tickets back and queues a review so a
person answers it; a won dispute returns them. Refunds that can't be matched to a
purchase go to the review queue.

## Creator statistics

Studio keeps the basic counts and monthly publication usage visible; supporter details are
expandable. Activity covers 30 UTC calendar days, including quiet days. Pack types and tickets
rewards use the existing opening/ledger records. Current collection progress counts unique
cards held by each collector, so duplicates do not inflate it and trades/recycling change it.
Complete binders require every card in the set. Most-liked cards use existing card reactions;
there is no new popularity score or paid ranking boost. Reads use grouped queries, not one
query per set, and return no collector identities. Set/card links use the existing binders
and card inspectors. Publishing notices reuse the same allowance as server enforcement.

## Android

No Stripe checkout/portal links are shown in the Android app. The website endpoints
reject non-web platform requests; that header is a UI/store-policy boundary, not
payment verification. Android purchases go through Google Play Billing (`expo-iap`),
and the API checks every purchase with Google before granting anything.

The app passes each purchase an account code (an HMAC of the account id) and sends the
purchase token to `/api/v1/me/billing/play/`. The API reads the purchase from the Play
Developer API, checks the account code, grants through the same ledger as Stripe
(reference `play:<order id>`) and acknowledges it, so Google never auto-refunds a granted
purchase. The app then consumes ticket purchases so they can be bought again. Purchases
interrupted before that are picked up the next time the membership screen opens. A paid
purchase the account can't take (for example a second membership) goes to the review queue.

Membership months come from the subscription's current paid order. Play reports when a
month ends, so each renewal starts where the last one ended. Refunds and chargebacks
reverse the order's grant exactly like Stripe refunds. Closing an account cancels its Play
subscription.

| Variable                    | Purpose                                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `PLAY_BILLING_ENABLED`      | Shows Play purchases in the app; defaults false                         |
| `PLAY_LIVE_APPROVED`        | Accept real (non-tester) purchases; defaults false                      |
| `PLAY_PACKAGE_NAME`         | Defaults to `com.miscellary.app`                                        |
| `PLAY_SERVICE_ACCOUNT`      | Server-only service account JSON key with Play Console financial access |
| `PLAY_SUBSCRIPTION_ID`      | Subscription product id; defaults to `supporter`                        |
| `PLAY_RTDN_AUDIENCE`        | Audience set on the Pub/Sub push subscription                           |
| `PLAY_RTDN_SERVICE_ACCOUNT` | Service account email Pub/Sub signs pushes with                         |

Setup in Play Console (no cost for the API; Pub/Sub's free tier covers this volume):

1. Create in-app products `credits_125`, `credits_275`, `credits_600`, `credits_1500` and a
   subscription `supporter` with one monthly auto-renewing base plan. Match the website prices.
2. In Google Cloud, enable the Google Play Android Developer API, create a service account
   and a JSON key, and invite its email in Play Console with view-financial-data and
   manage-orders permissions.
3. Create a Pub/Sub topic, grant `google-play-developer-notifications@system.gserviceaccount.com`
   publish rights, and set it under Monetization setup > Real-time developer notifications.
   Add a push subscription to `https://<api>/api/v1/billing/play/notify/` with authentication
   enabled; use its audience and service account for the two RTDN settings above.
4. Schedule `python manage.py sync_play_refunds` daily as a backstop for missed notifications.
5. Add licence testers and test on an internal-testing build before setting `PLAY_LIVE_APPROVED`.

## Local preview

Only the development Docker stack may create sample entitlements. No browser grant
endpoint or fake purchase callback exists. In PowerShell:

```powershell
$env:MONETIZATION_ENABLED = 'true'
$env:MONETIZATION_PREVIEW = 'true'
$env:LOUNGE_ENABLED = 'true'
docker compose up -d --build api web
docker compose exec api uv run python manage.py preview_monetization
```

The normal local catalogue must already exist. The command refuses production settings,
remote databases, enabled checkout and conflicting usernames. It creates labelled
`previewfree`, `previewsupporter` and `previewcancelled` accounts at `@preview.invalid`,
password `preview-only-password`, with sample tickets, followed sets, cards and discussions.
Repeating it does not reset spending, packs, points or posted content. Monthly sample
subscription grants deduplicate by calendar month. It never modifies other accounts,
calls a payment provider or downloads media. Preview controls display prices but cannot
start checkout. The preview is local test data, not provider or real-device validation.

## Lounge

`LOUNGE_ENABLED` defaults false. Set `NEXT_PUBLIC_LOUNGE_ENABLED` on web and
`EXPO_PUBLIC_LOUNGE_ENABLED` on native to show the navigation entry when launching it.
Public reads are paginated; verified collectors can post, reply and like. Free posts
may contain one owned card; active subscribers may show six in plain or binder
layouts. Cards traded away, recycled or platform-removed become placeholders;
creator-deleted sets still allow collectors to showcase their retained cards. Expiry
keeps content but stops displaying subscriber styles.

New sorts by posting time; Active sorts by latest reply; Top sorts by current likes
among posts created in the last 24 hours, 7 days, 30 days or all time. Threading has
one reply level. Feed titles and reply counts open a dedicated discussion page on
web/native, with the full post and reply composer above the threaded conversation.
Removal keeps a tombstone and existing replies; moderators use
the existing report queue and Lounge admin removal actions. Hard-delete actions are
disabled there. Posting/reply/vote/block rate limits apply equally to paid collectors.

Blocking is explicitly Lounge-only, mutual for posts/replies/likes, and reversible.
It does not silently change existing trading, set comments or follows. Review whether
broader blocking is needed for store submission; no store-compliance claim is made.
Closing an account clears its private block list and Lounge likes; posts and replies
remain under the same anonymized account treatment as existing public comments.

## References

- [Managed Payments setup](https://docs.stripe.com/payments/managed-payments/set-up)
- [Eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)
- [Subscription events](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Webhook verification](https://docs.stripe.com/webhooks)

## Complimentary Supporter and ticket grants

Staff with the corresponding Billing add/view permissions can use Django admin:

- **Ticket grants -> Add:** select a collector, enter whole tickets and a reason.
  The UUID identifies this grant. Retrying its command reference cannot add it twice.
- **Complimentary supporters -> Add:** select a collector and reason. Leave expiry
  empty for ongoing access, or choose a future date. The list action **Revoke
  complimentary Supporter access** ends the entitlement and records the operator.
  Already granted tickets remain. Closed accounts cannot receive either benefit.

Grant records cannot be edited/deleted through admin. Ticket credits use the existing
locked balance/ledger with kind `gift`, without a payment receipt, purchase alert or
fake Stripe/Google order. Actor is recorded for staff grants; trusted management
commands and automatic monthly benefits have no staff actor.

Complimentary Supporter provides the normal features and, on first use each UTC
calendar month, the usual 100 monthly tickets and 10 bonus packs. Only the current
month is credited; missed months are not backfilled. Existing paid periods take
precedence and remain managed by their actual provider. Complimentary periods have
no payment grant and do not add paid-month emblem tiers. Public profile visibility
is cached until the grant expires (the maximum date represents ongoing access).
Web and Android show **Complimentary Supporter** without renewal/billing controls.

From a trusted API environment, grant access and/or tickets atomically:

```sh
python manage.py grant_account_access play-review@miscellary.com \
  --supporter --tickets 10000 \
  --reference 30e7330a-e03b-4c1e-b8e6-141dc1323215 \
  --reason "Google Play reviewer access"
```

Keep that reference when retrying this reviewer grant. Use a new UUID for an
intentional additional ticket grant; `--supporter` is unnecessary for a top-up.
`--actor STAFF_USERNAME` records an active staff operator when applicable. The
reference is bound to the recipient/amount/reason and does not reactivate a revoked
grant. There is no public client grant endpoint.

Apply migration `billing.0008_complimentary_grants` via the normal GitHub API
deployment before running this command. Back up the target account's balance,
existing grants and Supporter state before a production data change. A Fargate
management task is a separate one-time operation, not an API deployment shortcut.
