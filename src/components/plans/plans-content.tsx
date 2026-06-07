"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createStripeCheckoutSession, createStripePortalSession, fetchBillingStatus, type BillingStatus } from "@/lib/api-client";
import { PLAN_MONTHLY_JPY, yearlyMonthlyEquivalentJpy, yearlyTotalJpy } from "@/lib/plan-pricing";
import { useAuthSession } from "@/lib/use-auth-session";
import { cn } from "@/lib/utils";

const checkout = {
  topup20: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_TOPUP_20 ?? "",
};

function CheckoutLink({
  href,
  children,
  variant = "default",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "outline" | "secondary";
  className?: string;
}) {
  const ready = href.length > 0;
  if (!ready) {
    return (
      <Button variant="secondary" className={cn("w-full", className)} disabled>
        {children}（Stripe URL を設定してください）
      </Button>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size: "lg" }), "w-full justify-center", className)}
    >
      {children}
    </a>
  );
}

type PlanRow = {
  name: string;
  subtitle: string;
  monthly?: number;
  generationQuota: string;
  dnaSlot: string;
  aiWallDepth: string;
  strategyRange: string;
  dnaEvolution: string;
  tabooStrictness: string;
  target: string;
};

const FREE_PLAN: PlanRow = {
  name: "無料",
  subtitle: "Free",
  generationQuota: "毎日3回まで",
  dnaSlot: "1 Identity（検証の入り口）",
  aiWallDepth: "基本AIアドバイス（標準）",
  strategyRange: "基本4フェーズ（探索・構築・研磨・伝達）",
  dnaEvolution: "標準の実行メモ還流",
  tabooStrictness: "標準ガード",
  target: "まずは小さく事業案を言葉にしたい人",
};

const UNLIMITED_PLAN: PlanRow = {
  name: "使い放題",
  subtitle: "Unlimited",
  monthly: PLAN_MONTHLY_JPY.unlimited,
  generationQuota: "無制限（実用上限: 1日100回）",
  dnaSlot: "Identity スロット無制限",
  aiWallDepth: "上位モデルでConcept Briefを深く整理",
  strategyRange: "基本4フェーズ（探索・構築・研磨・伝達）を回数制限なく利用",
  dnaEvolution: "実行メモ・Identity同期を優先",
  tabooStrictness: "高精度ガード + Identity観点",
  target: "Concept Forge を本気で使い込む人",
};

