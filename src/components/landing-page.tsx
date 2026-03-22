"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

import { AuthActions } from "@/components/auth-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-200/50 via-background to-background dark:from-violet-950/40" />

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

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-6 pb-24 pt-4 md:flex-row md:items-center md:gap-16 md:pb-32">
        <section className="max-w-xl space-y-6">
          <p className="text-sm font-medium text-muted-foreground">
            「書けない」を「刺さる」へ。プロンプト不要の、感情変換エンジン。
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            開いた瞬間に、
            <br />
            何をすればいいか分かる。
          </h1>
          <p className="text-lg text-muted-foreground">
            素材を書いて、感情ダイヤルを回して、レバーを引くだけ。
            3案とハッシュタグが同時に揃い、触っているだけで楽しい触感UIです。
          </p>
          <div className="flex flex-wrap gap-3">
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
            <Link
              href="/ghost"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full")}
            >
              マイ・ゴースト
            </Link>
          </div>
          <div className="md:hidden">
            <AuthActions />
          </div>
        </section>

        <section className="relative w-full max-w-md flex-1">
          <div className="aspect-video w-full overflow-hidden rounded-3xl border-2 border-dashed border-muted-foreground/25 bg-muted/40 shadow-2xl">
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-background/80 shadow-inner">
                <Play className="size-8 text-muted-foreground" fill="currentColor" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">デモ動画（準備中）</p>
              <p className="text-xs text-muted-foreground">
                実機のレバー音・カメレオン背景は
                <Link href="/home" className="mx-1 underline underline-offset-2">
                  作成画面
                </Link>
                で今すぐ試せます。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
