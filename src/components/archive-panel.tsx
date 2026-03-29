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

function InsightsDashboard({ overview }: { overview: ArchiveOverview }) {
  const maxUsage = Math.max(...overview.insights.emotionBreakdown.map((entry) => entry.usageCount), 1);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/10 bg-card/70">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-medium text-muted-foreground">今の発信状態</p>
            <p className="text-3xl font-bold">{overview.insights.totalHot}</p>
            <p className="text-sm text-muted-foreground">
              単発 {overview.insights.totalSingles}件 / 連載 {overview.insights.totalSeries}件
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/10 bg-card/70">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-medium text-muted-foreground">連載の完走率</p>
            <p className="text-3xl font-bold">{overview.insights.seriesCompletionRate}%</p>
            <p className="text-sm text-muted-foreground">
              連載エピソードのうち評価が付いた割合。🔥率は {overview.insights.seriesHotRate}% です。
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/10 bg-card/70">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-medium text-muted-foreground">成功パターンの言語化</p>
            <p className="text-sm leading-7 text-foreground">{overview.insights.bestPatternSummary}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/10 bg-card/70">
        <CardHeader className="space-y-2 pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <h2 className="text-base font-semibold">感情分布グラフ</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            どの感情を多用しているかと、どの感情が成功しやすかったかを並べて見ます。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {overview.insights.emotionBreakdown.map((entry) => (
            <div key={entry.emotion} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full">
                    {entry.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">使用 {entry.usageCount}回</span>
                </div>
                <span className="text-sm font-medium">🔥率 {entry.hotRate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${(entry.usageCount / maxUsage) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

export function ArchivePanel() {
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError(e instanceof Error ? e.message : "分析データの取得に失敗しました");
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
          : "既に履歴があるため、サンプル投稿の追加はスキップしました。",
      );
      await refresh();
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : "サンプル投稿の追加に失敗しました");
    } finally {
      setSeeding(false);
    }
  };

  const entries = (overview?.entries ?? []).filter((entry) => {
    if (modeFilter !== "all" && entry.generationMode !== modeFilter) return false;
    return matchesFeedback(entry, filter);
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 pb-28 md:px-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">分析センター</h1>
        <p className="text-muted-foreground">
          今のあなたの発信状態を見える化し、単発と連載の成功パターンを次の生成へつなげます。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => void handleSeedSamples()} disabled={seeding}>
            {seeding ? "サンプル投稿を追加中..." : "サンプル投稿を入れる"}
          </Button>
          <span className="text-xs text-muted-foreground">デモや初期検証用に、分析材料を追加できます。</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={modeFilter === "all" ? "default" : "outline"} onClick={() => setModeFilter("all")}>
            すべて
          </Button>
          <Button type="button" size="sm" variant={modeFilter === "single" ? "default" : "outline"} onClick={() => setModeFilter("single")}>
            単発
          </Button>
          <Button type="button" size="sm" variant={modeFilter === "series" ? "default" : "outline"} onClick={() => setModeFilter("series")}>
            連載
          </Button>
          {QUICK_FEEDBACK_OPTIONS.map((option) => (
            <Button
              key={option.shortLabel}
              type="button"
              size="sm"
              variant="outline"
              className={cn(filter === option.value ? option.filterClassName : "text-muted-foreground")}
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
      ) : overview == null ? null : (
        <>
          <InsightsDashboard overview={overview} />

          {entries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {overview.entries.length === 0 ? (
                  <p>
                    まだ記録がありません。
                    <Link href="/home" className="px-1 font-medium text-primary underline-offset-4 hover:underline">
                      作成画面
                    </Link>
                    で投稿を生成すると、ここが分析センターとして育ちます。
                  </p>
                ) : (
                  <p>この条件に一致する投稿はまだありません。</p>
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
        </>
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
              単発
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
            この案をベースに調整
          </Button>
          <Button type="button" size="sm" onClick={() => void handleCopyBundle()} disabled={!adoptedBody} className="gap-2 text-xs">
            <Copy className="size-3.5" />
            {copied ? "コピーしました" : "一括コピー"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOthersOpen((open) => !open)} className="gap-2 text-xs">
            <ChevronDown className={cn("size-3.5 transition-transform", othersOpen && "rotate-180")} />
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
          onClick={async () => {
            await navigator.clipboard.writeText([item.body, item.hashtags.join(" ")].filter(Boolean).join("\n\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy className="size-3.5" />
          {copied ? "コピーしました" : "コピー"}
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
                  連載
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
              <p className="line-clamp-2 text-sm text-muted-foreground">{row.draft}</p>
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
              この連載をベースに調整
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((current) => !current)} className="gap-2 text-xs">
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
              {open ? "連載を閉じる" : "連載を展開する"}
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

