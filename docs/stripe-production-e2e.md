# Stripe Production E2E Checklist

Use this checklist before enabling paid plans in production.

## 1. Stripe dashboard

- Create the `Unlimited` product.
- Create a monthly recurring price and copy its `price_...` ID to `STRIPE_PRICE_UNLIMITED_MONTHLY`.
- Create a yearly recurring price and copy its `price_...` ID to `STRIPE_PRICE_UNLIMITED_YEARLY`.
- Confirm the currency and tax settings match the public pricing shown in `/plans`.
- Configure Customer Portal so users can update payment methods and cancel subscriptions.

## 2. Webhook

- Add a production webhook endpoint:
  - `https://<production-domain>/api/stripe/webhook`
- Subscribe to these events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
- Copy the production signing secret to `STRIPE_WEBHOOK_SECRET`.
- Confirm the legacy alias also resolves:
  - `https://<production-domain>/api/webhook/stripe`

## 3. Production environment

Set these values in the hosting provider:

- `NEXT_PUBLIC_APP_URL=https://<production-domain>`
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_PRICE_UNLIMITED_MONTHLY=price_...`
- `STRIPE_PRICE_UNLIMITED_YEARLY=price_...`
- `BILLING_UNLIMITED_MONTHLY_ALLOWANCE_CREDITS=3000`
- `BILLING_UNLIMITED_UPGRADE_PRORATION_CREDITS=500`
- `STRIPE_HEALTHCHECK_REQUIRED=1`

## 4. Checkout flow

- Log in with a real account.
- Open `/plans`.
- Start monthly checkout.
- Complete payment with a real payment method or an approved production test path.
- Confirm Stripe redirects to `/plans?checkout=success`.
- Confirm `/api/billing/status` returns `planTier: "pro"` and `isActive: true`.
- Confirm `profiles.plan_tier` and `profiles.subscription_tier` are `pro`.
- Confirm `subscriptions` has the latest `stripe_subscription_id`, `stripe_customer_id`, `stripe_price_id`, and active status.

## 5. Credit grant flow

- After `invoice.paid`, confirm `credit_ledger` contains a single `monthly_allowance` row for the invoice.
- Replay the same webhook event from Stripe and confirm no duplicate credit row is inserted.
- For an upgrade/proration scenario, confirm `plan_upgrade_proration` is granted once.

## 6. Portal and cancellation

- Open Customer Portal from `/plans`.
- Update payment method and return to the app.
- Cancel the subscription in the portal.
- Confirm a `customer.subscription.updated` or `customer.subscription.deleted` webhook is delivered.
- Confirm the app downgrades the user to free after the subscription becomes inactive.

## 7. Failure cases

- Temporarily use an invalid webhook secret in a non-production environment and confirm webhook verification returns `400`.
- Try opening checkout while logged out and confirm the app redirects to login.
- Try opening the portal for a free user and confirm the app returns a friendly error.

## 8. Post-release monitoring

- Keep the Stripe webhook delivery page open during launch.
- Monitor `/api/health`.
- Watch application logs for:
  - `Webhook 処理に失敗しました`
  - `Stripe customer に紐づく user が見つかりません`
  - `Checkout セッション作成に失敗しました`
