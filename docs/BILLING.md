# Billing

Local implementation only. Sales are disabled by default. Stripe is the selected
website provider, with Xsolla as the fallback; Android needs Google Play Billing.
Our own accounts, ticket ledger and paid-period benefits remain authoritative.

## Before enabling sales

- Obtain written acceptance of random digital packs, user-created sets, card trading
  and closed-loop creator rewards. No cash-out or card resale does not by itself
  establish provider eligibility. Managed Payments eligibility is still unconfirmed.
- Set up Google Play products, the service account and notifications (below), then test
  with licence testers on an internal-testing build.
- Review Lounge moderation operations and account-blocking scope before store submission.
- Update terms, privacy, creator publishing agreement/notice and store disclosures.
- Run real sandbox checkout, tax, renewal, cancellation, refund and closure tests.
  Offline tests do not establish that the Stripe account or products are eligible.
- Approve costs, configuration and deployment separately. No provider account,
  product, secret, external request for approval or real transaction has been created.

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
