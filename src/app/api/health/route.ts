export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORE_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEY",
] as const;

function hasValue(name: string): boolean {
  return (process.env[name] ?? "").trim() !== "";
}

function hasMonthlyStripePrice(): boolean {
  return hasValue("STRIPE_PRICE_UNLIMITED_MONTHLY") || hasValue("STRIPE_PRICE_PRO_MONTHLY");
}

function hasYearlyStripePrice(): boolean {
  return hasValue("STRIPE_PRICE_UNLIMITED_YEARLY") || hasValue("STRIPE_PRICE_PRO_YEARLY");
}

function shouldCheckStripe(): boolean {
  if (process.env.STRIPE_HEALTHCHECK_REQUIRED === "1") return true;
  return [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_UNLIMITED_MONTHLY",
    "STRIPE_PRICE_UNLIMITED_YEARLY",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_YEARLY",
  ].some(hasValue);
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.HEALTHCHECK_TOKEN;
  if (!expected) return true;

  const url = new URL(request.url);
  const provided = request.headers.get("x-healthcheck-token") ?? url.searchParams.get("token");
  return provided === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const coreEnvOk = CORE_ENV_KEYS.every(hasValue);
  const stripeEnvOk = !shouldCheckStripe() || (
    hasValue("STRIPE_SECRET_KEY") &&
    hasValue("STRIPE_WEBHOOK_SECRET") &&
    hasMonthlyStripePrice() &&
    hasYearlyStripePrice()
  );
  const ok = coreEnvOk && stripeEnvOk;

  return Response.json(
    {
      ok,
      checks: {
        app: true,
        coreEnv: coreEnvOk,
        stripeEnv: stripeEnvOk,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