function FeatureRow({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-muted-foreground">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export function PlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthSession();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [pendingPortal, setPendingPortal] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [autoCheckoutHandled, setAutoCheckoutHandled] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<Billing>("monthly");

  const planLabel = useMemo(() => {
    const tier = billingStatus?.planTier ?? "free";
    if (tier === "pro") return "Unlimited";
    return "Free";
  }, [billingStatus?.planTier]);

  const cycleLabel = useMemo(() => {
    if (billingStatus?.billingCycle === "yearly") return "年払い";
    if (billingStatus?.billingCycle === "monthly") return "月払い";
    return null;
  }, [billingStatus?.billingCycle]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setBillingStatus(null);
      return;
    }
    void fetchBillingStatus()
      .then((status) => {
        if (active) setBillingStatus(status);
      })
      .catch(() => {
        if (active) setBillingStatus(null);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleStartCheckout = useCallback(async (billing: Billing) => {
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(`/plans?checkoutBilling=${billing}`)}`);
      return;
    }
    const key = `pro:${billing}`;
    try {
      setPendingPlan(key);
      const result = await createStripeCheckoutSession({
        planTier: "pro",
        billingCycle: billing,
      });
      window.location.href = result.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "チェックアウトを開始できませんでした";
      if (message.includes("ログイン")) {
        router.push(`/auth?next=${encodeURIComponent(`/plans?checkoutBilling=${billing}`)}`);
      } else {
        window.alert(message);
      }
    } finally {
      setPendingPlan(null);
    }
  }, [router, user]);

  const handleOpenPortal = useCallback(async () => {
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent("/plans")}`);
      return;
    }
    try {
      setPendingPortal(true);
      const result = await createStripePortalSession();
      window.location.href = result.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "契約管理ページを開けませんでした";
      window.alert(message);
    } finally {
      setPendingPortal(false);
    }
  }, [router, user]);

  useEffect(() => {
    if (!user || autoCheckoutHandled) return;
    const checkoutBilling = searchParams.get("checkoutBilling");
    if (checkoutBilling === "monthly" || checkoutBilling === "yearly") {
      setAutoCheckoutHandled(true);
      void handleStartCheckout(checkoutBilling);
      return;
    }
    setAutoCheckoutHandled(true);
  }, [autoCheckoutHandled, handleStartCheckout, searchParams, user]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-violet-200/40 via-background to-background dark:from-violet-950/35" />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-28 pt-4 md:pb-24">
        {user ? (
          <section className="mx-auto mb-6 max-w-4xl rounded-2xl border bg-background/90 p-4 shadow-sm md:mb-8 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                現在のプラン: <span className="font-semibold text-foreground">{planLabel}</span>
                {cycleLabel ? <span className="ml-1">（{cycleLabel}）</span> : null}
              </p>
              <Button variant="outline" onClick={() => void handleOpenPortal()} disabled={pendingPortal}>
                {pendingPortal ? "ポータルへ接続中..." : "契約の管理（お支払い方法・解約）"}
              </Button>
            </div>
          </section>
        ) : null}

        {/* Hero */}
        <section className="mx-auto max-w-3xl space-y-4 pb-6 text-center md:pb-12">
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="mr-1 size-3" />
            Concept Forge Plans
          </Badge>
          <h1 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
            言葉にできない事業案を、
            <br />
            伝わるコンセプトへ。
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            Concept Forge は、まだ輪郭のない構想を、説明できる言葉と実行できる設計へ鍛えるためのツールです。
          </p>
        </section>

        <div className="mb-6 flex justify-center md:mb-8">
          <Tabs
            value={selectedBilling}
            onValueChange={(value) => {
              if (value === "monthly" || value === "yearly") setSelectedBilling(value);
            }}
            className="w-full max-w-sm"
          >
            <TabsList className="h-11 w-full p-1">
              <TabsTrigger value="monthly" className="flex-1 px-4">
                月払い
              </TabsTrigger>
              <TabsTrigger value="yearly" className="flex-1 px-4">
                年払い（20%OFF）
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          <PlanCard
            plan={FREE_PLAN}
            pendingPlan={pendingPlan}
            onStartCheckout={handleStartCheckout}
            currentPlanTier={billingStatus?.planTier ?? "free"}
            onOpenPortal={handleOpenPortal}
            pendingPortal={pendingPortal}
          />
          <PlanCard
            plan={UNLIMITED_PLAN}
            billing={selectedBilling}
            pendingPlan={pendingPlan}
            onStartCheckout={handleStartCheckout}
            currentPlanTier={billingStatus?.planTier ?? "free"}
            onOpenPortal={handleOpenPortal}
            pendingPortal={pendingPortal}
          />
        </section>

        {/* Top-up */}
        <section className="mx-auto mt-16 max-w-2xl rounded-2xl border border-dashed bg-muted/20 p-8 text-center md:mt-20">
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            足りなくなったら、その場で購入。
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            無料プランのまま、今日だけ追加で使いたい時に購入できます。
          </p>
          <div className="mx-auto mt-6 flex w-full max-w-xl flex-col items-center justify-between gap-4 rounded-xl border bg-background/80 px-6 py-5 text-left shadow-sm sm:flex-row">
            <div>
              <p className="text-sm font-medium">20クレジット（約20回の追加生成）</p>
              <p className="text-2xl font-bold tabular-nums">¥500〜</p>
              <p className="text-xs text-muted-foreground">無料プランの不足分を、その日だけ補える追加枠</p>
            </div>
            <CheckoutLink href={checkout.topup20} variant="outline" className="w-full sm:w-auto sm:min-w-44">
              追加枠を購入する
            </CheckoutLink>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Stripe Checkout の Payment Link または Price ID を設定すると有効化されます。
          </p>
        </section>

        <section className="mx-auto mt-12 max-w-3xl rounded-2xl border bg-background/80 p-6">
          <h2 className="text-lg font-semibold">FAQ</h2>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-medium">いつでも解約できますか？</p>
              <p className="text-muted-foreground">
                はい。契約の管理ボタンからStripeカスタマーポータルへ進み、いつでも解約できます。
              </p>
            </div>
            <div>
              <p className="font-medium">データは学習に使われますか？</p>
              <p className="text-muted-foreground">
                ユーザーごとのIdentity運用と機能提供のためにのみ利用し、無断で汎用学習データとして公開利用しません。
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>表示価格・プラン内容は購入時点で画面に表示される条件が適用されます。</p>
          <Link href="/" className="mt-3 inline-block font-medium text-primary underline-offset-4 hover:underline">
            トップへ戻る
          </Link>
        </section>
      </main>
    </div>
  );
}

