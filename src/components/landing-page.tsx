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
        <span className="text-lg font-bold tracking-tight">エモ・スイッチ</span>
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
                プロンプト不要
              </Badge>
              <Badge variant="outline" className="rounded-full px-3">
                マイ・ゴースト育成
              </Badge>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              「書けない」を「あなたらしく刺さる」に変える、感情変換エンジン。
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              書き出しに迷う朝も、
              <br />
              あなたの分身が先に考える。
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              素材を書いて、感情を選んで、レバーを引くだけ。
              毎回プロンプトを組み立てなくても、ゴースト設定があなたの文体やNGワードを引き継ぎ、
              3案とハッシュタグをまとめて整えます。
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="rounded-full border bg-background/80 px-3 py-1.5">
                脱・AI臭さ
              </span>
              <span className="rounded-full border bg-background/80 px-3 py-1.5">
                不快感のゼロ化
              </span>
              <span className="rounded-full border bg-background/80 px-3 py-1.5">
                一言で伝わる
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
                使ってみる
                <ArrowRight className="size-4" />
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/ghost"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full")}
                >
                  マイ・ゴースト
                </Link>
                <span className="rounded-full border bg-background/80 px-3 py-2 text-sm text-muted-foreground">
                  AIを育てる
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
                <p className="text-sm font-medium">ゴースト設定がある時・ない時</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  同じ素材でも、あなたらしさの出方が変わります。
                </p>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-dashed bg-muted/25 p-4">
                  <p className="text-xs font-medium text-muted-foreground">普通のAI</p>
                  <p className="mt-3 text-sm leading-7 text-foreground/80">
                    こんにちは。今日は良い天気ですね。散歩に行くのも良いかもしれません。
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
                  <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                    あなたのゴースト
                  </p>
                  <p className="mt-3 text-sm leading-7">
                    お疲れさま。今日はちょっと外を歩きたくなる空気だね。こういう日は、気分まで軽くなる。
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t px-6 py-4 text-xs text-muted-foreground">
                <span>文体の癖を反映</span>
                <span>・</span>
                <span>NGワードを回避</span>
                <span>・</span>
                <Link href="/home" className="underline underline-offset-2">
                  触感UIは作成画面で試せます
                </Link>
              </div>
            </div>
          </section>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 py-16 md:py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              3ステップの裏で、ゴーストがあなたの代わりに整える。
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              操作はシンプルなまま。考え込む部分だけを、あなた専用の設定が裏側で引き受けます。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border bg-card/60 p-6">
              <p className="text-sm font-medium text-muted-foreground">STEP 1</p>
              <h3 className="mt-3 text-xl font-bold">素材を書く</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                伝えたい事実やメモだけを書けば大丈夫。言い回しまで完璧に考える必要はありません。
              </p>
              <p className="mt-4 text-sm font-medium">ゴーストが話題の芯を拾う</p>
            </div>

            <div className="rounded-3xl border bg-card/60 p-6">
              <p className="text-sm font-medium text-muted-foreground">STEP 2</p>
              <h3 className="mt-3 text-xl font-bold">感情を選ぶ</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                熱量やトーンはダイヤル感覚で調整。あなたらしい距離感に、出力の空気を寄せていきます。
              </p>
              <p className="mt-4 text-sm font-medium">ひとこと設定が語尾や温度感を補正</p>
            </div>

            <div className="rounded-3xl border bg-card/60 p-6">
              <p className="text-sm font-medium text-muted-foreground">STEP 3</p>
              <h3 className="mt-3 text-xl font-bold">レバーを引く</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                3案とハッシュタグを同時に生成。迷いを減らしつつ、投稿ごとのニュアンスも外しません。
              </p>
              <p className="mt-4 text-sm font-medium">NGワードを避けて、あなたらしく仕上げる</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 py-16 md:py-24">
          <div className="mb-8 flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full px-3">
              脱・AI臭さ
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3">
              不快感のゼロ化
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3">
              一言で伝わる
            </Badge>
          </div>
          <div className="mb-16 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              AIに、あなたの「魂」を宿す。
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              「ゴースト設定」は、AIをあなた専用の執筆パートナーへ調律する場所です。
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="group relative rounded-3xl border bg-card/50 p-8 transition-colors hover:bg-card">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/30">
                <Sparkles className="size-6" />
              </div>
              <h3 className="text-xl font-bold">文体インポート</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                XのURLを預けておくだけ。過去の投稿を将来の学習資産として蓄え、独特の言い回しやリズムの継承に備えます。
              </p>
              <Badge variant="secondary" className="mt-4 opacity-80">
                将来の学習準備
              </Badge>
            </div>

            <div className="group relative rounded-3xl border bg-card/50 p-8 transition-colors hover:bg-card">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/30">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="text-xl font-bold">NGワード・シールド</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                自分が絶対に使わない言葉を登録。生成結果から避けたい表現を外し、違和感やブランドのズレを減らします。
              </p>
              <Badge variant="secondary" className="mt-4">
                即時反映
              </Badge>
            </div>

            <div className="group relative rounded-3xl border bg-card/50 p-8 transition-colors hover:bg-card">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                <MessageSquareQuote className="size-6" />
              </div>
              <h3 className="text-xl font-bold">ひとこと調律</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                「論理的に」「やさしく」など一言を添えるだけで、毎回のプロンプトなしでも全体の文体にそのニュアンスが宿ります。
              </p>
              <Badge variant="secondary" className="mt-4">
                即時反映
              </Badge>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
