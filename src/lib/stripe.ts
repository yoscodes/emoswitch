import Stripe from "stripe";

export type PlanTier = "basic" | "creator" | "pro";
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
  const key = `STRIPE_PRICE_${planTier.toUpperCase()}_${billingCycle.toUpperCase()}`;
  return requiredEnv(key);
}
