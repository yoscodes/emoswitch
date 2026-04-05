"use client";

import Link from "next/link";
import { ArrowRight, MessageSquareQuote, ShieldCheck, Sparkles } from "lucide-react";

import { AuthActions } from "@/components/auth-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-violet-200/50 via-background to-background dark:from-violet-950/40" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="space-y-0.5">
          <span className="block text-lg font-bold tracking-tight">Persona DNA</span>
          <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">
            Emotional DNA x Market Insight
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/home" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            アプリへ
          </Link>
          <div className="hidden md:block">
            <AuthActions />
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto flex w-full max-w-5xl flex-col justify-center gap-12 px-6 pb-20 pt-4 md:min-h-[calc(100dvh-88px)] md:flex-row md:items-center md:gap-16 md:pb-24">
          <div className="max-w-xl space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full px-3">
                Emotional DNA x Market Insight
              </Badge>
              <Badge variant="outline" className="rounded-full px-3">
                仮説検証ラボ
              </Badge>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              起業家の熱量を、確信に変えるためのワークスペース。
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              あなたのDNAを、
              <br />
              勝てる事業に変換する。
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              「何をしたいか」という思想と、「何が求められるか」という市場反応。
              <br />
              Persona DNA は、その間にあるズレを仮説に変えて磨き上げる、起業家のためのワークスペースです。
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="rounded-full border bg-background/80 px-3 py-1.5">
                DNAから削り出す
              </span>
              <span className="rounded-full border bg-background/80 px-3 py-1.5">
                発信で市場適合を見る
              </span>
              <span className="rounded-full border bg-background/80 px-3 py-1.5">
                反応ログが資産になる
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/home"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "inline-flex gap-2 rounded-full px-8",
                )}
              >
                事業の種を置く
                <ArrowRight className="size-4" />
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/persona"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full")}
                >
                  思想を言語化する
                </Link>
                <span className="rounded-full border bg-background/80 px-3 py-2 text-sm text-muted-foreground">
                  ペルソナ資産
                </span>
              </div>
            </div>
            <div className="md:hidden">
              <AuthActions />
            </div>
          </div>

          <section className="relative w-full max-w-md flex-1">
            <div className="overflow-hidden rounded-3xl border bg-background/85 shadow-2xl backdrop-blur">
              <div className="border-b bg-muted/30 px-6 py-4">
                <p className="text-sm font-medium">思考を、検証可能な事業仮説へアップグレードする</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  同じ原体験でも、愚痴で終わるか、市場に届く事業仮説になるかは変わります。
                </p>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-dashed bg-muted/25 p-4">
                  <p className="text-xs font-medium text-muted-foreground">思考が散らばった状態</p>
                  <p className="mt-3 text-sm leading-7 text-foreground/80">
                    採用広報ってしんどい。みんな発信しろって言うけど、何を言えば刺さるのか分からない。
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
                  <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                    Persona DNA 後
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-200">
                      👻 ペルソナ: 破壊的
                    </Badge>
                    <Badge variant="secondary" className="rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-200">
                      専門性を反映済み
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7">
                    採用広報に疲れた代表こそ、発信の悩みを抱えています。まずは「何を発信すれば反応が返るのか」を一緒に検証できる場が必要では？
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t px-6 py-4 text-xs text-muted-foreground">
                <span>DNAを抽出</span>
                <span>・</span>
                <span>仮説を発信へ変換</span>
                <span>・</span>
                <Link href="/home" className="underline underline-offset-2">
                  Seed Workspace を開く
                </Link>
              </div>
            </div>
          </section>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 py-16 md:py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              起業家の熱量を、確信に変える。
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              「何を書けばいいか分からない」の正体は、言語化不足ではなく、思想と市場反応がまだ繋がっていないことかもしれません。
              <br />
              Persona DNA は、そのズレを「DNA -&gt; 仮説 -&gt; 市場反応」の流れで整えます。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border bg-card/60 p-6">
              <p className="text-sm font-medium text-muted-foreground">STEP 1</p>
              <h3 className="mt-3 text-xl font-bold">DNAから事業を削り出す</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                原体験、怒り、違和感、譲れない価値観。それらを素材にして、自分にしかできない事業仮説を削り出します。
              </p>
              <p className="mt-4 text-sm font-medium">補助入力で顧客・痛み・検証案まで接続</p>
            </div>

            <div className="rounded-3xl border bg-card/60 p-6">
              <p className="text-sm font-medium text-muted-foreground">STEP 2</p>
              <h3 className="mt-3 text-xl font-bold">市場へぶつける仮説を整える</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                共感導入、問題提起、世界観、論点整理、核心ひと言。どの切り口で市場にぶつけるかを、検証者の視点で整えます。
              </p>
              <p className="mt-4 text-sm font-medium">AI推奨とテンプレで勝ち筋を比較</p>
            </div>

            <div className="rounded-3xl border bg-card/60 p-6">
              <p className="text-sm font-medium text-muted-foreground">STEP 3</p>
              <h3 className="mt-3 text-xl font-bold">30-Day Market Validation Path</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                単発なら発信案3本、連載なら30日間の市場検証パス。反応を残すほど、次の仮説はより鋭くなります。
              </p>
              <p className="mt-4 text-sm font-medium">検証のプロセスそのものを設計する</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 py-16 md:py-24">
          <div className="mb-8 flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full px-3">
              思想に合う
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3">
              検証しやすい
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3">
              続けるほど賢くなる
            </Badge>
          </div>
          <div className="mb-16 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              投稿して終わりではない。
              <br />
              反応そのものが、あなたの知的資産になる。
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              反応を得るほど、あなたの「ペルソナDNA」は解像度を上げ、次回の事業提案はより鋭くなります。
              <br />
              これは、あなただけの事業家としての知的資産です。
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="group relative rounded-3xl border bg-card/50 p-8 transition-colors hover:bg-card">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/30">
                <Sparkles className="size-6" />
              </div>
              <h3 className="text-xl font-bold">Persona DNA</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                X の URL や過去投稿を預けるだけ。課題意識、価値観、顧客への向き合い方を言語化して、あなたにしかない事業の方向性を抽出します。
              </p>
              <Badge variant="secondary" className="mt-4 opacity-80">
                DNA資産
              </Badge>
            </div>

            <div className="group relative rounded-3xl border bg-card/50 p-8 transition-colors hover:bg-card">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/30">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="text-xl font-bold">Market Insight Loop</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                主役は Archive の反応ログ。刺さった切り口と刺さらなかった見せ方を蓄積し、次の仮説へ返します。
              </p>
              <Badge variant="secondary" className="mt-4">
                反応ループ
              </Badge>
            </div>

            <div className="group relative rounded-3xl border bg-card/50 p-8 transition-colors hover:bg-card">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                <MessageSquareQuote className="size-6" />
              </div>
              <h3 className="text-xl font-bold">30-Day Market Validation Path</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                30回投稿する作業ではなく、共感獲得・納得形成・検証募集の3フェーズで市場を学ぶ検証プロセスとして設計します。
              </p>
              <Badge variant="secondary" className="mt-4">
                連続検証
              </Badge>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
