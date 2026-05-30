import { requireAuthenticatedUserFromRequest } from "@/lib/supabase/services";
import { supabaseAdmin } from "@/lib/supabase/server";

type CreditLedgerBillingRow = {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type SubscriptionBillingRow = {
  status: string;
  plan_tier: string;
  subscription_tier: string | null;
  current_period_end: string | null;
  stripe_price_id: string | null;
};

const BILLING_REASONS = ["monthly_allowance", "plan_upgrade_proration", "topup", "admin_seed"] as const;

function reasonLabel(reason: string): string {
  if (reason === "monthly_allowance") return "月次自動付与";
  if (reason === "plan_upgrade_proration") return "アップグレード按分付与";
  if (reason === "topup") return "追加クレジット";
  if (reason === "admin_seed") return "初期/管理付与";
  return reason;
}

function normalizeCycle(priceId: string | null | undefined): "monthly" | "yearly" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_UNLIMITED_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
    return "monthly";
  }
  if (priceId === process.env.STRIPE_PRICE_UNLIMITED_YEARLY || priceId === process.env.STRIPE_PRICE_PRO_YEARLY) {
    return "yearly";
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUserFromRequest(request);
    const [{ data: ledgerRows, error: ledgerError }, { data: subscriptions, error: subscriptionError }] =
      await Promise.all([
        supabaseAdmin
          .from("credit_ledger")
          .select("id, delta, reason, note, metadata, created_at")
          .eq("user_id", user.id)
          .in("reason", [...BILLING_REASONS])
          .order("created_at", { ascending: false })
          .limit(12)
          .overrideTypes<CreditLedgerBillingRow[]>(),
        supabaseAdmin
          .from("subscriptions")
          .select("status, plan_tier, subscription_tier, current_period_end, stripe_price_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .overrideTypes<SubscriptionBillingRow[]>(),
      ]);

    if (ledgerError) throw ledgerError;
    if (subscriptionError) throw subscriptionError;

    const latest = subscriptions?.[0] ?? null;
    const isActive = latest != null && (latest.status === "active" || latest.status === "trialing");
    const nextGrantAt = isActive ? latest.current_period_end : null;

    return Response.json({
      nextGrant: {
        enabled: isActive,
        planTier: latest?.subscription_tier ?? latest?.plan_tier ?? "free",
        billingCycle: normalizeCycle(latest?.stripe_price_id),
        nextGrantAt,
      },
      rows: (ledgerRows ?? []).map((row) => ({
        id: row.id,
        delta: row.delta,
        reason: row.reason,
        label: reasonLabel(row.reason),
        note: row.note,
        createdAt: row.created_at,
        stripeInvoiceId:
          typeof row.metadata?.stripe_invoice_id === "string" ? row.metadata.stripe_invoice_id : null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "決済履歴の取得に失敗しました";
    const status = message.includes("ログイン") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
