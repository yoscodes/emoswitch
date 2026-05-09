"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, Flame, History, Snowflake, Tags } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  appendIdentityFieldBufferEntry as appendIdentityFieldBufferEntryRemote,
  DATA_SYNC_EVENT,
  ensureDemoWorkspace,
  fetchIdentityFieldBufferSeriesSummary,
  fetchArchiveOverview,
  patchSeriesItemRecord,
  seedArchiveSampleData,
} from "@/lib/api-client";
import { EMOTION_LABELS, type EmotionTone } from "@/lib/emotions";
import {
  appendIdentityFieldLog,
  readFirstActionDone,
  readIdentityFieldLog,
  readRoadmapChecklist,
  readRoadmapDeployContext,
  splitStoredPlanBody,
  summarizeIdentityFieldBufferBySeries,
  writeRoadmapChecklist,
  type RoadmapDeployContextV1,
} from "@/lib/roadmap-deploy";
import { deriveRoadmapSeriesStatus } from "@/lib/roadmap-series-status";
import { sortSeriesLikeItemsBySlotOrder } from "@/lib/series";
import type { ArchiveOverview, GenerationSeriesRecord, QuickFeedback } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSeriesRecord(entry: { generationMode: string }): entry is GenerationSeriesRecord {
  return entry.generationMode === "series";
}

