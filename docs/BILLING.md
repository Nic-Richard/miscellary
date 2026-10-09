# Billing

Local implementation only. Sales are disabled by default. Stripe is the selected
website provider, with Xsolla as the fallback; Android needs Google Play Billing.
Our own accounts, Stars ledger and paid-period benefits remain authoritative.

## Before enabling sales

- Obtain written acceptance of random digital packs, user-created sets, card trading
  and closed-loop creator rewards. No cash-out or card resale does not by itself
  establish provider eligibility. Managed Payments eligibility is still unconfirmed.
- Agree the spent-Star refund policy and implement compensating ledger entries,
  creator-reward adjustments and subscription refund handling. Refunds/disputes are
  currently recorded for review, not automatically reversed. Do not enable live sales.
- Finish Google Play receipt verification/purchase restoration and native store controls.
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
| `MONETIZATION_ENABLED`        | Stars spending, monthly allowances and supporter features; defaults false                     |
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
- `charge.refunded`, `charge.dispute.created`

Use the SDK-compatible snapshot API version and verify its invoice/session fields
in sandbox. The signature covers the raw request body with the SDK timestamp
tolerance. Events and provider payment references both deduplicate fulfillment.
Failed processing rolls back the event receipt so Stripe can retry. Returning to
the website never grants Stars or confirms success by itself.

Purchase intents/customer binding survive ambiguous checkout failures; retries reuse
the same request key, price, metadata and expiry. Account locks serialize spending,
checkout creation and closure. Renewal benefits come only from verified paid invoices;
normal cancellation preserves benefits through their paid expiry. Subscription
updates read current provider state rather than trusting an old event's status.

Account closure expires owned checkout sessions and cancels website subscriptions
before closing the local account. Provider failure leaves the account open for retry.
Late payments to closed accounts go to the review queue rather than disappearing
or granting spendable Stars. Financial history is read-only in Django admin.

To pause new website sales, disable `STRIPE_CHECKOUT_ENABLED`; retain the provider
configuration, webhook and portal so existing payments and cancellations still work.
Do not use the global feature flag as a routine sales pause after launch.

## Creator statistics

Studio keeps the basic counts and monthly publication usage visible; supporter details are
expandable. Activity covers 30 UTC calendar days, including quiet days. Pack types and Stars
rewards use the existing opening/ledger records. Current collection progress counts unique
cards held by each collector, so duplicates do not inflate it and trades/recycling change it.
Complete binders require every card in the set. Most-liked cards use existing card reactions;
there is no new popularity score or paid ranking boost. Reads use grouped queries, not one
query per set, and return no collector identities. Set/card links use the existing binders
and card inspectors. Publishing notices reuse the same allowance as server enforcement.

## Android

No Stripe checkout/portal links are shown in the Android app. The website endpoints
reject non-web platform requests; that header is a UI/store-policy boundary, not
payment verification. Google Play purchase tokens must be verified independently
on the API before granting the same internal products and entitlements.

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
password `preview-only-password`, with sample Stars, followed sets, cards and discussions.
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
