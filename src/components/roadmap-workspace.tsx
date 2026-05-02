"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, ChevronDown, Compass, Flame, History, Snowflake, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DATA_SYNC_EVENT,
  ensureDemoWorkspace,
  fetchArchiveOverview,
  patchSeriesItemRecord,
  seedArchiveSampleData,
} from "@/lib/api-client";
import { EMOTION_LABELS, type EmotionTone } from "@/lib/emotions";
import {
  appendIdentityFieldLog,
  IDENTITY_FIELD_BUFFER_ALERT_HOT,
  IDENTITY_FIELD_BUFFER_ALERT_TOTAL,
  readFirstActionDone,
  readIdentityFieldLog,
  readRoadmapChecklist,
  readRoadmapDeployContext,
  splitStoredPlanBody,
  summarizeIdentityFieldBuffer,
  writeRoadmapChecklist,
  type RoadmapDeployContextV1,
} from "@/lib/roadmap-deploy";
import type { ArchiveOverview, GenerationSeriesItemRecord, GenerationSeriesRecord, QuickFeedback } from "@/lib/types";
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

/** Lab デプロイ時の共鳴％をベースに、チェック完了と検証入力で「目的からのブレ」を近似する（0–100） */
function computeRealtimeAlignmentPercent(params: {
  baselinePercent: number | null;
  series: GenerationSeriesRecord;
  checklist: boolean[];
}): number {
  const baseRaw =
    typeof params.baselinePercent === "number" && !Number.isNaN(params.baselinePercent)
      ? params.baselinePercent
      : null;
  const base = baseRaw != null ? Math.min(100, Math.max(0, Math.round(baseRaw))) : 52;

  const checks = params.checklist.filter(Boolean).length;
  const checklistBonus = Math.min(15, checks * 3);

  let execution = 0;
  for (const item of params.series.items) {
    if (item.quickFeedback === "hot") execution += 6;
    if (item.quickFeedback === "cold") execution -= 8;
    if (item.memo?.trim()) execution += 3;
    if (item.likes != null && item.likes > 0) execution += 2;
  }
  execution = Math.min(25, Math.max(-22, execution));

  return Math.min(100, Math.max(8, Math.round(base + checklistBonus + execution)));
}

/** 市場の反応・メモ・数値・タスク完了を「知見」としてカウント */
function countInsightsCollected(params: { series: GenerationSeriesRecord; checklist: boolean[] }): number {
  let n = 0;
  for (const done of params.checklist) {
    if (done) n += 1;
  }
  for (const item of params.series.items) {
    if (item.quickFeedback != null) n += 1;
    if (item.memo?.trim()) n += 1;
    if (item.likes != null && item.likes > 0) n += 1;
  }
  return n;
}

function evolutionHint(insights: ArchiveOverview["insights"], seriesEmotion: EmotionTone): string | null {
  const empathy = insights.emotionBreakdown.find((e) => e.emotion === "empathy");
  if (empathy && empathy.usageCount >= 2 && empathy.hotRate < 25 && seriesEmotion === "empathy") {
    return "直近ログでは「共感」軸の🔥率が伸び悩みです。Identity のトーンと Lab の武器の組み合わせを再調整することを推奨します。";
  }
  const total = insights.totalSingles + insights.totalSeries;
  if (total >= 5 && insights.totalHot <= 1) {
    return `${insights.bestPatternSummary.slice(0, 140)}${insights.bestPatternSummary.length > 140 ? "…" : ""}`;
  }
  return null;
}

