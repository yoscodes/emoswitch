"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Layers, Sparkles } from "lucide-react";

import { AuthActions } from "@/components/auth-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const labHref = "/lab";
const identityHref = "/identity";

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-violet-200/45 via-background to-background dark:from-violet-950/35"
        aria-hidden
      />

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 md:pb-24 md:pt-6">
          <div className="mb-6 flex flex-wrap items-center justify-end gap-2 sm:mb-8">
            <AuthActions />
          </div>
          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-16">
            <div className="max-w-xl flex-1 space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3">
                  Concept Forge
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-violet-500/35 px-3 text-violet-700 dark:border-violet-500/40 dark:text-violet-300"
                >
                  事業案の言語化ワークスペース
                </Badge>
              </div>

              <p className="text-sm font-medium text-muted-foreground">
                頭の中では見えているのに、まだ人に説明できない構想のための作業場です。
              </p>

              <h1 className="text-balance text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl md:text-5xl">
                言葉にならない事業案を、
                <br />
                伝わるコンセプトへ。
              </h1>

              <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                断片的なメモ、違和感、やりたい理由をそのまま入れるだけ。AIが
                「誰に」「何を」「なぜ今」「どう届ける」を分解し、一言で説明できる事業コンセプトへ鍛えます。
              </p>

              <ul className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-3">
                <li className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
                  ふわっとした構想を分解する
                </li>
                <li className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
                  顧客・痛み・価値を言葉にする
                </li>
                <li className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
                  一言コンセプトと最初の一手を残す
                </li>
              </ul>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href={labHref}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "inline-flex w-full justify-center gap-2 rounded-full px-8 sm:w-auto",
                    "bg-violet-600 text-white hover:bg-violet-700",
                  )}
                >
                  構想を言語化する
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </Link>
                <Link
                  href={identityHref}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full justify-center rounded-full sm:w-auto",
                  )}
                >
                  自分の軸を整える
                </Link>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md flex-1 lg:mx-0 lg:max-w-none lg:pt-2">
              <div className="overflow-hidden rounded-3xl border bg-card/90 shadow-xl backdrop-blur-sm">
                <div className="border-b bg-muted/40 px-5 py-4 sm:px-6">
                  <p className="text-sm font-semibold">頭の中のメモを、説明できる形に</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    まだ粗い言葉のままでも大丈夫。構想の芯だけを取り出して整えます。
                  </p>
                </div>
                <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4">
                  <div className="flex flex-col rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Before: 頭の中のメモ</p>
                    <p className="mt-3 text-sm italic leading-relaxed text-foreground/75">
                      「小さな会社の人が、自分の強みをうまく言えなくて損している気がする。何か手伝えるかも。」
                    </p>
                    <Badge
                      variant="outline"
                      className="mt-4 w-fit border-destructive/35 text-[10px] text-destructive"
                    >
                      まだ輪郭が曖昧
                    </Badge>
                  </div>
                  <div className="flex flex-col rounded-2xl border border-violet-500/25 bg-violet-500/6 p-4 dark:bg-violet-500/10">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-violet-800 dark:text-violet-200">After: Concept Brief</p>
                      <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                        言語化済み
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-foreground/95">
                      誠実な小規模事業者が、自分の価値を短い言葉で説明できるようにするコンセプト設計ツール。
                    </p>
                    <Badge variant="secondary" className="mt-4 w-fit bg-violet-500/15 text-[10px] text-violet-800 dark:text-violet-100">
                      誰に・何を・なぜが見える
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-t bg-muted/20 px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <span>Scrap → 解像度シート → Concept Brief</span>
                  <Link
                    href={identityHref}
                    className="font-medium text-violet-600 underline-offset-4 hover:underline dark:text-violet-400"
                  >
                    自分の軸を先に整える
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 bg-muted/15 py-14 md:py-20">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                曖昧なまま進めない。
                <br className="sm:hidden" />
                言葉にすると、次の一手が見える。
              </h2>
              <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                事業案が進まない理由は、能力不足ではなく、まだ説明できる粒度に分解されていないからかもしれません。
                Concept Forge は、荒いメモを一度受け止めて、構想の芯・届ける相手・最初に見せる価値へ分けていきます。
              </p>
            </div>

            <ol className="grid gap-5 md:grid-cols-3 md:gap-6">
              <li className="relative flex flex-col rounded-3xl border bg-card/70 p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    手順 1
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Scrap
                  </Badge>
                </div>
                <h3 className="text-lg font-bold">思いつきをそのまま入れる</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  きれいに書こうとせず、断片・違和感・誰かの困りごと・自分がやりたい理由を自由メモに置きます。
                </p>
                <p className="mt-5 border-t border-border/60 pt-3 text-xs font-medium text-foreground/80">
                  文章になっていなくても始められる
                </p>
              </li>

              <li className="relative flex flex-col rounded-3xl border bg-card/70 p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    手順 2
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Forge
                  </Badge>
                </div>
                <h3 className="text-lg font-bold">構想を4つの問いに分ける</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  「誰に」「どんな痛みを」「どう届けるか」「なぜ今か」へ分解。空欄はAIの仮提案から選べます。
                </p>
                <p className="mt-5 border-t border-border/60 pt-3 text-xs font-medium text-foreground/80">
                  顧客・価値・緊急性が見える
                </p>
              </li>

              <li className="relative flex flex-col rounded-3xl border bg-card/70 p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    手順 3
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Brief
                  </Badge>
                </div>
                <h3 className="text-lg font-bold">説明できる形に固定する</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  一言コンセプト、価値提案、MVPの核、最初にやる小さな一手まで落とし込みます。
                </p>
                <p className="mt-5 border-t border-border/60 pt-3 text-xs font-medium text-violet-700 dark:text-violet-300">
                  人に話せる粒度まで鍛える
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 md:py-24">
          <div className="mb-8 flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full px-3">
              言語化
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3">
              構想整理
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3">
              自分の軸
            </Badge>
          </div>

          <div className="mb-12 max-w-2xl">
            <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              つくるのは文章ではなく、
              <br />
              事業の輪郭です。
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              ただのコピー生成ではありません。まだ名前のない構想を、相手に伝えられる言葉、試せる設計、自分が続けられる軸へ分けて鍛えます。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <article className="flex flex-col rounded-3xl border bg-card/60 p-7 transition-colors hover:bg-card">
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                <FileText className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold">Concept Brief</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                一言コンセプト、対象顧客、解決する痛み、最初のMVPを1枚にまとめ、説明の迷子を減らします。
              </p>
              <Badge variant="secondary" className="mt-5 w-fit text-xs">
                事業案の要約
              </Badge>
            </article>

            <article className="flex flex-col rounded-3xl border bg-card/60 p-7 transition-colors hover:bg-card">
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                <Sparkles className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold">AIの逆質問</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                曖昧な部分をそのまま埋めず、「ここを答えると前に進む」問いを返します。考えるべき論点が絞れます。
              </p>
              <Badge variant="secondary" className="mt-5 w-fit text-xs">
                思考の解像度
              </Badge>
            </article>

            <article className="flex flex-col rounded-3xl border bg-card/60 p-7 transition-colors hover:bg-card">
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                <Layers className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold">Identity Filter</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                使いたくない言葉、避けたい売り方、譲れない思想を反映し、借り物のビジネス語に寄りすぎない表現にします。
              </p>
              <Badge variant="secondary" className="mt-5 w-fit text-xs">
                自分の言葉
              </Badge>
            </article>
          </div>
        </section>

        <section className="border-t border-border/50 bg-background py-14 md:py-20">
          <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <Badge variant="outline" className="rounded-full px-3">
                Output
              </Badge>
              <h2 className="mt-4 text-balance text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                最終的に残るもの
              </h2>
              <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Concept Forge は、きれいな文章を一発で出すよりも、事業案の説明に必要な部品をそろえることを重視しています。
              </p>
            </div>
            <ul className="space-y-3 rounded-3xl border bg-card/70 p-5 shadow-sm">
              {[
                "誰に向けた事業なのか",
                "どんな痛みや未充足を扱うのか",
                "なぜ今その構想を形にするのか",
                "最初に届ける最小の価値は何か",
                "一言でどう説明すれば伝わるのか",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border/50 bg-violet-500/7 py-12 dark:bg-violet-950/25">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6">
            <h2 className="text-balance text-xl font-bold tracking-tight sm:text-2xl">
              まずは、頭の中のメモをそのまま入れてみる
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              事業名も、ターゲットも、言い切れる価値もまだ曖昧で大丈夫です。粗い言葉を入れるところから、コンセプトは鍛えられます。
            </p>
            <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={labHref}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "inline-flex w-full justify-center gap-2 rounded-full sm:w-auto sm:min-w-[200px]",
                  "bg-violet-600 text-white hover:bg-violet-700",
                )}
              >
                Lab で言語化する
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href={identityHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full justify-center rounded-full border-border/80 sm:w-auto sm:min-w-[200px]",
                )}
              >
                自分の軸を整える
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
