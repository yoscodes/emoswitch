import { z } from "zod";

import { requireAuthenticatedUserFromRequest } from "@/lib/supabase/services";
import { getStripeClient, getStripePriceId, type BillingCycle, type PlanTier } from "@/lib/stripe";

const checkoutSchema = z.object({
  planTier: z.enum(["basic", "creator", "pro"]),
  billingCycle: z.enum(["monthly", "yearly"]),
});

function getAppUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.trim() !== "") {
    return configured.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUserFromRequest(request);
    const json = await request.json();
    const payload = checkoutSchema.parse(json);
    const stripe = getStripeClient();
    const appUrl = getAppUrl(request);
    const priceId = getStripePriceId(payload.planTier as PlanTier, payload.billingCycle as BillingCycle);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${appUrl}/plans?checkout=success`,
      cancel_url: `${appUrl}/plans?checkout=cancel`,
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan_tier: payload.planTier,
        billing_cycle: payload.billingCycle,
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return Response.json({ error: "Stripe セッションURLの作成に失敗しました" }, { status: 500 });
    }

    return Response.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Checkout セッション作成に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
