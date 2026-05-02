"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createStripeCheckoutSession } from "@/lib/api-client";
import { PLAN_MONTHLY_JPY, yearlyMonthlyEquivalentJpy, yearlyTotalJpy } from "@/lib/plan-pricing";
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
  planTier: "basic" | "creator" | "pro";
  monthly: number;
  dnaSlot: string;
  aiWallDepth: string;
  strategyRange: string;
  vaultDepth: string;
  tabooStrictness: string;
  target: string;
  featured?: boolean;
};

const PLANS: PlanRow[] = [
  {
    name: "ベーシック",
    subtitle: "Basic",
    planTier: "basic",
    monthly: PLAN_MONTHLY_JPY.basic,
    dnaSlot: "1 Identity（1プロジェクト）",
    aiWallDepth: "標準アドバイス（基礎的な壁打ち）",
    strategyRange: "単発検証中心（素早い仮説テスト）",
    vaultDepth: "直近10件までの反応分析",
    tabooStrictness: "標準タブー検知",
    target: "まず1つの事業仮説を育てたい人",
  },
  {
    name: "クリエイター",
    subtitle: "Creator",
    planTier: "creator",
    monthly: PLAN_MONTHLY_JPY.creator,
    dnaSlot: "3 Identities（複数の顔を並行運用）",
    aiWallDepth: "高解像度AI Wall（深掘り壁打ち）",
    strategyRange: "単発 + 30日連動ロードマップ",
    vaultDepth: "全履歴分析 + DNA自動還流（ROOTS同期優先）",
    tabooStrictness: "厳密タブー検知（思想汚染を抑制）",
    target: "複数テーマを継続検証する起業家",
    featured: true,
  },
  {
    name: "プロ",
    subtitle: "Pro",
    planTier: "pro",
    monthly: PLAN_MONTHLY_JPY.pro,
    dnaSlot: "Identity 無制限",
    aiWallDepth: "最深解析 + 生存シミュレーション",
    strategyRange: "全戦略テンプレ + 高度検証オペレーション",
    vaultDepth: "全履歴分析 + 高優先ROOTS同期 + Prophecy深掘り",
    tabooStrictness: "最厳格タブー検知（思想の一貫性を保護）",
    target: "事業を複線で伸ばし続けるプロ向け",
  },
];

