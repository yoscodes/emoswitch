import Stripe from "stripe";

export type PlanTier = "pro";
export type BillingCycle = "monthly" | "yearly";

let stripeClient: Stripe | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} が設定されていません`);
  }
  return value;
}

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
  }
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  return requiredEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripePriceId(planTier: PlanTier, billingCycle: BillingCycle): string {
  if (planTier !== "pro") {
    throw new Error("サポート対象外のプランです");
  }
  if (billingCycle === "monthly") {
    return process.env.STRIPE_PRICE_UNLIMITED_MONTHLY || requiredEnv("STRIPE_PRICE_PRO_MONTHLY");
  }
  return process.env.STRIPE_PRICE_UNLIMITED_YEARLY || requiredEnv("STRIPE_PRICE_PRO_YEARLY");
}