export function RoadmapWorkspace() {
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployCtx, setDeployCtx] = useState<RoadmapDeployContextV1 | null>(null);
  const [checklist, setChecklist] = useState<boolean[]>([false, false, false, false, false]);
  const [quickFeedback, setQuickFeedback] = useState<QuickFeedback>(null);
  const [memoInput, setMemoInput] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackGuide, setFeedbackGuide] = useState<string | null>(null);
  const [sampleSeedBusy, setSampleSeedBusy] = useState(false);
  const [identityFieldBuffer, setIdentityFieldBuffer] = useState<ReturnType<typeof readIdentityFieldLog>>([]);
  const [serverPendingBySeries, setServerPendingBySeries] = useState<Record<string, number>>({});
  const autoRoadmapSampleAttemptedRef = useRef(false);

  const refreshIdentityFieldBuffer = useCallback(() => {
    setIdentityFieldBuffer(readIdentityFieldLog());
  }, []);

  const refreshServerPending = useCallback(async () => {
    try {
      const rows = await fetchIdentityFieldBufferSeriesSummary();
      const next: Record<string, number> = {};
      for (const row of rows) next[row.seriesId] = row.pendingCount;
      setServerPendingBySeries(next);
    } catch {
      // ignore: keep current snapshot when summary API fails
    }
  }, []);

  useEffect(() => {
    refreshIdentityFieldBuffer();
    void refreshServerPending();
    if (typeof window === "undefined") return;
    const onSync = () => {
      refreshIdentityFieldBuffer();
      void refreshServerPending();
    };
    window.addEventListener(DATA_SYNC_EVENT, onSync);
    return () => window.removeEventListener(DATA_SYNC_EVENT, onSync);
  }, [refreshIdentityFieldBuffer, refreshServerPending]);

  const identityBufferBySeries = useMemo(
    () => summarizeIdentityFieldBufferBySeries(identityFieldBuffer),
    [identityFieldBuffer],
  );

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setOverview(await fetchArchiveOverview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDeployCtx(readRoadmapDeployContext());
    void refresh();
    const onSync = () => {
      setDeployCtx(readRoadmapDeployContext());
      void refresh();
    };
    window.addEventListener(DATA_SYNC_EVENT, onSync);
    return () => window.removeEventListener(DATA_SYNC_EVENT, onSync);
  }, [refresh]);

  /** 連載が1件も無いとき、API 経由でデモ用シリーズを投入（ログインユーザーにも紐づく） */
  const trySeedRoadmapSamples = useCallback(async (): Promise<number> => {
    await ensureDemoWorkspace();
    const { insertedCount } = await seedArchiveSampleData();
    return insertedCount;
  }, []);

  useEffect(() => {
    if (loading || overview == null) return;
    const series = (overview.entries ?? []).filter(isSeriesRecord);
    if (series.length > 0) return;
    if (autoRoadmapSampleAttemptedRef.current) return;
    autoRoadmapSampleAttemptedRef.current = true;

    void (async () => {
      try {
        const insertedCount = await trySeedRoadmapSamples();
        if (insertedCount > 0) await refresh();
      } catch {
        /* 手動ボタンで再試行可能にするため ref は戻さない */
      }
    })();
  }, [loading, overview, refresh, trySeedRoadmapSamples]);

  const seriesEntries = useMemo(() => {
    const rows = overview?.entries ?? [];
    return rows.filter(isSeriesRecord);
  }, [overview?.entries]);

  const activeSeries = useMemo(() => {
    const q = searchParams.get("series")?.trim();
    const fromQuery = q ? seriesEntries.find((s) => s.id === q) : undefined;
    if (fromQuery) return fromQuery;
    const ctxId = deployCtx?.seriesId;
    const fromCtx = ctxId ? seriesEntries.find((s) => s.id === ctxId) : undefined;
    if (fromCtx) return fromCtx;
    return [...seriesEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  }, [deployCtx?.seriesId, searchParams, seriesEntries]);

  const ctxEffective = useMemo(() => {
    if (!activeSeries) return deployCtx;
    if (deployCtx?.seriesId === activeSeries.id) return deployCtx;
    return null;
  }, [activeSeries, deployCtx]);

  const seriesItemsTimeline = useMemo(
    () => (activeSeries ? sortSeriesLikeItemsBySlotOrder(activeSeries.items) : []),
    [activeSeries],
  );

  const anchorItem = seriesItemsTimeline[0] ?? null;

  useEffect(() => {
    if (!activeSeries) {
      setChecklist([false, false, false, false, false]);
      return;
    }
    let row = readRoadmapChecklist(activeSeries.id);
    if (!row.some(Boolean) && readFirstActionDone(activeSeries.id)) {
      row = [...row];
      row[0] = true;
      writeRoadmapChecklist(activeSeries.id, row);
    }
    setChecklist(row);
  }, [activeSeries?.id]);

  useEffect(() => {
    if (!anchorItem) return;
    setQuickFeedback(anchorItem.quickFeedback ?? null);
    setMemoInput(anchorItem.memo ?? "");
    setFeedbackSent(false);
    setFeedbackGuide(null);
  }, [anchorItem?.id, anchorItem?.quickFeedback, anchorItem?.memo]);

  const missionFinalGoal = ctxEffective?.finalGoal ?? "次の検証で、市場から確かな反応を取りにいく。";
  const missionFirst = ctxEffective?.firstAction ?? "まずは最小の投稿またはDMで仮説を一文に落とす。";

  const allHashtags = useMemo(() => {
    const set = new Set<string>();
    seriesItemsTimeline.forEach((item) => item.hashtags.forEach((t) => set.add(t)));
    return [...set];
  }, [seriesItemsTimeline]);
  const compactTagBadges = useMemo(() => {
    const badges: string[] = [];
    if (ctxEffective?.usagePurposeLabel) badges.push(`${ctxEffective.usagePurposeLabel}`);
    if (ctxEffective?.weaponLabel) badges.push(`${ctxEffective.weaponLabel}`);
    if (badges.length < 2) badges.push(EMOTION_LABELS[activeSeries?.emotion ?? "empathy"]);
    return badges.slice(0, 2);
  }, [activeSeries?.emotion, ctxEffective?.usagePurposeLabel, ctxEffective?.weaponLabel]);
  const hiddenKeywordTagCount = useMemo(() => {
    const count = (activeSeries?.memoryTags?.length ?? 0) + allHashtags.length;
    return Math.max(0, count);
  }, [activeSeries?.memoryTags?.length, allHashtags.length]);

  const archiveRows = useMemo(() => {
    return [...seriesEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [seriesEntries]);

  const setChecklistAt = useCallback((index: number, value: boolean) => {
    if (!activeSeries || index < 0 || index > 4) return;
    setChecklist((prev) => {
      const next = [...prev.slice(0, 5)];
      while (next.length < 5) next.push(false);
      next[index] = value;
      writeRoadmapChecklist(activeSeries.id, next);
      return next;
    });
  }, [activeSeries]);

  const saveFeedback = async () => {
    if (!anchorItem) return;
    if (quickFeedback == null) {
      setFeedbackGuide("今の感触を選んでください。");
      return;
    }
    setFeedbackSaving(true);
    setError(null);
    setFeedbackGuide(null);
    const memo = memoInput.trim() === "" ? null : memoInput.trim();
    try {
      await patchSeriesItemRecord(anchorItem.id, { quickFeedback, memo });
      if (activeSeries) {
        appendIdentityFieldLog({
          at: new Date().toISOString(),
          seriesId: activeSeries.id,
          itemId: anchorItem.id,
          quickFeedback,
          likes: null,
          memo,
        });
        await appendIdentityFieldBufferEntryRemote({
          seriesId: activeSeries.id,
          itemId: anchorItem.id,
          quickFeedback,
          likes: null,
          memo,
        });
      }
      await refreshServerPending();
      await refresh();
      setFeedbackSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setFeedbackSaving(false);
    }
  };

  if (loading && overview == null) {
    return (
      <div className="mx-auto w-full max-w-[2200px] px-4 py-16 text-center text-muted-foreground md:px-6 xl:px-8 2xl:px-10">読み込み中…</div>
    );
  }

  if (error && overview == null) {
    return (
      <div className="mx-auto w-full max-w-[2200px] px-4 py-16 text-center text-destructive md:px-6 xl:px-8 2xl:px-10">{error}</div>
    );
  }

  /** Ghost は HUD に常時表示。レールは advice のみ（重複を避ける） */
  const mentorCards =
    activeSeries?.adviceHint?.trim() ? (
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">メンター（作戦遂行中）</p>
        <div className="rounded-xl border border-sky-200/70 bg-sky-50/95 p-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/30">
          <p className="text-[10px] font-semibold text-sky-900 dark:text-sky-100">メンター・メモ</p>
          <p className="mt-1 leading-relaxed text-sky-950/90 dark:text-sky-50/90">{activeSeries.adviceHint}</p>
        </div>
      </div>
    ) : null;

  return (
    <div className="relative mx-auto w-full max-w-[2200px] space-y-6 px-4 py-8 pb-28 md:px-6 xl:flex xl:h-[calc(100vh-4rem)] xl:flex-col xl:overflow-hidden xl:px-8 xl:pb-6 2xl:px-10">
      <header className="space-y-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Roadmap</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            過去の反省を参照しながら、現在の作戦を実行し、検証結果を記録します。
          </p>
        </div>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!activeSeries ? (
        <Card>
          <CardContent className="space-y-4 py-12 text-center">
            <p className="text-muted-foreground">
              まだアクティブな作戦がありません。{" "}
              <Link href="/lab" className="font-medium text-primary underline-offset-4 hover:underline">
                Lab で生成
              </Link>
              し、モーダルから「Roadmap にデプロイする」を押すとここに展開されます。
            </p>
            <p className="text-xs text-muted-foreground">
              ポートフォリオ閲覧用に、Vault に連載サンプルを載せることもできます（あなたのアカウントに保存されます）。
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={sampleSeedBusy || loading}
              onClick={() => {
                void (async () => {
                  setSampleSeedBusy(true);
                  setError(null);
                  try {
                    const insertedCount = await trySeedRoadmapSamples();
                    if (insertedCount > 0) {
                      await refresh();
                    } else {
                      setError("サンプルは既に登録されているか、投入できませんでした。");
                    }
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "サンプルの読み込みに失敗しました");
                  } finally {
                    setSampleSeedBusy(false);
                  }
                })();
              }}
            >
              {sampleSeedBusy ? "読み込み中…" : "サンプル作戦を Vault に読み込む"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 1. Current guidance strip */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/85 px-3 py-2 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mission</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-foreground" title={missionFinalGoal}>
              {missionFinalGoal}
            </span>
            {compactTagBadges.map((badge) => (
              <Badge key={badge} variant="secondary" className="rounded-full whitespace-nowrap text-[10px]">
                {badge}
              </Badge>
            ))}
            {hiddenKeywordTagCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                <Tags className="size-3" />
                タグ {hiddenKeywordTagCount}件
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,0.68fr)_minmax(0,0.32fr)] xl:overflow-hidden">
            {/* Left: active protocol */}
            <div className="space-y-6 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-violet-600" />
                    <p className="text-sm font-semibold">アクティブ・プロトコル</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{activeSeries.title}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">アクションツリー</p>
                    <ol className="mt-3 space-y-3 border-l-2 border-dashed border-border/60 pl-4">
                      <li className="relative">
                        <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-violet-500 ring-4 ring-background" />
                        <label className="flex cursor-pointer gap-3 rounded-xl border-2 border-violet-300/60 bg-violet-50/50 px-3 py-2 dark:border-violet-700/50 dark:bg-violet-950/20">
                          <input
                            type="checkbox"
                            checked={Boolean(checklist[0])}
                            onChange={(e) => setChecklistAt(0, e.target.checked)}
                            className="mt-1 size-4 shrink-0 accent-violet-600"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="rounded-full bg-violet-600 text-[10px] text-white">START</Badge>
                              <span className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                                First Action（今日の一歩）
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">{missionFirst}</p>
                          </div>
                        </label>
                      </li>
                      {seriesItemsTimeline.map((item, index) => {
                        const { narrative, immediate } = splitStoredPlanBody(item.body);
                        const verifiedHot = Boolean(item.quickFeedback === "hot");
                        const checklistIndex = index + 1;
                        const stepChecked = Boolean(checklist[checklistIndex]);
                        return (
                          <li key={item.id} className="relative">
                            <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-violet-500 ring-4 ring-background" />
                            <label className="flex cursor-pointer gap-3 rounded-xl border bg-muted/20 px-3 py-2">
                              <input
                                type="checkbox"
                                checked={stepChecked}
                                onChange={(e) => setChecklistAt(checklistIndex, e.target.checked)}
                                className="mt-1 size-4 shrink-0 accent-violet-600"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="rounded-full text-[10px]">
                                    STEP {index + 1}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{item.slotLabel}</span>
                                  {verifiedHot ? (
                                    <Badge className="rounded-full bg-emerald-600 text-[10px] text-white">検証🔥</Badge>
                                  ) : null}
                                </div>
                                {immediate ? (
                                  <p className="mt-2 border-l-2 border-violet-400/50 pl-2 text-sm text-foreground dark:text-foreground">
                                    <span className="font-semibold text-violet-800 dark:text-violet-300">すぐやること:</span>{" "}
                                    <span>{immediate}</span>
                                  </p>
                                ) : (
                                  <p className="mt-2 text-sm text-muted-foreground">すぐやること: （未設定）</p>
                                )}
                                {narrative ? (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                      意図・背景を開く
                                    </summary>
                                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{narrative}</p>
                                  </details>
                                ) : null}
                              </div>
                            </label>
                          </li>
                        );
                      })}
                      <li className="relative">
                        <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-fuchsia-500 ring-4 ring-background" />
                        <label className="flex cursor-pointer gap-3 rounded-xl border border-fuchsia-200/50 bg-fuchsia-50/30 px-3 py-2 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/15">
                          <input
                            type="checkbox"
                            checked={Boolean(checklist[4])}
                            onChange={(e) => setChecklistAt(4, e.target.checked)}
                            className="mt-1 size-4 shrink-0 accent-fuchsia-600"
                          />
                          <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">最終目標: </span>
                            {missionFinalGoal}
                          </div>
                        </label>
                      </li>
                    </ol>
                  </div>

                  {(mentorCards || ctxEffective?.dnaAlignmentReason || ctxEffective?.protocolLines?.length) ? (
                    <section className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        作戦の裏側（Reference）
                      </p>

                      {mentorCards ? <div className="xl:hidden">{mentorCards}</div> : null}

                      {ctxEffective?.dnaAlignmentReason ? (
                        <details>
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                            Lab 共鳴メモ
                          </summary>
                          <div className="mt-2 rounded-lg border border-border/40 bg-background/80 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                            {ctxEffective.dnaAlignmentReason}
                          </div>
                        </details>
                      ) : null}

                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                          作戦詳細（生成本文）
                        </summary>
                        <div className="mt-2 space-y-3 rounded-lg border border-dashed bg-background/80 p-3">
                          {seriesItemsTimeline.map((item) => {
                            const { narrative } = splitStoredPlanBody(item.body);
                            return (
                              <div key={`acc-${item.id}`}>
                                <p className="text-[10px] font-semibold text-muted-foreground">{item.slotLabel}</p>
                                <p className="mt-1 text-sm leading-relaxed text-foreground/90">{narrative}</p>
                              </div>
                            );
                          })}
                          <div className="border-t pt-2">
                            <p className="text-[10px] font-semibold text-muted-foreground">種メモ（Lab 入力）</p>
                            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{activeSeries.draft}</p>
                          </div>
                        </div>
                      </details>

                      {ctxEffective?.protocolLines?.length ? (
                        <details>
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                            ハット視点（Lab モーダル）
                          </summary>
                          <ul className="mt-2 space-y-2">
                            {ctxEffective.protocolLines.map((line, i) => (
                              <li key={i} className="rounded-lg border bg-background/70 px-3 py-2 text-xs leading-relaxed">
                                <span className="font-semibold text-muted-foreground">
                                  {line.short}（{line.hat}）
                                </span>
                                ：{line.line}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </section>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* Right: insight hub */}
            <aside className="space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pl-1">
              <Card>
                <CardHeader>
                  <p className="text-sm font-semibold">検証フィードバック</p>
                </CardHeader>
                <CardContent className={cn("space-y-4 transition-opacity", feedbackSent && "opacity-80")}>
                  {feedbackSent ? (
                    <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/20 dark:text-emerald-200">
                      ✅ 送信済み
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">今の感触</p>
                    <div className="grid grid-cols-2 rounded-xl border border-border/60 bg-muted/30 p-1">
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                          quickFeedback === "hot"
                            ? "bg-violet-600 text-white shadow-sm"
                            : "text-muted-foreground hover:bg-background/70",
                        )}
                        disabled={feedbackSaving}
                        onClick={() => {
                          setQuickFeedback("hot");
                          setFeedbackSent(false);
                          setFeedbackGuide(null);
                        }}
                      >
                        <Flame className="size-3.5" />
                        手応えあり
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                          quickFeedback === "cold"
                            ? "bg-violet-600 text-white shadow-sm"
                            : "text-muted-foreground hover:bg-background/70",
                        )}
                        disabled={feedbackSaving}
                        onClick={() => {
                          setQuickFeedback("cold");
                          setFeedbackSent(false);
                          setFeedbackGuide(null);
                        }}
                      >
                        <Snowflake className="size-3.5" />
                        何か違う
                      </button>
                    </div>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-foreground">想定と何が違ったか（Identity へ還流）</span>
                    <Textarea
                      value={memoInput}
                      onChange={(e) => {
                        setMemoInput(e.target.value);
                        setFeedbackSent(false);
                      }}
                      className="min-h-[120px] border-border"
                      placeholder="例: 避けるべき言い回しが刺さっていない。次回は「不安を煽る型」を外し、当事者の痛みを具体化する。"
                    />
                  </label>
                  {feedbackGuide ? <p className="text-xs text-amber-600">{feedbackGuide}</p> : null}
                  <Button
                    type="button"
                    className="w-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    disabled={feedbackSaving || !anchorItem || feedbackSent}
                    onClick={() => void saveFeedback()}
                  >
                    {feedbackSaving ? "送信中…" : feedbackSent ? "送信済み" : "結果をバッファへ送信"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <History className="size-4" />
                    <p className="text-sm font-semibold">進化の軌跡</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2">
                    {archiveRows.map((row) => {
                      const hot = row.items.filter((i) => i.quickFeedback === "hot").length;
                    const status = deriveRoadmapSeriesStatus(row, activeSeries?.id ?? null);
                      const pendingIdentityCount =
                        serverPendingBySeries[row.id] ?? identityBufferBySeries[row.id]?.total ?? 0;
                    return (
                        <li key={`right-${row.id}`}>
                          <Link
                            href={`/roadmap?series=${row.id}`}
                            className={cn(
                              "block rounded-xl border bg-card/60 p-3 transition-colors hover:bg-card",
                              status === "active" && "ring-2 ring-violet-500/40",
                            )}
                          >
                            <p className="truncate text-xs font-medium">{row.title}</p>
                            <div className="mt-1 flex items-center gap-1">
                              <Badge
                                className={cn(
                                  "rounded-full text-[9px] text-white",
                                  status === "active" && "bg-violet-600",
                                  status === "hot" && "bg-rose-500",
                                  status === "archived" && "bg-zinc-500",
                                )}
                              >
                                {status === "active" ? "ACTIVE" : status === "hot" ? "HOT" : "ARCHIVED"}
                              </Badge>
                              <Badge variant="outline" className="rounded-full text-[9px]">
                                🔥 {hot}/{row.items.length}
                              </Badge>
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {pendingIdentityCount > 0 ? `DNA未反映 ${pendingIdentityCount}件` : "DNA還流: 完了"}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </div>

        </>
      )}
    </div>
  );
}