function FeatureRow({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-muted-foreground">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export function PlansContent() {
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  const handleStartCheckout = async (planTier: "basic" | "creator" | "pro", billing: Billing) => {
    const key = `${planTier}:${billing}`;
    try {
      setPendingPlan(key);
      const result = await createStripeCheckoutSession({
        planTier,
        billingCycle: billing,
      });
      window.location.href = result.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "チェックアウトを開始できませんでした";
      window.alert(message);
    } finally {
      setPendingPlan(null);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-violet-200/40 via-background to-background dark:from-violet-950/35" />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-28 pt-4 md:pb-24">
        {/* Hero */}
        <section className="mx-auto max-w-3xl space-y-4 pb-6 text-center md:pb-12">
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="mr-1 size-3" />
            Persona DNA Plans
          </Badge>
          <h1 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
            Persona DNA を、
            <br />
            積み上がる事業資産にする。
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            生成回数ではなく、Identityの深さ・分析の解像度・市場反応の還流速度で選ぶプラン設計です。
          </p>
        </section>

        {/* Billing tabs + cards */}
        <Tabs defaultValue="monthly" className="w-full">
          <div className="mb-8 flex justify-center">
            <TabsList className="h-11 p-1">
              <TabsTrigger value="monthly" className="px-4">
                月払い
              </TabsTrigger>
              <TabsTrigger value="yearly" className="px-4">
                年払い（20%OFF）
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="monthly" className="mt-0 outline-none">
            <PlanGrid billing="monthly" pendingPlan={pendingPlan} onStartCheckout={handleStartCheckout} />
          </TabsContent>
          <TabsContent value="yearly" className="mt-0 outline-none">
            <PlanGrid billing="yearly" pendingPlan={pendingPlan} onStartCheckout={handleStartCheckout} />
          </TabsContent>
        </Tabs>

        {/* Top-up */}
        <section className="mx-auto mt-16 max-w-2xl rounded-2xl border border-dashed bg-muted/20 p-8 text-center md:mt-20">
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            追加の実験枠が必要なときだけ
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            このアプリの主価値は「DNA資産の深さ」ですが、短期的な検証量の増加にも対応できます。
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            <div className="rounded-xl border bg-background/80 px-6 py-4 text-left shadow-sm">
              <p className="text-sm font-medium">20クレジット</p>
              <p className="text-2xl font-bold tabular-nums">¥500〜</p>
              <p className="text-xs text-muted-foreground">必要な分だけ検証実行枠を追加</p>
            </div>
            <CheckoutLink href={checkout.topup20} variant="outline" className="max-w-xs">
              追加枠を購入する
            </CheckoutLink>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Stripe Checkout の Payment Link または Price ID を設定すると有効化されます。
          </p>
        </section>

        <section className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>価格や詳細仕様は開発中の目安です。正式リリース時に調整する場合があります。</p>
          <Link href="/" className="mt-3 inline-block font-medium text-primary underline-offset-4 hover:underline">
            トップへ戻る
          </Link>
        </section>
      </main>
    </div>
  );
}

function PlanGrid({
  billing,
  pendingPlan,
  onStartCheckout,
}: {
  billing: Billing;
  pendingPlan: string | null;
  onStartCheckout: (planTier: "basic" | "creator" | "pro", billing: Billing) => Promise<void>;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-3 md:items-end md:gap-4 lg:gap-6">
      {PLANS.map((plan) => (
        <PlanCard
          key={plan.subtitle}
          plan={plan}
          billing={billing}
          pendingPlan={pendingPlan}
          onStartCheckout={onStartCheckout}
        />
      ))}
    </div>
  );
}

type Billing = "monthly" | "yearly";

function PlanCard({
  plan,
  billing,
  pendingPlan,
  onStartCheckout,
}: {
  plan: PlanRow;
  billing: Billing;
  pendingPlan: string | null;
  onStartCheckout: (planTier: "basic" | "creator" | "pro", billing: Billing) => Promise<void>;
}) {
  const isYearly = billing === "yearly";
  const priceLabel = isYearly
    ? `${yearlyTotalJpy(plan.monthly).toLocaleString("ja-JP")}円 / 年`
    : `${plan.monthly.toLocaleString("ja-JP")}円 / 月`;
  const subLabel = isYearly
    ? `月あたり ${yearlyMonthlyEquivalentJpy(plan.monthly).toLocaleString("ja-JP")}円 相当`
    : "いつでも解約可能";

  const pendingKey = `${plan.planTier}:${billing}`;
  const loading = pendingPlan === pendingKey;

  return (
    <motion.div
      layout
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "relative flex h-full flex-col",
        plan.featured && "md:-mt-4 md:mb-2 md:z-10",
      )}
    >
      {plan.featured ? (
        <div className="absolute -top-3 left-1/2 z-20 -translate-x-1/2">
          <Badge className="bg-linear-to-r from-violet-600 to-fuchsia-600 px-3 text-white shadow-md">
            人気 No.1
          </Badge>
        </div>
      ) : null}
      <Card
        className={cn(
          "flex h-full flex-col overflow-hidden border bg-card/90 shadow-lg backdrop-blur-sm transition-shadow hover:shadow-xl",
          plan.featured && "border-primary/40 shadow-primary/10 md:scale-[1.04]",
        )}
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
              <strong className="text-foreground">DNAスロット:</strong> {plan.dnaSlot}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">思考の解像度:</strong> {plan.aiWallDepth}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">戦略の射程:</strong> {plan.strategyRange}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">DNA自動進化:</strong> {plan.vaultDepth}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">My Taboo:</strong> {plan.tabooStrictness}
            </FeatureRow>
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-0 pb-6">
          <Button
            size="lg"
            className="w-full justify-center"
            disabled={loading}
            onClick={() => {
              void onStartCheckout(plan.planTier, billing);
            }}
          >
            {loading ? "Stripeへ接続中..." : "このプランで始める"}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
