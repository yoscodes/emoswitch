"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, CheckCircle2, FileText, Layers, Sparkles } from "lucide-react";

import { AuthActions } from "@/components/auth-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const labHref = "/lab";
const identityHref = "/identity";

const stepListVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const stepCardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-violet-200/45 via-background to-background dark:from-violet-950/35"
        aria-hidden
      />

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 md:pb-24 md:pt-6">
          <div className="mb-6 flex flex-wrap items-center justify-end gap-2 sm:mb-8">
            <AuthActions />
          </div>
          <div className="grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-12">
            <div className="max-w-2xl lg:col-span-7">
              <div className="mb-6 flex flex-wrap gap-2">
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

              <h1 className="text-balance text-3xl font-bold leading-[1.1] tracking-[-0.045em] sm:text-4xl md:text-5xl lg:text-[3.35rem]">
                言葉にならない事業案を、
                <br />
                伝わるコンセプトへ。
              </h1>

              <p className="mt-8 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                頭の中では見えているのに、人にうまく説明できない構想のための作業場。
                断片的なメモや違和感を入れるだけで、AIが「誰に・何を・なぜ今・どう届けるか」を分解し、人に話せる事業の輪郭へ鍛え上げます。
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href={labHref}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "inline-flex w-full justify-center gap-2 rounded-full px-8 sm:w-auto",
                    "bg-violet-600 text-white hover:bg-violet-700",
                  )}
                >
                  ワークスペースを開く
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </Link>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md lg:col-span-5 lg:mx-0 lg:max-w-none lg:pt-2">
              <div className="overflow-hidden rounded-3xl border bg-card/90 shadow-xl backdrop-blur-sm">
                <div className="border-b bg-muted/40 px-5 py-4 sm:px-6">
                  <p className="text-sm font-semibold">頭の中のメモを、説明できる形に</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    まだ粗い言葉のままでも大丈夫。構想の芯だけを取り出して整えます。
                  </p>
                </div>
                <div className="relative grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4">
                  <div className="flex flex-col rounded-2xl border border-dashed border-border/80 bg-muted/40 p-4">
                    <p className="text-xs font-medium text-muted-foreground/80">Before: 頭の中のメモ</p>
                    <p className="mt-3 text-sm italic leading-relaxed text-muted-foreground">
                      「小さな会社の人が、自分の強みをうまく言えなくて損している気がする。何か手伝えるかも。」
                    </p>
                    <Badge
                      variant="outline"
                      className="mt-4 w-fit border-destructive/35 text-[10px] text-destructive"
                    >
                      まだ輪郭が曖昧
                    </Badge>
                  </div>
                  <div
                    className="concept-flow-arrow pointer-events-none absolute left-1/2 top-1/2 z-10 hidden size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-violet-500/30 bg-background/90 text-violet-700 shadow-sm backdrop-blur-sm sm:flex dark:text-violet-200"
                    aria-hidden
                  >
                    <ArrowRight className="relative z-10 size-4" />
                  </div>
                  <div className="flex flex-col rounded-2xl border border-violet-500/45 bg-violet-500/6 p-4 shadow-sm dark:border-violet-400/45 dark:bg-violet-500/10">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-violet-800 dark:text-violet-200">After: Concept Brief</p>
                      <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900 animate-pulse dark:bg-violet-950 dark:text-violet-100">
                        仮説化済み
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
                <div className="border-t bg-muted/20 px-5 py-3 text-xs text-muted-foreground sm:px-6">
                  <span>Scrap → 解像度シート → Concept Brief</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 bg-muted/15 py-14 md:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
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

            <motion.ol
              className="grid gap-5 md:grid-cols-3 md:gap-6"
              variants={stepListVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
            >
              <motion.li
                className="relative flex flex-col rounded-3xl border bg-card/70 p-6 shadow-sm"
                variants={stepCardVariants}
              >
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
                  きれいに書こうとせず、断片的なメモ、業界への違和感、やりたい理由をそのままノートに書き殴るだけでスタートできます。
                </p>
                <p className="mt-5 border-t border-border/60 pt-3 text-xs font-medium text-foreground/80">
                  文章になっていなくても始められる
                </p>
              </motion.li>

              <motion.li
                className="relative flex flex-col rounded-3xl border bg-card/70 p-6 shadow-sm"
                variants={stepCardVariants}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    手順 2
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Forge
                  </Badge>
                </div>
                <h3 className="text-lg font-bold">AIが4つの核心に分解する</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  あなたのメモから、AIが「誰に・何を・なぜ今・どう届けるか」の仮説を自動で削り出します。空欄があっても、AIの提案をベースに選んで磨けます。
                </p>
                <p className="mt-5 border-t border-border/60 pt-3 text-xs font-medium text-foreground/80">
                  顧客・価値・緊急性が見える
                </p>
              </motion.li>

              <motion.li
                className="relative flex flex-col rounded-3xl border bg-card/70 p-6 shadow-sm"
                variants={stepCardVariants}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    手順 3
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Brief
                  </Badge>
                </div>
                <h3 className="text-lg font-bold">Concept Brief として固定する</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  一言コンセプト、価値提案、検証すべきMVPの核を1枚の「設計図」として出力。人に自信を持って説明できる状態を作ります。
                </p>
                <p className="mt-5 border-t border-border/60 pt-3 text-xs font-medium text-violet-700 dark:text-violet-300">
                  人に話せる粒度まで鍛える
                </p>
              </motion.li>
            </motion.ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 md:py-24">
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

          <motion.div
            className="grid gap-6 md:grid-cols-3"
            variants={stepListVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
          >
            <motion.article
              className="flex flex-col rounded-3xl border bg-card/60 p-7 transition-colors hover:bg-card"
              variants={stepCardVariants}
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                <FileText className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold">Concept Brief</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                きれいなキャッチコピーではなく、ビジネスモデルの骨子（対象顧客・痛み・解決策・検証案）を1枚のシートに結晶化。説明の迷子をなくします。
              </p>
              <Badge variant="secondary" className="mt-5 w-fit text-xs">
                事業の設計図
              </Badge>
            </motion.article>

            <motion.article
              className="flex flex-col rounded-3xl border bg-card/60 p-7 transition-colors hover:bg-card"
              variants={stepCardVariants}
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                <Sparkles className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold">AIの逆質問</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                曖昧な部分をAIが適当に誤魔化して進めることはしません。「ここを答えると前に進む」という、あなたの解像度を上げるための問いを返します。
              </p>
              <Badge variant="secondary" className="mt-5 w-fit text-xs">
                思考の壁打ち
              </Badge>
            </motion.article>

            <motion.article
              className="flex flex-col rounded-3xl border bg-card/60 p-7 transition-colors hover:bg-card"
              variants={stepCardVariants}
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                <Layers className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold">Identity Filter</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                借り物のビジネス用語や、あなたが「絶対にやりたくない売り方」を排除。あなたの原体験や譲れない軸に沿ったコンセプトだけに絞り込みます。
              </p>
              <Badge variant="secondary" className="mt-5 w-fit text-xs">
                美学の反映
              </Badge>
            </motion.article>
          </motion.div>
        </section>

        <section className="border-t border-border/50 bg-background py-14 md:py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
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
                "誰を顧客にすべきかの明確な基準",
                "他の類似サービスと何が違うのかの言語化",
                "「なぜ今やるべきか」という納得のストーリー",
                "最初に検証すべき、最小限の機能（MVP）の核",
                "一言で100%伝わる、ピュアな事業コンセプト",
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
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center sm:px-6">
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
                ワークスペースを開く
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
