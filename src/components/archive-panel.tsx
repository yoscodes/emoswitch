"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Copy,
  Flame,
  Layers3,
  Snowflake,
  Trash2,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DATA_SYNC_EVENT,
  fetchArchiveOverview,
  patchGenerationRecord,
  patchSeriesItemRecord,
  removeGenerationRecord,
  removeSeriesRecord,
  seedArchiveSampleData,
} from "@/lib/api-client";
import { EMOTION_LABELS } from "@/lib/emotions";
import { writeReuseSession } from "@/lib/reuse-session";
import type {
  ArchiveEntry,
  ArchiveOverview,
  GenerationRecord,
  GenerationSeriesItemRecord,
  GenerationSeriesRecord,
  QuickFeedback,
} from "@/lib/types";
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
    shortLabel: "🔥 反応あり",
    buttonLabel: "反応あり",
    buttonClassName: "border-orange-200/80 bg-orange-50/70 text-orange-600 hover:bg-orange-100/80",
    filterClassName: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
    selectorClassName: "border-orange-100 bg-orange-50/40 text-orange-500 hover:bg-orange-50/80",
    icon: Flame,
  },
  {
    value: "cold",
    shortLabel: "❄️ 刺さらず",
    buttonLabel: "刺さらず",
    buttonClassName: "border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-slate-100",
    filterClassName: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
    selectorClassName: "border-slate-200 bg-slate-50/60 text-slate-500 hover:bg-slate-100",
    icon: Snowflake,
  },
];

