# Monitoring

## Health check

The app exposes:

```text
GET /api/health
```

Expected success response:

```json
{
  "ok": true,
  "checks": {
    "app": true,
    "coreEnv": true,
    "stripeEnv": true
  },
  "timestamp": "2026-06-06T00:00:00.000Z"
}
```

Use this endpoint from an uptime monitor such as Better Stack, UptimeRobot, Pingdom, or Datadog Synthetic Monitoring.

## Environment checks

`/api/health` returns `503` when required core environment variables are missing.

Core variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `OPENAI_API_KEY`

Stripe variables are checked when either:

- `STRIPE_HEALTHCHECK_REQUIRED=1`, or
- any Stripe production variable is present.

Stripe variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_UNLIMITED_MONTHLY` or `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_UNLIMITED_YEARLY` or `STRIPE_PRICE_PRO_YEARLY`

## Optional token

To avoid exposing health details publicly, set:

```env
HEALTHCHECK_TOKEN=
```

Then call the endpoint with either:

```text
GET /api/health?token=<token>
```

or:

```text
x-healthcheck-token: <token>
```

Invalid requests return `401`.

## Recommended alerts

- `/api/health` returns non-200 for 2 consecutive checks.
- Stripe webhook delivery failure rate is above 0.
- Vercel function error count increases on:
  - `/api/stripe/webhook`
  - `/api/stripe/checkout`
  - `/api/generate-triple`
  - `/api/transcribe`
- Gemini or OpenAI errors increase.
- Supabase API errors increase.

## Error monitoring

Sentry is the recommended next step for exception monitoring. Add it once a Sentry project exists, then set at least:

```env
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

Do not enable source map upload until the Sentry project and token are scoped correctly.
