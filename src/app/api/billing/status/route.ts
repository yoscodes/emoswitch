import { requireAuthenticatedUserFromRequest } from "@/lib/supabase/services";
import { supabaseAdmin } from "@/lib/supabase/server";

type PlanTier = "free" | "pro";
type BillingCycle = "monthly" | "yearly" | null;

function normalizePlanTier(value: string | null | undefined): PlanTier {
  if (value === "basic" || value === "creator" || value === "pro") return "pro";
  return "free";
}

function resolveBillingCycleFromPriceId(priceId: string | null | undefined): BillingCycle {
  if (!priceId) return null;
  if (
    priceId === process.env.STRIPE_PRICE_UNLIMITED_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_PRO_MONTHLY
  ) {
    return "monthly";
  }
  if (
    priceId === process.env.STRIPE_PRICE_UNLIMITED_YEARLY ||
    priceId === process.env.STRIPE_PRICE_PRO_YEARLY
  ) {
    return "yearly";
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUserFromRequest(request);
    const [{ data: profile, error: profileError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("plan_tier, subscription_tier")
        .eq("id", user.id)
        .single<{ plan_tier: string | null; subscription_tier: string | null }>(),
      supabaseAdmin
        .from("subscriptions")
        .select("status, plan_tier, subscription_tier, stripe_price_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .overrideTypes<Array<{ status: string; plan_tier: string; subscription_tier: string; stripe_price_id: string | null }>>(),
    ]);
    if (profileError) throw profileError;
    if (subscriptionsError) throw subscriptionsError;

    const latestSub = subscriptions?.[0];
    const isActive = latestSub != null && (latestSub.status === "active" || latestSub.status === "trialing");
    const planTier = isActive
      ? normalizePlanTier(latestSub.subscription_tier ?? latestSub.plan_tier)
      : normalizePlanTier(profile.subscription_tier ?? profile.plan_tier);
    const billingCycle = isActive ? resolveBillingCycleFromPriceId(latestSub.stripe_price_id) : null;

    return Response.json({ status: { planTier, billingCycle, isActive } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "課金状態の取得に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
