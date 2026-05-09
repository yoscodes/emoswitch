import { getStripeClient } from "@/lib/stripe";
import { requireAuthenticatedUserFromRequest } from "@/lib/supabase/services";
import { supabaseAdmin } from "@/lib/supabase/server";

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
    const stripe = getStripeClient();
    const appUrl = getAppUrl(request);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle<{ stripe_customer_id: string | null }>();
    if (profileError) throw profileError;

    const customerId = profile?.stripe_customer_id;
    if (!customerId) {
      return Response.json({ error: "Stripeの顧客情報が見つかりませんでした。" }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/plans`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ポータルセッションの作成に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
