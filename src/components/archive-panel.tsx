"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Circle, Clock, Copy, Flame, Snowflake, Trash2, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DATA_SYNC_EVENT,
  fetchGenerations,
  patchGenerationRecord,
  removeGenerationRecord,
  seedArchiveSampleData,
} from "@/lib/api-client";
import { EMOTION_LABELS } from "@/lib/emotions";
import { writeReuseSession } from "@/lib/reuse-session";
import type { GenerationRecord, QuickFeedback } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_FEEDBACK_OPTIONS: Array<{
  value: QuickFeedback;
  shortLabel: string;
  buttonLabel: string;
  buttonClassName: string;
  filterClassName: string;
  selectorClassName: string;
  icon: typeof Flame;
}> = [
  {
    value: null,
    shortLabel: "😶 未評価",
    buttonLabel: "未評価",
    buttonClassName: "border-border bg-background/80 text-muted-foreground hover:bg-muted/60",
    filterClassName: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    selectorClassName: "border-border bg-background text-muted-foreground hover:bg-muted/70",
    icon: Circle,
  },
  {
    value: "hot",
    shortLabel: "🔥 成功",
    buttonLabel: "伸びた！",
    buttonClassName: "border-orange-200/80 bg-orange-50/70 text-orange-600 hover:bg-orange-100/80",
    filterClassName: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
    selectorClassName: "border-orange-100 bg-orange-50/40 text-orange-500 hover:bg-orange-50/80",
    icon: Flame,
  },
  {
    value: "cold",
    shortLabel: "❄️ イマイチ",
    buttonLabel: "イマイチ",
    buttonClassName: "border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-slate-100",
    filterClassName: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
    selectorClassName: "border-slate-200 bg-slate-50/60 text-slate-500 hover:bg-slate-100",
    icon: Snowflake,
  },
];

function getQuickFeedbackMeta(value: QuickFeedback) {
  return QUICK_FEEDBACK_OPTIONS.find((option) => option.value === value) ?? QUICK_FEEDBACK_OPTIONS[0];
}

