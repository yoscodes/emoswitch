import type Stripe from "stripe";

import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";

function resolvePlanTierFromPriceId(priceId: string | null | undefined): "free" | "basic" | "creator" | "pro" {
  if (!priceId) return "free";
  if (
    priceId === process.env.STRIPE_PRICE_UNLIMITED_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_UNLIMITED_YEARLY ||
    priceId === process.env.STRIPE_PRICE_PRO_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_PRO_YEARLY
  ) {
    return "pro";
  }
  return "free";
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMonthlyAllowanceCredits(): number {
  return readIntEnv("BILLING_UNLIMITED_MONTHLY_ALLOWANCE_CREDITS", 3000);
}

function getUpgradeProrationCredits(): number {
  return readIntEnv("BILLING_UNLIMITED_UPGRADE_PRORATION_CREDITS", 500);
}

async function upsertProfileFromCustomer(params: {
  userId: string | null;
  customerId: string;
  planTier: "free" | "basic" | "creator" | "pro";
  active: boolean;
}) {
  if (params.userId) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        stripe_customer_id: params.customerId,
        plan_tier: params.planTier,
        subscription_tier: params.planTier,
        ai_wall_deep_enabled: params.active && params.planTier !== "free",
      })
      .eq("id", params.userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      stripe_customer_id: params.customerId,
      plan_tier: params.planTier,
      subscription_tier: params.planTier,
      ai_wall_deep_enabled: params.active && params.planTier !== "free",
    })
    .eq("stripe_customer_id", params.customerId);
  if (error) throw error;
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const planTier = resolvePlanTierFromPriceId(priceId);
  let userId = (subscription.metadata?.user_id as string | undefined) ?? null;
  if (!userId) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle<{ id: string }>();
    if (profileError) throw profileError;
    userId = profile?.id ?? null;
  }
  if (!userId) {
    throw new Error("Stripe customer に紐づく user が見つかりません");
  }
  const active = subscription.status === "active" || subscription.status === "trialing";

  const { error: subError } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status: subscription.status,
      plan_tier: planTier,
      subscription_tier: planTier,
      current_period_start: subscription.items.data[0]?.current_period_start
        ? new Date(subscription.items.data[0].current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (subError) throw subError;

  await upsertProfileFromCustomer({
    userId,
    customerId,
    planTier: active ? planTier : "free",
    active,
  });
}

async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return profile?.id ?? null;
}

async function grantCreditsFromInvoice(invoice: Stripe.Invoice) {
  if (!invoice.id) return;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) return;

  const subscriptionLine = invoice.lines.data[0];
  const rawPriceId =
    subscriptionLine?.pricing && "price_details" in subscriptionLine.pricing
      ? subscriptionLine.pricing.price_details?.price
      : null;
  const priceId = typeof rawPriceId === "string" ? rawPriceId : rawPriceId?.id ?? null;
  const planTier = resolvePlanTierFromPriceId(priceId);
  if (planTier !== "pro") return;

  let reason: "monthly_allowance" | "plan_upgrade_proration" | null = null;
  let credits = 0;
  if (invoice.billing_reason === "subscription_update") {
    reason = "plan_upgrade_proration";
    credits = getUpgradeProrationCredits();
  } else if (
    invoice.billing_reason === "subscription_create" ||
    invoice.billing_reason === "subscription_cycle"
  ) {
    reason = "monthly_allowance";
    credits = getMonthlyAllowanceCredits();
  }
  if (!reason || credits <= 0) return;

  const { error } = await supabaseAdmin.from("credit_ledger").insert({
    user_id: userId,
    delta: credits,
    reason,
    note: reason === "monthly_allowance" ? "Unlimited 月次クレジット付与" : "Unlimited アップグレード按分付与",
    metadata: {
      source: "stripe_webhook",
      source_event: "invoice.paid",
      stripe_invoice_id: invoice.id,
      stripe_customer_id: customerId,
      stripe_subscription_id:
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : invoice.parent?.subscription_details?.subscription?.id ?? null,
      stripe_price_id: priceId,
      billing_reason: invoice.billing_reason ?? null,
    },
  });
  if (error) {
    // Unique index guards duplicated invoice delivery. Ignore duplicate-key errors.
    if (error.code === "23505") return;
    throw error;
  }
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const secret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "署名がありません" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook 検証に失敗しました";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            typeof session.subscription === "string" ? session.subscription : session.subscription.id,
          );
          await handleSubscriptionUpdate(subscription);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created":
      case "customer.subscription.deleted": {
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.paid": {
        await grantCreditsFromInvoice(event.data.object as Stripe.Invoice);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook 処理に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