export function RoadmapWorkspace() {
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployCtx, setDeployCtx] = useState<RoadmapDeployContextV1 | null>(null);
  const [checklist, setChecklist] = useState<boolean[]>([false, false, false, false, false]);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState<QuickFeedback>(null);
  const [likesInput, setLikesInput] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [sampleSeedBusy, setSampleSeedBusy] = useState(false);
  const [identityFieldBuffer, setIdentityFieldBuffer] = useState<ReturnType<typeof readIdentityFieldLog>>([]);
  const autoRoadmapSampleAttemptedRef = useRef(false);

  const refreshIdentityFieldBuffer = useCallback(() => {
    setIdentityFieldBuffer(readIdentityFieldLog());
  }, []);

  useEffect(() => {
    refreshIdentityFieldBuffer();
    if (typeof window === "undefined") return;
    window.addEventListener(DATA_SYNC_EVENT, refreshIdentityFieldBuffer);
    return () => window.removeEventListener(DATA_SYNC_EVENT, refreshIdentityFieldBuffer);
  }, [refreshIdentityFieldBuffer]);

  const identityBufferSummary = useMemo(
    () => summarizeIdentityFieldBuffer(identityFieldBuffer),
    [identityFieldBuffer],
  );
  const showIdentityEvolutionAlert =
    identityBufferSummary.total >= IDENTITY_FIELD_BUFFER_ALERT_TOTAL ||
    identityBufferSummary.hot >= IDENTITY_FIELD_BUFFER_ALERT_HOT;

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

  const anchorItem = activeSeries?.items[0] ?? null;

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
    setLikesInput(anchorItem.likes != null ? String(anchorItem.likes) : "");
    setMemoInput(anchorItem.memo ?? "");
  }, [anchorItem?.id, anchorItem?.quickFeedback, anchorItem?.likes, anchorItem?.memo]);

  const realtimeAlignmentPercent = useMemo(() => {
    if (!activeSeries) return 52;
    return computeRealtimeAlignmentPercent({
      baselinePercent: ctxEffective?.identityResonancePercent ?? null,
      series: activeSeries,
      checklist,
    });
  }, [activeSeries, checklist, ctxEffective]);

  const insightsCollectedCount = useMemo(() => {
    if (!activeSeries) return 0;
    return countInsightsCollected({ series: activeSeries, checklist });
  }, [activeSeries, checklist]);

  const missionFinalGoal = ctxEffective?.finalGoal ?? "次の検証で、市場から確かな反応を取りにいく。";
  const missionFirst = ctxEffective?.firstAction ?? "まずは最小の投稿またはDMで仮説を一文に落とす。";

  const allHashtags = useMemo(() => {
    if (!activeSeries) return [];
    const set = new Set<string>();
    activeSeries.items.forEach((item) => item.hashtags.forEach((t) => set.add(t)));
    return [...set];
  }, [activeSeries]);

  const evolution = overview?.insights && activeSeries ? evolutionHint(overview.insights, activeSeries.emotion) : null;

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
    setFeedbackSaving(true);
    setError(null);
    const parsedLikes = likesInput.trim() === "" ? null : Number.parseInt(likesInput, 10);
    const likes = parsedLikes == null || Number.isNaN(parsedLikes) ? null : parsedLikes;
    const memo = memoInput.trim() === "" ? null : memoInput.trim();
    try {
      await patchSeriesItemRecord(anchorItem.id, { quickFeedback, likes, memo });
      if (activeSeries) {
        appendIdentityFieldLog({
          at: new Date().toISOString(),
          seriesId: activeSeries.id,
          itemId: anchorItem.id,
          quickFeedback,
          likes,
          memo,
        });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setFeedbackSaving(false);
    }
  };

  if (loading && overview == null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-muted-foreground md:px-6">読み込み中…</div>
    );
  }

  if (error && overview == null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-destructive md:px-6">{error}</div>
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

  const mentorRailPinned =
    mentorCards != null ? (
      <aside
        className={cn(
          "pointer-events-auto z-30 hidden max-h-[calc(100vh-7rem)] w-64 shrink-0 overflow-y-auto rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur-md xl:fixed xl:right-6 xl:top-24 xl:block",
        )}
      >
        {mentorCards}
      </aside>
    ) : null;

  return (
    <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-8 pb-28 md:px-6 xl:max-w-[min(100vw-18rem,72rem)] xl:pr-72">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full text-[10px]">
            Strategic Integrity
          </Badge>
          <Compass className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Roadmap</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          戦略の純度（Identity との整合）を確認しながら、プロトコルを実行し、検証結果を記録します。
        </p>
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
          {mentorRailPinned}
          {/* 1. Strategic Integrity HUD */}
          <Card className="overflow-hidden border-violet-200/50 bg-linear-to-br from-violet-50/80 via-background to-fuchsia-50/40 dark:border-violet-900/40 dark:from-violet-950/25 dark:via-background dark:to-fuchsia-950/15">
            <CardHeader className="space-y-4 pb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strategic Integrity</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">戦略の純度</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  このアクションが、自分の Identity（思想）をどれだけ体現できているかを見るダッシュボードです。
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 dark:border-amber-900/45 dark:bg-amber-950/25">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                  Identity DNA — 今回守るべきスタンス
                </p>
                <p
                  className="mt-1.5 text-sm font-semibold leading-snug text-amber-950 dark:text-amber-50"
                  title={activeSeries.ghostWhisper?.trim() ?? undefined}
                >
                  {activeSeries.ghostWhisper?.trim() ? (
                    <span className="line-clamp-1">{activeSeries.ghostWhisper.trim()}</span>
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      Lab で Identity Filter ON の連載を生成すると、Ghost Whisper がここに表示されます。
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Identity 共鳴度（リアルタイム整合）
                  </p>
                  <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-violet-700 dark:text-violet-200">
                    {realtimeAlignmentPercent}
                    <span className="text-lg font-semibold">%</span>
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Lab 生成時の共鳴を起点に、アクションのチェックと検証フィードバックのたびに更新されます。当初の目的からブレず進めているかの目安です。
                  </p>
                </div>
                <div className="w-full shrink-0 border-t border-border/20 pt-4 sm:w-auto sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 md:min-w-[200px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">獲得した知見</p>
                  <p className="mt-1 text-xs text-muted-foreground">Insights Collected</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-fuchsia-700 dark:text-fuchsia-200">{insightsCollectedCount}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    タスク完了・反応記録・メモ・数値入力の合計です（市場からの手がかりと気づきのストック）。
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 border-t border-border/20 pt-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">現在のミッション（Final Goal）</p>
                <p className="mt-2 text-lg font-medium leading-relaxed text-foreground">{missionFinalGoal}</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">作戦の前提（タグ）</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ctxEffective ? (
                    <>
                      <Badge variant="secondary" className="rounded-full">
                        活用: {ctxEffective.usagePurposeLabel}
                      </Badge>
                      {ctxEffective.weaponLabel ? (
                        <Badge variant="secondary" className="rounded-full">
                          武器: {ctxEffective.weaponLabel}
                        </Badge>
                      ) : null}
                    </>
                  ) : null}
                  <Badge variant="outline" className="rounded-full">
                    {EMOTION_LABELS[activeSeries.emotion]}
                  </Badge>
                  {(activeSeries.memoryTags ?? []).map((tag) => (
                    <Badge key={tag} variant="outline" className="rounded-full text-[11px]">
                      {tag.startsWith("#") ? tag : `#${tag}`}
                    </Badge>
                  ))}
                  {allHashtags.slice(0, 12).map((tag) => (
                    <Badge key={`h-${tag}`} variant="outline" className="rounded-full text-[11px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* 2. Active protocol */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-violet-600" />
                    <p className="text-sm font-semibold">アクティブ・プロトコル</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{activeSeries.title}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <label className="flex cursor-pointer gap-3 rounded-2xl border-2 border-violet-300/60 bg-violet-50/50 p-4 dark:border-violet-700/50 dark:bg-violet-950/20">
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[0])}
                      onChange={(e) => setChecklistAt(0, e.target.checked)}
                      className="mt-1 size-4 shrink-0 accent-violet-600"
                    />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                        First Action（今日の一歩）
                      </p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">{missionFirst}</p>
                    </div>
                  </label>

                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">アクションツリー</p>
                    <ol className="mt-3 space-y-3 border-l-2 border-dashed border-border/60 pl-4">
                      {activeSeries.items.map((item, index) => {
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
                                <p className="mt-2 text-sm leading-relaxed text-foreground">{narrative}</p>
                                {immediate ? (
                                  <p className="mt-2 border-l-2 border-violet-400/50 pl-2 text-xs font-medium text-violet-900 dark:text-violet-100">
                                    すぐやること: {immediate}
                                  </p>
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

                  {mentorCards ? <div className="xl:hidden">{mentorCards}</div> : null}

                  {ctxEffective?.dnaAlignmentReason ? (
                    <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Lab 共鳴メモ: </span>
                      {ctxEffective.dnaAlignmentReason}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setBodyOpen((o) => !o)}
                    className="flex w-full items-center justify-between rounded-xl border bg-muted/20 px-3 py-2 text-left text-sm font-medium"
                  >
                    作戦詳細（生成本文）
                    <ChevronDown className={cn("size-4 transition-transform", bodyOpen && "rotate-180")} />
                  </button>
                  {bodyOpen ? (
                    <div className="space-y-3 rounded-xl border border-dashed bg-background/80 p-3">
                      {activeSeries.items.map((item) => {
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
                  ) : null}

                  {ctxEffective?.protocolLines?.length ? (
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">ハット視点（Lab モーダル）</p>
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
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* 3. Feedback */}
            <aside className="space-y-4 lg:sticky lg:top-24">
              <Card>
                <CardHeader>
                  <p className="text-sm font-semibold">検証フィードバック</p>
                  <p className="text-xs text-muted-foreground">STEP 1 実行直後の反応を記録します（Identity 用フィールドバッファにも積みます）。</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={quickFeedback === "hot" ? "default" : "outline"}
                      className={quickFeedback === "hot" ? "bg-orange-500 hover:bg-orange-600" : ""}
                      disabled={feedbackSaving}
                      onClick={() => setQuickFeedback(quickFeedback === "hot" ? null : "hot")}
                    >
                      <Flame className="mr-1 size-3.5" />
                      反応あり
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={quickFeedback === "cold" ? "default" : "outline"}
                      disabled={feedbackSaving}
                      onClick={() => setQuickFeedback(quickFeedback === "cold" ? null : "cold")}
                    >
                      <Snowflake className="mr-1 size-3.5" />
                      刺さらず
                    </Button>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">いいね数など</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={likesInput}
                      onChange={(e) => setLikesInput(e.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                      placeholder="例: 12"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">検証メモ</span>
                    <Textarea
                      value={memoInput}
                      onChange={(e) => setMemoInput(e.target.value)}
                      className="min-h-[100px] border-border"
                      placeholder="現場での違和感、次に変える一言など"
                    />
                  </label>
                  <Button type="button" className="w-full" disabled={feedbackSaving || !anchorItem} onClick={() => void saveFeedback()}>
                    {feedbackSaving ? "送信中…" : "結果を送信"}
                  </Button>
                  <Link
                    href="/identity"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex w-full justify-center")}
                  >
                    Identity で DNA を整える
                  </Link>
                </CardContent>
              </Card>
            </aside>
          </div>

          {/* 4. Archive */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="size-4" />
              <h2 className="text-lg font-semibold">進化の軌跡</h2>
            </div>
            {evolution ? (
              <div className="flex gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-950 dark:text-amber-100">Evolution Protocol</p>
                  <p className="mt-1 text-amber-950/85 dark:text-amber-50/85">{evolution}</p>
                </div>
              </div>
            ) : null}
            {showIdentityEvolutionAlert ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-violet-300/70 bg-violet-50/90 p-4 text-sm dark:border-violet-800/55 dark:bg-violet-950/25 sm:flex-row sm:items-start sm:gap-4">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-semibold text-violet-950 dark:text-violet-100">
                    Evolution Protocol：Identityの再調整を推奨します
                  </p>
                  <p className="text-violet-950/90 dark:text-violet-50/85">
                    Roadmap の検証フィードバックが Identity 用バッファに{" "}
                    <span className="font-semibold tabular-nums">{identityBufferSummary.total}</span> 件溜まっています（🔥{" "}
                    <span className="font-semibold tabular-nums">{identityBufferSummary.hot}</span>
                    ・刺さらず <span className="font-semibold tabular-nums">{identityBufferSummary.cold}</span>
                    {identityBufferSummary.withMemo > 0 ? (
                      <>
                        ・メモ付き <span className="font-semibold tabular-nums">{identityBufferSummary.withMemo}</span>
                      </>
                    ) : null}
                    ）。/identity で DNA を見直すと、次の Lab 生成へ還流しやすくなります。
                  </p>
                  <Link
                    href="/identity"
                    className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-fit bg-violet-600 hover:bg-violet-500")}
                  >
                    Identity を開く
                  </Link>
                </div>
              </div>
            ) : null}
            <ul className="space-y-3">
              {archiveRows.map((row) => {
                const hot = row.items.filter((i) => i.quickFeedback === "hot").length;
                const active = row.id === activeSeries.id;
                return (
                  <li key={row.id}>
                    <Link
                      href={`/roadmap?series=${row.id}`}
                      className={cn(
                        "block rounded-2xl border bg-card/60 p-4 transition-colors hover:bg-card",
                        active && "ring-2 ring-violet-500/40",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{row.title}</p>
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          🔥 {hot}/{row.items.length}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.createdAt)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