type Billing = "monthly" | "yearly";

function PlanCard({
  plan,
  billing,
  pendingPlan,
  onStartCheckout,
  currentPlanTier,
  onOpenPortal,
  pendingPortal,
}: {
  plan: PlanRow;
  billing?: Billing;
  pendingPlan?: string | null;
  onStartCheckout?: (billing: Billing) => Promise<void>;
  currentPlanTier?: "free" | "pro";
  onOpenPortal?: () => Promise<void>;
  pendingPortal?: boolean;
}) {
  const isPaid = typeof plan.monthly === "number";
  const monthlyPrice = plan.monthly ?? 0;
  const isUnlimitedCurrent = currentPlanTier === "pro";
  const isYearly = billing === "yearly";
  const priceLabel = !isPaid
    ? "0円 / 月"
    : isYearly
      ? `${yearlyTotalJpy(monthlyPrice).toLocaleString("ja-JP")}円 / 年`
      : `${monthlyPrice.toLocaleString("ja-JP")}円 / 月`;
  const subLabel = !isPaid
    ? "いつでもUnlimitedへアップグレード可能"
    : isYearly
      ? `月あたり ${yearlyMonthlyEquivalentJpy(monthlyPrice).toLocaleString("ja-JP")}円 相当`
      : "いつでも解約可能";

  const pendingKey = `pro:${billing ?? "monthly"}`;
  const loading = pendingPlan === pendingKey;

  return (
    <motion.div
      layout
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="relative flex h-full flex-col"
    >
      <Card
        className={cn("flex h-full flex-col overflow-hidden border bg-card/90 shadow-lg backdrop-blur-sm transition-shadow hover:shadow-xl")}
      >
        <CardHeader className="space-y-1 pb-2 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {plan.subtitle}
          </p>
          <h3 className="text-2xl font-bold">{plan.name}</h3>
          <p className="text-xs text-muted-foreground">{plan.target}</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4 pb-6">
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums tracking-tight">{priceLabel}</p>
            <p className="text-xs text-muted-foreground">{subLabel}</p>
          </div>
          <ul className="flex flex-1 flex-col gap-2 border-t pt-4">
            <FeatureRow>
              <strong className="text-foreground">AI実行回数:</strong> {plan.generationQuota}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">Identityスロット:</strong> {plan.dnaSlot}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">思考の解像度:</strong> {plan.aiWallDepth}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">戦略の射程:</strong> {plan.strategyRange}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">実行メモの還流:</strong> {plan.dnaEvolution}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">My Taboo:</strong> {plan.tabooStrictness}
            </FeatureRow>
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-0 pb-6">
          {isPaid && billing && onStartCheckout ? (
            isUnlimitedCurrent ? (
              <Button
                size="lg"
                variant="outline"
                className="w-full justify-center"
                disabled={pendingPortal}
                onClick={() => {
                  if (onOpenPortal) void onOpenPortal();
                }}
              >
                {pendingPortal ? "ポータルへ接続中..." : "契約の管理（お支払い方法・解約）"}
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full justify-center"
                disabled={loading}
                onClick={() => {
                  void onStartCheckout(billing);
                }}
              >
                {loading ? "Stripeへ接続中..." : "Unlimitedで始める"}
              </Button>
            )
          ) : (
            <Button size="lg" variant="secondary" className="w-full justify-center" disabled>
              現在の無料プラン
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