export function ArchivePanel() {
  const [rows, setRows] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuickFeedback | "all">("all");
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setRows(await fetchGenerations());
    } catch (e) {
      setError(e instanceof Error ? e.message : "履歴の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onSync = () => {
      void refresh();
    };
    window.addEventListener(DATA_SYNC_EVENT, onSync);
    return () => window.removeEventListener(DATA_SYNC_EVENT, onSync);
  }, [refresh]);

  const handleSeedSamples = async () => {
    setSeeding(true);
    setSeedStatus(null);
    setSeedError(null);
    try {
      const result = await seedArchiveSampleData();
      setSeedStatus(
        result.insertedCount > 0
          ? `${result.insertedCount}件のサンプル投稿を追加しました。`
          : "すでに履歴があるため、サンプル投稿の追加はスキップしました。",
      );
      await refresh();
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : "サンプル投稿の追加に失敗しました");
    } finally {
      setSeeding(false);
    }
  };

  const filteredRows = rows.filter((row) => {
    if (filter === "all") return true;
    return (row.quickFeedback ?? null) === filter;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 pb-28 md:px-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">アーカイブ</h1>
        <p className="text-muted-foreground">
          生成した3案のうちどれを採用したか、投稿後の反応をメモして、次の一手のヒントに使います。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => void handleSeedSamples()} disabled={seeding}>
            {seeding ? "サンプル投稿を追加中..." : "サンプル投稿を入れる"}
          </Button>
          <span className="text-xs text-muted-foreground">空のときだけでなく、常にここから追加できます。</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            すべて
          </Button>
          {QUICK_FEEDBACK_OPTIONS.map((option) => (
            <Button
              key={option.shortLabel}
              type="button"
              size="sm"
              variant="outline"
              className={cn(filter === option.value ? option.filterClassName : "text-muted-foreground", "transition-colors")}
              onClick={() => setFilter(option.value)}
            >
              {option.shortLabel}
            </Button>
          ))}
        </div>
        {seedStatus ? <p className="text-sm text-emerald-600">{seedStatus}</p> : null}
        {seedError ? <p className="text-sm text-destructive">{seedError}</p> : null}
      </header>

      {loading ? (
        <ul className="space-y-4">
          {[0, 1, 2].map((item) => (
            <li key={item}>
              <ArchiveRowSkeleton />
            </li>
          ))}
        </ul>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {rows.length === 0 ? (
              <p>
                まだ記録がありません。最初の投稿をしてみましょう。
                <Link href="/home" className="px-1 font-medium text-primary underline-offset-4 hover:underline">
                  作成画面
                </Link>
                で3案を生成すると、ここに溜まります。
              </p>
            ) : (
              <p>この条件に一致する投稿はまだありません。</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {filteredRows.map((row) => (
            <motion.li
              key={row.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ArchiveRow key={row.id} row={row} onUpdate={refresh} />
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArchiveRow({
  row,
  onUpdate,
}: {
  row: GenerationRecord;
  onUpdate: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState<QuickFeedback>(row.quickFeedback ?? null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const formattedDate = new Date(row.createdAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const adoptedBody =
    row.selectedIndex != null && row.variants[row.selectedIndex] ? row.variants[row.selectedIndex] : null;
  const otherVariants = row.variants.filter((_, index) => index !== row.selectedIndex);
  const quickFeedbackMeta = getQuickFeedbackMeta(quickFeedback);

  useEffect(() => {
    setQuickFeedback(row.quickFeedback ?? null);
  }, [row.quickFeedback]);

  useEffect(() => {
    if (feedbackSaving) return;
    setFeedbackOpen(false);
  }, [feedbackSaving, quickFeedback]);

  const handleReuseSettings = () => {
    writeReuseSession({
      draft: row.draft,
      emotion: row.emotion,
      intensity: row.intensity,
      speedMode: row.speedMode ?? "flash",
    });
    router.push("/home");
  };

  const handleCopyBundle = async () => {
    if (!adoptedBody) return;
    try {
      const text = [adoptedBody, row.hashtags.join(" ")].filter(Boolean).join("\n\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleDelete = () => {
    if (!window.confirm("この履歴を削除しますか？この操作は取り消せません。")) return;
    void removeGenerationRecord(row.id).then(() => void onUpdate());
  };

  const saveQuickFeedback = async (next: QuickFeedback) => {
    const previous = quickFeedback;
    setQuickFeedback(next);
    setFeedbackSaving(true);
    try {
      await patchGenerationRecord(row.id, { quickFeedback: next });
      void onUpdate();
    } catch {
      setQuickFeedback(previous);
    } finally {
      setFeedbackSaving(false);
    }
  };

  const handleFeedbackReset = async () => {
    if (quickFeedback === null) {
      setFeedbackOpen((open) => !open);
      return;
    }
    await saveQuickFeedback(null);
  };

  const handleFeedbackBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFeedbackOpen(false);
    }
  };

  return (
    <Card className="border-primary/5 bg-card/50 transition-colors hover:bg-card">
      <CardContent className="space-y-5 p-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
              {EMOTION_LABELS[row.emotion]}
            </Badge>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5" />
              <span>{formattedDate}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDelete}
            aria-label="この履歴を削除"
          >
            <Trash2 className="size-4" />
          </Button>
        </header>

        <section className="space-y-3">
          <Badge
            variant={adoptedBody ? "default" : "outline"}
            className={adoptedBody ? "rounded-full bg-emerald-500 text-white" : "rounded-full"}
          >
            {adoptedBody ? (
              <>
                <CheckCircle2 className="size-3" />
                採用案
              </>
            ) : (
              "未選択"
            )}
          </Badge>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6">
            <p className="text-lg leading-8 text-foreground md:text-xl">
              {adoptedBody ?? "まだ採用案が選ばれていません。"}
            </p>
          </div>
        </section>

        <section className="space-y-2 border-t border-dashed pt-4">
          <p className="text-xs font-medium text-muted-foreground">素材</p>
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{row.draft}</p>
        </section>

        <section className="flex flex-wrap items-center gap-2 border-t border-dashed pt-4">
          <div
            className="relative pt-2"
            onMouseEnter={() => setFeedbackOpen(true)}
            onMouseLeave={() => setFeedbackOpen(false)}
            onFocus={() => setFeedbackOpen(true)}
            onBlur={handleFeedbackBlur}
          >
            {feedbackOpen ? (
              <div className="absolute inset-x-0 bottom-full z-10 h-2" aria-hidden="true" />
            ) : null}
            {feedbackOpen ? (
              <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2">
                <div className="relative flex items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur">
                  {QUICK_FEEDBACK_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = quickFeedback === option.value;

                    return (
                      <button
                        key={option.shortLabel}
                        type="button"
                        onClick={() => void saveQuickFeedback(option.value)}
                        disabled={feedbackSaving}
                        className={cn(
                          "inline-flex size-9 items-center justify-center rounded-full border transition-colors",
                          active ? option.buttonClassName : option.selectorClassName,
                        )}
                        aria-pressed={active}
                        aria-label={option.buttonLabel}
                        title={option.buttonLabel}
                      >
                        <Icon className="size-4" />
                      </button>
                    );
                  })}
                  <div className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r bg-background/95" />
                </div>
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleFeedbackReset()}
              disabled={feedbackSaving}
              className={cn("gap-1.5 text-xs shadow-none transition-all", quickFeedbackMeta.buttonClassName)}
              aria-expanded={feedbackOpen}
              aria-label={quickFeedback === null ? "クイックフィードバックを選ぶ" : "クイックフィードバックを解除"}
            >
              <quickFeedbackMeta.icon className="size-3.5" />
              <span>{feedbackSaving ? "保存中..." : quickFeedbackMeta.buttonLabel}</span>
            </Button>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleReuseSettings} className="gap-2 text-xs">
            <Wand2 className="size-3.5" />
            この設定で作成
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleCopyBundle()}
            disabled={!adoptedBody}
            className="gap-2 text-xs"
          >
            <Copy className="size-3.5" />
            {copied ? "コピーしました" : "一括コピー"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOthersOpen((open) => !open)}
            className="gap-2 text-xs"
          >
            <ChevronDown className={`size-3.5 transition-transform ${othersOpen ? "rotate-180" : ""}`} />
            {othersOpen ? "他案を閉じる" : "他案を見る"}
          </Button>
        </section>

        {othersOpen ? (
          <section className="grid gap-3 border-t border-dashed pt-4 md:grid-cols-2">
            {otherVariants.length > 0 ? (
              otherVariants.map((variant, index) => (
                <div key={`${row.id}-other-${index}`} className="rounded-2xl border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="outline" className="rounded-full bg-background/60">
                      他案
                    </Badge>
                    <span className="text-xs text-muted-foreground">候補 {index + 1}</span>
                  </div>
                  <p className="text-sm leading-7 text-foreground/85">{variant}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                他に比較できる案はありません。
              </div>
            )}
            {row.hashtags.length > 0 ? (
              <div className="rounded-2xl border bg-background/70 p-4 md:col-span-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">ハッシュタグ</p>
                <div className="flex flex-wrap gap-2">
                  {row.hashtags.map((tag) => (
                    <Badge key={tag} variant="outline" className="rounded-full bg-background/70 text-[11px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ArchiveRowSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        <div className="h-20 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </CardContent>
    </Card>
  );
}