function getQuickFeedbackMeta(value: QuickFeedback) {
  return QUICK_FEEDBACK_OPTIONS.find((option) => option.value === value) ?? QUICK_FEEDBACK_OPTIONS[0];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSeriesEntry(entry: ArchiveEntry): entry is GenerationSeriesRecord {
  return entry.generationMode === "series";
}

function matchesFeedback(entry: ArchiveEntry, filter: QuickFeedback | "all") {
  if (filter === "all") return true;
  return (entry.quickFeedback ?? null) === filter;
}

function QuickFeedbackPicker({
  value,
  saving,
  onChange,
}: {
  value: QuickFeedback;
  saving: boolean;
  onChange: (value: QuickFeedback) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const meta = getQuickFeedbackMeta(value);

  return (
    <div
      className="relative pt-2"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      {open ? <div className="absolute inset-x-0 bottom-full z-10 h-2" aria-hidden="true" /> : null}
      {open ? (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2">
          <div className="relative flex items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur">
            {QUICK_FEEDBACK_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = value === option.value;

              return (
                <button
                  key={option.shortLabel}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void onChange(option.value);
                  }}
                  disabled={saving}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-full border transition-colors",
                    active ? option.buttonClassName : option.selectorClassName,
                  )}
                  aria-pressed={active}
                  aria-label={option.buttonLabel}
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
        disabled={saving}
        onClick={() => {
          if (value === null) {
            setOpen((current) => !current);
            return;
          }
          setOpen(false);
          void onChange(null);
        }}
        className={cn("gap-1.5 text-xs shadow-none transition-all", meta.buttonClassName)}
      >
        <meta.icon className="size-3.5" />
        <span>{saving ? "保存中..." : meta.buttonLabel}</span>
      </Button>
    </div>
  );
}

function InsightsDashboard({
  overview,
  compact = false,
  onApplyInsight,
}: {
  overview: ArchiveOverview;
  compact?: boolean;
  onApplyInsight?: () => void;
}) {
  const maxUsage = Math.max(...overview.insights.emotionBreakdown.map((entry) => entry.usageCount), 1);
  const totalSwitches = overview.insights.totalSingles + overview.insights.totalSeries;
  const canApplyInsight =
    overview.insights.recommendedEmotion != null && overview.insights.recommendedIntensity != null;

  return (
    <section className={cn("space-y-4", compact && "space-y-3")}>
      <Card className="border border-amber-200/70 bg-amber-50/70 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
        <CardHeader className={cn("space-y-2 pb-2", compact && "space-y-1.5 px-4 pt-4 pb-1")}>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-amber-600 dark:text-amber-300" />
            <h2 className={cn("text-base font-semibold", compact && "text-sm")}>Market Insight</h2>
          </div>
          <p className={cn("text-sm text-muted-foreground", compact && "text-xs leading-5")}>
            どの見せ方で事業仮説が刺さるかを、市場反応ベースで言語化して返します。
          </p>
        </CardHeader>
        <CardContent className={cn("space-y-2 p-5 pt-2", compact && "space-y-1.5 px-4 pb-4 pt-1")}>
          <p className={cn("text-sm leading-7 text-foreground", compact && "text-xs leading-6")}>
            {overview.insights.bestPatternSummary}
          </p>
          {canApplyInsight ? (
            <Button
              type="button"
              size={compact ? "sm" : "default"}
              className="mt-1 w-full rounded-full"
              onClick={onApplyInsight}
            >
              この仮説で次を作る
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-slate-200/70 bg-slate-50/70 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/20">
        <CardHeader className={cn("space-y-2 pb-2", compact && "space-y-1.5 px-4 pt-4 pb-1")}>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <h2 className={cn("text-base font-semibold", compact && "text-sm")}>見せ方分布</h2>
          </div>
          <p className={cn("text-sm text-muted-foreground", compact && "text-xs leading-5")}>
            どの見せ方を多く試したかと、どの見せ方が反応されやすかったかを並べて見ます。
          </p>
        </CardHeader>
        <CardContent className={cn("space-y-4", compact && "space-y-3 px-4 pb-4")}>
          {overview.insights.emotionBreakdown.map((entry) => (
            <div key={entry.emotion} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full", compact && "px-2 py-0.5 text-[11px]")}>
                    {entry.label}
                  </Badge>
                  <span className={cn("text-sm text-muted-foreground", compact && "text-xs")}>使用 {entry.usageCount}回</span>
                </div>
                <span className={cn("text-sm font-medium", compact && "text-xs")}>🔥率 {entry.hotRate}%</span>
              </div>
              <div className={cn("h-2 overflow-hidden rounded-full bg-muted", compact && "h-1.5")}>
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${(entry.usageCount / maxUsage) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="px-1">
        <p className={cn("text-xs text-muted-foreground", compact && "text-[11px]")}>
          これまで {totalSwitches}回の仮説検証を記録しました。
        </p>
      </div>
    </section>
  );
}

export function ArchivePanel() {
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [filter, setFilter] = useState<QuickFeedback | "all">("all");
  const [modeFilter, setModeFilter] = useState<"all" | "single" | "series">("all");
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setOverview(await fetchArchiveOverview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "反応データの取得に失敗しました");
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
          ? `${result.insertedCount}件のサンプル反応ログを追加しました。`
          : "既に履歴があるため、サンプル反応ログの追加はスキップしました。",
      );
      await refresh();
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : "サンプル反応ログの追加に失敗しました");
    } finally {
      setSeeding(false);
    }
  };

  const entries = (overview?.entries ?? []).filter((entry) => {
    if (modeFilter !== "all" && entry.generationMode !== modeFilter) return false;
    return matchesFeedback(entry, filter);
  });

  const handleApplyInsight = () => {
    if (!overview?.insights.recommendedEmotion || overview.insights.recommendedIntensity == null) return;

    writeReuseSession({
      draft: "",
      emotion: overview.insights.recommendedEmotion,
      intensity: overview.insights.recommendedIntensity,
      speedMode: "flash",
    });
    window.location.href = "/home";
  };

  const filterToolbar = (
    <div className="rounded-2xl border border-border/70 bg-muted/35 px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
        <div className="inline-flex rounded-full border bg-background/85 p-1">
          {(["all", "single", "series"] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              className="h-7 rounded-full px-2.5 text-[11px]"
              variant={modeFilter === mode ? "default" : "ghost"}
              onClick={() => setModeFilter(mode)}
            >
              {mode === "all" ? "すべて" : mode === "single" ? "単発検証" : "30日ロードマップ"}
            </Button>
          ))}
        </div>
        <div className="h-5 w-px shrink-0 bg-border/70" />
        <div className="flex items-center gap-1.5">
          {QUICK_FEEDBACK_OPTIONS.map((option) => (
            <Button
              key={option.shortLabel}
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-7 rounded-full px-2 text-[11px] shadow-none",
                filter === option.value
                  ? option.filterClassName
                  : "border-border bg-background/85 text-muted-foreground hover:bg-muted/70",
              )}
              onClick={() => setFilter(option.value)}
              aria-label={option.buttonLabel}
            >
              {option.shortLabel.split(" ")[0]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 md:px-6">
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
      ) : overview == null ? null : (
        <div className="space-y-6 md:pr-[304px] lg:pr-[320px]">
          <div className="min-w-0 space-y-6">
            <header className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight md:text-3xl">市場反応ログ</h1>
                  <p className="text-muted-foreground">
                    今のあなたの事業仮説がどう受け止められたかを見える化し、次の検証へつなげます。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <Button type="button" variant="outline" onClick={() => void handleSeedSamples()} disabled={seeding}>
                    {seeding ? "サンプル反応ログを追加中..." : "サンプルログを入れる"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setInsightsOpen((current) => !current)}
                    className="gap-2 md:hidden"
                  >
                    <BarChart3 className="size-4" />
                    {insightsOpen ? "インサイトを隠す" : "インサイトを表示"}
                    <ChevronDown className={cn("size-3.5 transition-transform", insightsOpen && "rotate-180")} />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">デモや初期検証用に、市場反応ログのサンプルを追加できます。</p>
              {filterToolbar}
              {seedStatus ? <p className="text-sm text-emerald-600">{seedStatus}</p> : null}
              {seedError ? <p className="text-sm text-destructive">{seedError}</p> : null}
            </header>

            {insightsOpen ? (
              <div className="md:hidden">
                <InsightsDashboard overview={overview} onApplyInsight={handleApplyInsight} />
              </div>
            ) : null}

            {entries.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {overview.entries.length === 0 ? (
                    <p>
                      まだ反応ログがありません。
                      <Link href="/home" className="px-1 font-medium text-primary underline-offset-4 hover:underline">
                        Seed Workspace
                      </Link>
                      で仮説を生成すると、ここが市場反応の司令塔として育ちます。
                    </p>
                  ) : (
                    <p>この条件に一致するログはまだありません。</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-4">
                {entries.map((entry) => (
                  <motion.li key={entry.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    {isSeriesEntry(entry) ? (
                      <ArchiveSeriesRow row={entry} onUpdate={refresh} />
                    ) : (
                      <ArchiveSingleRow row={entry} onUpdate={refresh} />
                    )}
                  </motion.li>
                ))}
              </ul>
            )}
          </div>

          <aside className="hidden md:block md:fixed md:top-24 md:right-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] md:w-[280px]">
            <InsightsDashboard overview={overview} compact onApplyInsight={handleApplyInsight} />
          </aside>
        </div>
      )}
    </div>
  );
}

function ArchiveSingleRow({
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
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const adoptedBody =
    row.selectedIndex != null && row.variants[row.selectedIndex] ? row.variants[row.selectedIndex] : null;
  const otherVariants = row.variants.filter((_, index) => index !== row.selectedIndex);

  useEffect(() => {
    setQuickFeedback(row.quickFeedback ?? null);
  }, [row.quickFeedback]);

  const handleReuseSettings = () => {
    writeReuseSession({
      draft: adoptedBody ?? row.draft,
      emotion: row.emotion,
      intensity: row.intensity,
      speedMode: row.speedMode ?? "flash",
    });
    router.push("/home");
  };

  const handleCopyBundle = async () => {
    if (!adoptedBody) return;
    await navigator.clipboard.writeText([adoptedBody, row.hashtags.join(" ")].filter(Boolean).join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  return (
    <Card className="border-primary/5 bg-card/50 transition-colors hover:bg-card">
      <CardContent className="space-y-5 p-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="rounded-full">
              単発検証
            </Badge>
            <Badge variant="secondary" className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
              {EMOTION_LABELS[row.emotion]}
            </Badge>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5" />
              <span>{formatDate(row.createdAt)}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void removeGenerationRecord(row.id).then(() => void onUpdate())}
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
                採用した仮説
              </>
            ) : (
              "未選択"
            )}
          </Badge>
          <div className="rounded-3xl border-2 border-emerald-300 bg-emerald-50/50 p-6 shadow-sm">
            <p className="text-lg leading-8 text-foreground md:text-xl">
              {adoptedBody ?? "まだ採用した仮説が選ばれていません。"}
            </p>
          </div>
        </section>

        <section className="border-t border-dashed pt-4">
          <p className="text-xs font-medium text-muted-foreground">元の種メモ</p>
          <div className="mt-2 rounded-2xl border border-border/40 bg-muted/20 px-4 py-3">
            <p className="border-l-2 border-muted-foreground/20 pl-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {row.draft}
            </p>
          </div>
        </section>

        {row.memoryTags && row.memoryTags.length > 0 ? (
          <section className="flex flex-wrap gap-2 border-t border-dashed pt-4">
            {row.memoryTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full">
                {tag}
              </Badge>
            ))}
          </section>
        ) : null}

        <section className="flex flex-wrap items-center gap-2 border-t border-dashed pt-4">
          <QuickFeedbackPicker value={quickFeedback} saving={feedbackSaving} onChange={saveQuickFeedback} />
          <Button type="button" size="sm" variant="outline" onClick={handleReuseSettings} className="gap-2 text-xs">
            <Wand2 className="size-3.5" />
            <span className="hidden sm:inline">この仮説で次を検証</span>
            <span className="sm:hidden">調整</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleCopyBundle()}
            disabled={!adoptedBody}
            className="gap-2 text-xs"
            aria-label={copied ? "コピーしました" : "一括コピー"}
          >
            <Copy className="size-3.5" />
            <span className="hidden sm:inline">{copied ? "コピーしました" : "一括コピー"}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOthersOpen((open) => !open)}
            className="gap-2 text-xs"
            aria-label={othersOpen ? "他案を閉じる" : "他案を見る"}
          >
            <ChevronDown className={cn("size-3.5 transition-transform", othersOpen && "rotate-180")} />
            <span className="hidden sm:inline">{othersOpen ? "他案を閉じる" : "他案を見る"}</span>
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
                <p className="mb-2 text-xs font-medium text-muted-foreground">検証タグ</p>
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

function SeriesItemCard({
  item,
  onUpdate,
}: {
  item: GenerationSeriesItemRecord;
  onUpdate: () => Promise<void> | void;
}) {
  const [copied, setCopied] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState<QuickFeedback>(item.quickFeedback ?? null);
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  useEffect(() => {
    setQuickFeedback(item.quickFeedback ?? null);
  }, [item.quickFeedback]);

  const saveQuickFeedback = async (next: QuickFeedback) => {
    const previous = quickFeedback;
    setQuickFeedback(next);
    setFeedbackSaving(true);
    try {
      await patchSeriesItemRecord(item.id, { quickFeedback: next });
      void onUpdate();
    } catch {
      setQuickFeedback(previous);
    } finally {
      setFeedbackSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-background/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline" className="rounded-full">
          {item.slotLabel}
        </Badge>
        <QuickFeedbackPicker value={quickFeedback} saving={feedbackSaving} onChange={saveQuickFeedback} />
      </div>
      <p className="text-sm leading-7 text-foreground">{item.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.hashtags.map((tag) => (
          <Badge key={`${item.id}-${tag}`} variant="secondary" className="rounded-full">
            {tag}
          </Badge>
        ))}
      </div>
      {item.memoryTags && item.memoryTags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.memoryTags.map((tag) => (
            <Badge key={`${item.id}-${tag}-memory`} variant="outline" className="rounded-full text-[11px]">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-2 text-xs"
          aria-label={copied ? "コピーしました" : "コピー"}
          onClick={async () => {
            await navigator.clipboard.writeText([item.body, item.hashtags.join(" ")].filter(Boolean).join("\n\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy className="size-3.5" />
          <span className="hidden sm:inline">{copied ? "コピーしました" : "コピー"}</span>
        </Button>
      </div>
    </div>
  );
}

function ArchiveSeriesRow({
  row,
  onUpdate,
}: {
  row: GenerationSeriesRecord;
  onUpdate: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const hotCount = row.items.filter((item) => item.quickFeedback === "hot").length;
  const latestItem = row.items[row.items.length - 1] ?? null;

  return (
    <div className="relative">
      <div className="absolute inset-x-4 top-3 h-full rounded-3xl border bg-card/20" />
      <div className="absolute inset-x-2 top-1.5 h-full rounded-3xl border bg-card/30" />
      <Card className="relative border-primary/5 bg-card/60 shadow-sm">
        <CardContent className="space-y-5 p-5">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  30日ロードマップ
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {EMOTION_LABELS[row.emotion]}
                </Badge>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span>{formatDate(row.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Layers3 className="size-4 text-primary" />
                <h3 className="text-lg font-semibold">{row.title}</h3>
              </div>
              <div className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-3">
                <p className="border-l-2 border-muted-foreground/20 pl-3 line-clamp-2 text-sm text-muted-foreground">
                  {row.draft}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">
                🔥 {hotCount}/{row.items.length}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void removeSeriesRecord(row.id).then(() => void onUpdate())}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </header>

          {row.ghostWhisper ? (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              {row.ghostWhisper}
            </div>
          ) : null}

          {row.memoryTags && row.memoryTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {row.memoryTags.map((tag) => (
                <Badge key={`${row.id}-${tag}`} variant="secondary" className="rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          {latestItem ? (
            <section className="space-y-3 rounded-2xl border border-primary/10 bg-background/85 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="rounded-full">
                    最新フェーズ
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {latestItem.slotLabel}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">最新の検証フェーズ</span>
              </div>
              <p className="text-sm leading-7 text-foreground">{latestItem.body}</p>
              <div className="flex flex-wrap gap-2">
                {latestItem.hashtags.map((tag) => (
                  <Badge key={`${latestItem.id}-${tag}`} variant="outline" className="rounded-full text-[11px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                writeReuseSession({
                  draft: row.draft,
                  emotion: row.emotion,
                  intensity: row.intensity,
                  speedMode: row.speedMode ?? "flash",
                });
                router.push("/home");
              }}
              className="gap-2 text-xs"
            >
              <Wand2 className="size-3.5" />
              <span className="hidden sm:inline">この仮説で次を検証</span>
              <span className="sm:hidden">調整</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen((current) => !current)}
              className="gap-2 text-xs"
              aria-label={open ? "ロードマップを閉じる" : "ロードマップを展開する"}
            >
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
              <span className="hidden sm:inline">{open ? "ロードマップを閉じる" : "ロードマップを展開する"}</span>
            </Button>
          </div>

          {open ? (
            <section className="grid gap-3 border-t border-dashed pt-4 md:grid-cols-3">
              {row.items.map((item) => (
                <SeriesItemCard key={item.id} item={item} onUpdate={onUpdate} />
              ))}
            </section>
          ) : null}
        </CardContent>
      </Card>
    </div>
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

