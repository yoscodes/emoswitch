"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLAN_MONTHLY_JPY, yearlyMonthlyEquivalentJpy, yearlyTotalJpy } from "@/lib/plan-pricing";
import { cn } from "@/lib/utils";

const checkout = {
  basicMonthly: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_BASIC_MONTHLY ?? "",
  basicYearly: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_BASIC_YEARLY ?? "",
  creatorMonthly: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_CREATOR_MONTHLY ?? "",
  creatorYearly: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_CREATOR_YEARLY ?? "",
  proMonthly: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_PRO_MONTHLY ?? "",
  proYearly: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_PRO_YEARLY ?? "",
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
  monthly: number;
  credits: string;
  model: string;
  switches: string;
  ghost: string;
  target: string;
  checkoutMonthly: string;
  checkoutYearly: string;
  featured?: boolean;
};

const PLANS: PlanRow[] = [
  {
    name: "ベーシック",
    subtitle: "Basic",
    monthly: PLAN_MONTHLY_JPY.basic,
    credits: "50回分 / 月",
    model: "高速モデル（Flash）",
    switches: "基本3種のスイッチ",
    ghost: "マイ・ゴースト 1体",
    target: "まずは試したい人",
    checkoutMonthly: checkout.basicMonthly,
    checkoutYearly: checkout.basicYearly,
  },
  {
    name: "クリエイター",
    subtitle: "Creator",
    monthly: PLAN_MONTHLY_JPY.creator,
    credits: "300回分 / 月",
    model: "高品質モデル（Pro）",
    switches: "全てのスイッチ（5種＋）",
    ghost: "マイ・ゴースト 3体",
    target: "本気でバズらせたい人",
    checkoutMonthly: checkout.creatorMonthly,
    checkoutYearly: checkout.creatorYearly,
    featured: true,
  },
  {
    name: "プロ",
    subtitle: "Pro",
    monthly: PLAN_MONTHLY_JPY.pro,
    credits: "無制限",
    model: "高品質モデル（Pro）",
    switches: "全てのスイッチ",
    ghost: "マイ・ゴースト無制限",
    target: "運用代行・プロ向け",
    checkoutMonthly: checkout.proMonthly,
    checkoutYearly: checkout.proYearly,
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
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-200/40 via-background to-background dark:from-violet-950/35" />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-28 pt-4 md:pb-24">
        {/* Hero */}
        <section className="mx-auto max-w-3xl space-y-4 pb-6 text-center md:pb-12">
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="mr-1 size-3" />
            サブスクリプション
          </Badge>
          <h1 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
            あなたの言葉を、最強の武器に。
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            毎日使うものだから、あなたにぴったりのスタイルを。
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
            <PlanGrid billing="monthly" />
          </TabsContent>
          <TabsContent value="yearly" className="mt-0 outline-none">
            <PlanGrid billing="yearly" />
          </TabsContent>
        </Tabs>

        {/* Top-up */}
        <section className="mx-auto mt-16 max-w-2xl rounded-2xl border border-dashed bg-muted/20 p-8 text-center md:mt-20">
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            今月だけ、もう少し使いたい？
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            サブスクのクレジットとは別に、小分けで追加できます。
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            <div className="rounded-xl border bg-background/80 px-6 py-4 text-left shadow-sm">
              <p className="text-sm font-medium">20クレジット</p>
              <p className="text-2xl font-bold tabular-nums">¥500〜</p>
              <p className="text-xs text-muted-foreground">必要な分だけトップアップ</p>
            </div>
            <CheckoutLink href={checkout.topup20} variant="outline" className="max-w-xs">
              クレジットを追加する
            </CheckoutLink>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Stripe Checkout の Payment Link または Price ID を設定すると有効化されます。
          </p>
        </section>

        <section className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>価格・クレジットは開発中の目安です。リリース前に変更する場合があります。</p>
          <Link href="/" className="mt-3 inline-block font-medium text-primary underline-offset-4 hover:underline">
            トップへ戻る
          </Link>
        </section>
      </main>
    </div>
  );
}

function PlanGrid({ billing }: { billing: Billing }) {
  return (
    <div className="grid gap-6 md:grid-cols-3 md:items-end md:gap-4 lg:gap-6">
      {PLANS.map((plan) => (
        <PlanCard key={plan.subtitle} plan={plan} billing={billing} />
      ))}
    </div>
  );
}

type Billing = "monthly" | "yearly";

function PlanCard({ plan, billing }: { plan: PlanRow; billing: Billing }) {
  const isYearly = billing === "yearly";
  const priceLabel = isYearly
    ? `${yearlyTotalJpy(plan.monthly).toLocaleString("ja-JP")}円 / 年`
    : `${plan.monthly.toLocaleString("ja-JP")}円 / 月`;
  const subLabel = isYearly
    ? `月あたり ${yearlyMonthlyEquivalentJpy(plan.monthly).toLocaleString("ja-JP")}円 相当`
    : "いつでも解約可能";

  const href = isYearly ? plan.checkoutYearly : plan.checkoutMonthly;

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
          <Badge className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 text-white shadow-md">
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
              <strong className="text-foreground">クレジット:</strong> {plan.credits}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">AIモデル:</strong> {plan.model}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">スイッチ:</strong> {plan.switches}
            </FeatureRow>
            <FeatureRow>
              <strong className="text-foreground">マイ・ゴースト:</strong> {plan.ghost}
            </FeatureRow>
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-0 pb-6">
          <CheckoutLink href={href}>プランを選択する</CheckoutLink>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
