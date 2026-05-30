"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

import { AestheticEvidencePanel } from "@/components/aesthetic-evidence-panel";
import {
  analyzePersona,
  DATA_SYNC_EVENT,
  fetchArchiveOverview,
  fetchGhostSettings,
  resolveIdentityFieldBufferEntries,
  updateGhostSettings,
} from "@/lib/api-client";
import { collectRecentRoadmapFeedbackLogs } from "@/lib/aesthetic-evidence-log";
import {
  clearIdentityFieldLog,
  readIdentityFieldLog,
  type IdentityFieldLogEntryV1,
} from "@/lib/roadmap-deploy";
import { useAuthSession } from "@/lib/use-auth-session";
import type { ArchiveOverview, GhostSettings } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ApprovedIdentitySnapshot = {
  summary: string;
  stylePrompt: string;
  keywordsJoined: string;
};

function snapshotFromGhostSettings(s: GhostSettings): ApprovedIdentitySnapshot {
  return {
    summary: (s.personaSummary ?? "").trim(),
    stylePrompt: (s.stylePrompt ?? "").trim(),
    keywordsJoined: (s.personaKeywords ?? []).join("｜"),
  };
}

const ANTI_PERSONA_PREFIX = "anti_persona";
const MY_TABOO_STORAGE_ID = "my_aesthetic";

const LEGACY_ANTI_IDS = ["avoid_phrases", "hated_success_patterns", "intolerable_injustice"] as const;
type LegacyAntiId = (typeof LEGACY_ANTI_IDS)[number];

const LEGACY_SECTION_TITLE: Record<LegacyAntiId, string> = {
  avoid_phrases: "使いたくない言葉（〜〜という言葉は使いたくない）",
  hated_success_patterns: "やりたくない戦い方（〜〜という手法で成功したくない）",
  intolerable_injustice: "変えたい現状（〜〜という世の中の理不尽を解決したい）",
};

type AntiPersonaDraft = { myTaboo: string };

function createEmptyAntiPersonaDraft(): AntiPersonaDraft {
  return { myTaboo: "" };
}

function mergeLegacyAntiPersona(bucket: Partial<Record<LegacyAntiId, string>>): string {
  const blocks: string[] = [];
  for (const id of LEGACY_ANTI_IDS) {
    const v = (bucket[id] ?? "").trim();
    if (!v) continue;
    blocks.push(`・${LEGACY_SECTION_TITLE[id]}\n${v}`);
  }
  return blocks.join("\n\n");
}

function parsePersonaControls(lines: string[]) {
  const antiPersona = createEmptyAntiPersonaDraft();
  const legacyLines: string[] = [];
  const legacyBucket: Partial<Record<LegacyAntiId, string>> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith(`${ANTI_PERSONA_PREFIX}|`)) {
      const [, id, ...rest] = line.split("|");
      const value = rest.join("|").trim();
      if (id === MY_TABOO_STORAGE_ID) {
        antiPersona.myTaboo = value;
        continue;
      }
      if (LEGACY_ANTI_IDS.includes(id as LegacyAntiId)) {
        legacyBucket[id as LegacyAntiId] = value;
        continue;
      }
      legacyLines.push(rawLine);
      continue;
    }

    legacyLines.push(rawLine);
  }

  if (!antiPersona.myTaboo.trim() && Object.keys(legacyBucket).length > 0) {
    antiPersona.myTaboo = mergeLegacyAntiPersona(legacyBucket);
  }

  return { antiPersona, legacyLines };
}

function serializePersonaControls(antiPersona: AntiPersonaDraft, legacyLines: string[]) {
  const next = [...legacyLines];
  const v = antiPersona.myTaboo.trim();
  if (v) {
    next.push(`${ANTI_PERSONA_PREFIX}|${MY_TABOO_STORAGE_ID}|${v}`);
  }
  return next;
}

const MY_TABOO_PLACEHOLDER =
  "箇条書きで書いてください。\n\n" +
  "・使いたくない言葉（〜〜という言葉は使いたくない）\n" +
  "・やりたくない戦い方（〜〜という手法で成功したくない）\n" +
  "・変えたい現状（〜〜という世の中の理不尽を解決したい）";

function splitAvoidPhrases(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,、]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

export type IdentityLabPageProps = {
  /** Settings 内タブなど、フルページ以外に埋め込むとき true（高さ固定の xl レイアウトを外す） */
  embedded?: boolean;
};

export function IdentityLabPage({ embedded = false }: IdentityLabPageProps) {
  const { user, loading: authLoading } = useAuthSession();
  const autoAnalyzeStartedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GhostSettings | null>(null);
  const [archiveOverview, setArchiveOverview] = useState<ArchiveOverview | null>(null);
  const [fieldLog, setFieldLog] = useState<IdentityFieldLogEntryV1[]>([]);
  const [antiPersonaDraft, setAntiPersonaDraft] = useState<AntiPersonaDraft>(createEmptyAntiPersonaDraft());
  const [legacyLines, setLegacyLines] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncGlow, setSyncGlow] = useState(false);
  const [previewFlash, setPreviewFlash] = useState(false);
  const [approveDrawerOpen, setApproveDrawerOpen] = useState(false);
  const [lastApprovedBaseline, setLastApprovedBaseline] = useState<ApprovedIdentitySnapshot | null>(null);
  const approvedBaselineSeededRef = useRef(false);

  const applySettingsToView = useCallback((next: GhostSettings) => {
    const controls = parsePersonaControls(next.manualPosts);
    setSettings(next);
    setAntiPersonaDraft(controls.antiPersona);
    setLegacyLines(controls.legacyLines);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    void Promise.all([fetchGhostSettings(), fetchArchiveOverview()])
      .then(([data, overview]) => {
        applySettingsToView(data);
        setArchiveOverview(overview);
        setFieldLog(readIdentityFieldLog());
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "保存に失敗しました。");
      })
      .finally(() => setLoading(false));
  }, [applySettingsToView, authLoading, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDataSync = () => {
      setFieldLog(readIdentityFieldLog());
      void fetchArchiveOverview()
        .then(setArchiveOverview)
        .catch(() => {
          /* サイレント: 直近ログはセッション側のみ更新 */
        });
    };
    window.addEventListener(DATA_SYNC_EVENT, onDataSync);
    return () => window.removeEventListener(DATA_SYNC_EVENT, onDataSync);
  }, []);

  const archiveInsights = archiveOverview?.insights ?? null;
  const aestheticEvidenceEntries = useMemo(
    () => collectRecentRoadmapFeedbackLogs(archiveOverview, fieldLog),
    [archiveOverview, fieldLog],
  );

  /** 初回ロード時のみ、承認済みなら「以前の Identity」比較用のベースラインを保存 */
  useEffect(() => {
    if (!settings || approvedBaselineSeededRef.current) return;
    approvedBaselineSeededRef.current = true;
    if (settings.personaStatus === "approved") {
      setLastApprovedBaseline(snapshotFromGhostSettings(settings));
    }
  }, [settings]);

  useEffect(() => {
    if (!syncGlow) return;
    const timeoutId = window.setTimeout(() => setSyncGlow(false), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [syncGlow]);

  useEffect(() => {
    setPreviewFlash(true);
    const timeoutId = window.setTimeout(() => setPreviewFlash(false), 260);
    return () => window.clearTimeout(timeoutId);
  }, [antiPersonaDraft.myTaboo, settings?.stylePrompt, settings?.personaSummary]);

  useEffect(() => {
    if (!approveDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setApproveDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approveDrawerOpen]);

  useEffect(() => {
    if (!approveDrawerOpen || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [approveDrawerOpen]);

  const serializedControls = useMemo(
    () => serializePersonaControls(antiPersonaDraft, legacyLines),
    [antiPersonaDraft, legacyLines],
  );
  const totalHomeSignals = (archiveInsights?.totalSingles ?? 0) + (archiveInsights?.totalSeries ?? 0);
  const totalHot = archiveInsights?.totalHot ?? 0;
  const pendingGrowthCount = useMemo(() => {
    if (!settings) return 0;
    if (settings.personaStatus === "empty") {
      return totalHomeSignals;
    }
    return Math.max(totalHot - settings.personaLastAnalyzedHotCount, 0);
  }, [settings, totalHomeSignals, totalHot]);
  const shouldRecommendRefresh = pendingGrowthCount > 0;
  const antiPersonaCount = useMemo(() => (antiPersonaDraft.myTaboo.trim() !== "" ? 1 : 0), [antiPersonaDraft.myTaboo]);
  const derivedNgWords = useMemo(() => splitAvoidPhrases(antiPersonaDraft.myTaboo), [antiPersonaDraft.myTaboo]);
  const canAnalyze = totalHomeSignals > 0 || antiPersonaCount > 0 || legacyLines.length > 0;
  const identityStatusLabel =
    settings?.personaStatus === "approved"
      ? "Identity · 確定済"
      : settings?.personaStatus === "draft"
        ? "Identity · 承認待ち"
        : "Identity · 未生成";
  const hasUnsyncedChanges = useMemo(() => {
    if (!settings) return false;
    const manualChanged = JSON.stringify(serializedControls) !== JSON.stringify(settings.manualPosts);
    const ngChanged = JSON.stringify(derivedNgWords) !== JSON.stringify(settings.ngWords);
    return manualChanged || ngChanged || settings.personaStatus !== "approved" || pendingGrowthCount > 0;
  }, [derivedNgWords, pendingGrowthCount, serializedControls, settings]);

  const stanceDeclaration = useMemo(() => {
    if (settings?.stylePrompt?.trim()) return settings.stylePrompt.trim();
    if (settings?.personaSummary?.trim()) return settings.personaSummary.trim();
    if (antiPersonaCount > 0) return "誇張ではなく当事者の痛みを起点に、検証で言葉を磨き続ける。";
    return "ログで確認できた痛みと変化を起点に、誇張せず届ける。";
  }, [antiPersonaCount, settings?.personaSummary, settings?.stylePrompt]);

  const stanceSignals = useMemo(() => {
    if (!antiPersonaDraft.myTaboo.trim()) {
      return ["反応ログに沿って、誇張より検証を優先する"];
    }
    return [
      "My Taboo（私の美学）に書いた境界を守る",
      "言葉・戦い方・理不尽への向き合いを出力に反映する",
      "誇張より検証を優先する",
    ];
  }, [antiPersonaDraft.myTaboo]);
  const aiTrendSummary = useMemo(() => {
    if (settings?.personaSummary?.trim()) return settings.personaSummary.trim();
    if (settings?.personaEvidence?.length) return settings.personaEvidence[0] ?? "";
    if (totalHot > 0) {
      return `Hot反応が ${totalHot} 件あり、検証ログから再現しやすい語り口の輪郭が見えています。`;
    }
    if (totalHomeSignals > 0) {
      return `検証ログが ${totalHomeSignals} 件たまり、スタンス抽出の材料がそろい始めています。`;
    }
    return "まだ材料が少ないため、/lab の検証ログを増やすと分析精度が上がります。";
  }, [settings?.personaEvidence, settings?.personaSummary, totalHomeSignals, totalHot]);

  const shreddedPreview = useMemo(() => {
    const t = antiPersonaDraft.myTaboo.trim();
    if (t) {
      const clip = t.length > 220 ? `${t.slice(0, 220)}…` : t;
      return `次の My Taboo に反するトーンや押し付けは、この Identity では除外の対象になります: ${clip}`;
    }
    return "不安を煽って売る、誰でも成功できると断言する、権威だけで押し切る文体はこの Identity で除外されます。";
  }, [antiPersonaDraft.myTaboo]);

  /** ドロワー内の「以前の Identity」と現在草案の差分用 */
  const identityDrawerDiff = useMemo(() => {
    if (!settings || !lastApprovedBaseline) return null;
    const cur = snapshotFromGhostSettings(settings);
    const summaryChanged = cur.summary !== lastApprovedBaseline.summary;
    const styleChanged = cur.stylePrompt !== lastApprovedBaseline.stylePrompt;
    const kwChanged = cur.keywordsJoined !== lastApprovedBaseline.keywordsJoined;
    if (!summaryChanged && !styleChanged && !kwChanged) {
      return { hasBaseline: true, hasChanges: false, lastApprovedBaseline, cur } as const;
    }
    return {
      hasBaseline: true,
      hasChanges: true,
      lastApprovedBaseline,
      cur,
      summaryChanged,
      styleChanged,
      kwChanged,
    } as const;
  }, [lastApprovedBaseline, settings]);

  const handleAnalyze = useCallback(
    async () => {
      if (!canAnalyze) return;
      setAnalyzing(true);
      setStatus(null);
      setError(null);
      try {
        await updateGhostSettings({
          manualPosts: serializedControls,
        });
        const next = await analyzePersona();
        applySettingsToView(next);
        setStatus("保存しました。");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "保存に失敗しました。");
      } finally {
        setAnalyzing(false);
      }
    },
    [applySettingsToView, canAnalyze, serializedControls],
  );

  useEffect(() => {
    if (loading || authLoading || !user || !settings) return;
    if (autoAnalyzeStartedRef.current) return;
    if (!canAnalyze) return;

    if (settings.personaStatus === "empty" || shouldRecommendRefresh) {
      autoAnalyzeStartedRef.current = true;
      void handleAnalyze();
    }
  }, [authLoading, canAnalyze, handleAnalyze, loading, settings, shouldRecommendRefresh, user]);

  const handleApprove = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const next = await updateGhostSettings({
        manualPosts: serializedControls,
        ngWords: derivedNgWords,
        personaKeywords: settings.personaKeywords,
        personaSummary: settings.personaSummary,
        personaEvidence: settings.personaEvidence,
        stylePrompt: settings.stylePrompt,
        personaStatus: "approved",
        personaLastAnalyzedHotCount: totalHot,
      });
      applySettingsToView(next);
      setLastApprovedBaseline(snapshotFromGhostSettings(next));
      await resolveIdentityFieldBufferEntries();
      clearIdentityFieldLog();
      setSyncGlow(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("emoswitch_identity_sync_glow", String(Date.now()));
      }
      setStatus("保存しました。");
      setApproveDrawerOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }, [applySettingsToView, derivedNgWords, serializedControls, settings, totalHot]);

  if (authLoading || loading) {
    return (
      <div
        className={cn(
          "py-8 pb-28",
          embedded ? "w-full" : "mx-auto w-full max-w-[1800px] px-4 md:px-6 xl:px-8 2xl:px-10",
        )}
      >
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={cn(
          "mx-auto w-full max-w-3xl space-y-6 py-8 pb-28",
          embedded ? "" : "px-4 md:px-6 xl:px-8 2xl:px-10",
        )}
      >
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Identity（投稿の前提）</h1>
          <p className="text-muted-foreground">
            Google ログイン後、`/lab` の行動ログをもとに、投稿仮説に乗せる Identity を更新できます。
          </p>
        </header>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full space-y-6",
        embedded
          ? "pt-0 pb-4 max-md:pb-8 md:pt-1"
          : "mx-auto max-w-[1800px] px-4 py-8 pb-8 md:px-6 max-md:pb-28 xl:flex xl:h-[calc(100vh-4rem)] xl:flex-col xl:gap-6 xl:space-y-0 xl:overflow-hidden xl:px-8 xl:pb-6 2xl:px-10",
        !embedded && syncGlow && "transition-all duration-700 xl:shadow-[0_0_40px_-20px_rgba(139,92,246,0.45)]",
        embedded && syncGlow && "transition-all duration-700 shadow-[0_0_28px_-14px_rgba(139,92,246,0.35)]",
      )}
    >
      <header className={cn("shrink-0", embedded ? "space-y-2" : "space-y-3")}>
        <div>
          <h1
            className={cn(
              "font-bold tracking-tight",
              embedded ? "text-xl leading-snug md:text-2xl" : "text-2xl md:text-3xl",
            )}
          >
            TabooでAI出力ルールを確定する
          </h1>
          <p
            className={cn(
              "max-w-4xl text-muted-foreground",
              embedded ? "mt-1.5 text-xs leading-relaxed md:text-sm" : "mt-2 text-sm",
            )}
          >
            ゲーム的な調整は行わず、やりたくないことを定義して、/lab でAIが守るガイドラインを決める画面です。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full font-semibold",
              settings?.personaStatus === "approved" &&
                "border-emerald-400/70 bg-emerald-50 text-emerald-900 dark:border-emerald-600/60 dark:bg-emerald-950/45 dark:text-emerald-100",
              settings?.personaStatus === "draft" &&
                "border-violet-400/60 bg-violet-50 text-violet-950 dark:border-violet-600/50 dark:bg-violet-950/40 dark:text-violet-100",
              (settings?.personaStatus === "empty" || settings == null) &&
                "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {identityStatusLabel}
          </Badge>
          {pendingGrowthCount > 0 ? (
            <span className="inline-flex items-center rounded-full border border-amber-400/70 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-100">
              未承認の成長 {pendingGrowthCount} 件
            </span>
          ) : null}
        </div>
        {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </header>

      {/* メイン: 軌跡ストリップ + My Taboo（左2）+ 美学の根拠（右1） — ROOTS は左カラム幅に収める */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 max-md:pb-8 md:pb-6 xl:p-1">
        <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-3 lg:items-start">
          <div className="space-y-4 lg:col-span-2">
            <div
              className="rounded-lg border border-slate-200/90 bg-slate-50 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/50"
              title="軌跡の分析（前提コンテキスト）"
            >
        <div className="flex h-[60px] items-center gap-2 px-2 sm:gap-3 sm:px-3">
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap border-r border-slate-200/90 pr-2 text-[11px] font-bold tabular-nums text-slate-800 dark:border-slate-700 dark:text-slate-100 sm:pr-3 sm:text-xs">
            <span>ROOTS {totalHomeSignals}</span>
            <span className="font-normal text-slate-400 dark:text-slate-500">/</span>
            <span className="inline-flex items-center gap-0.5">
              <span aria-hidden>🔥</span>
              {totalHot}
            </span>
          </div>
          <p
            className="min-w-0 flex-1 truncate text-left text-[11px] leading-tight text-slate-800 dark:text-slate-100 sm:text-xs sm:leading-snug"
            title={aiTrendSummary}
          >
            <span className="font-semibold text-slate-500 dark:text-slate-400">AI要約: </span>
            {aiTrendSummary}
          </p>
          <div className="shrink-0">
            <Button
              type="button"
              size="sm"
              variant={pendingGrowthCount > 0 ? "default" : "outline"}
              onClick={() => void handleAnalyze()}
              disabled={analyzing || !canAnalyze}
              className={cn(
                "relative h-8 gap-1.5 px-2.5 text-[11px] sm:h-8 sm:px-3 sm:text-xs",
                pendingGrowthCount > 0
                  ? "bg-violet-600 text-white shadow-sm ring-1 ring-violet-400/50 hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500"
                  : "border-violet-400/45 text-violet-900 hover:bg-violet-50/90 dark:border-violet-600/50 dark:text-violet-100 dark:hover:bg-violet-950/40",
              )}
            >
              {pendingGrowthCount > 0 ? (
                <span
                  className="size-1.5 shrink-0 animate-pulse rounded-full bg-amber-400 ring-1 ring-white/90 dark:ring-violet-950"
                  title="未反映の成長あり"
                  aria-hidden
                />
              ) : null}
              {analyzing ? (
                "分析中"
              ) : (
                <>
                  <span className="hidden sm:inline">軌跡を再分析</span>
                  <span className="sm:hidden">再分析</span>
                  {pendingGrowthCount > 0 ? (
                    <span className="font-semibold tabular-nums opacity-95">
                      {settings?.personaStatus === "empty" ? `(${pendingGrowthCount})` : `(+${pendingGrowthCount})`}
                    </span>
                  ) : null}
                </>
              )}
            </Button>
          </div>
              </div>
            </div>

            <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>My Taboo（私の美学）</CardTitle>
              <CardDescription>
                言葉・戦い方・変えたい現状を、ひとつのメモに箇条書きで吐き出します。右側には実行ページで記録した直近の検証ログを表示します。
              </CardDescription>
              <details className="mt-3 rounded-lg border border-border/50 bg-muted/15 px-3 py-2 text-sm dark:bg-muted/10">
                <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
                  現在の AI スタンスを少し表示
                </summary>
                <p className="mt-2 border-t border-border/40 pt-2 text-sm leading-relaxed text-foreground/90">{stanceDeclaration}</p>
              </details>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="block space-y-2">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground">私の美学（自由記述）</span>
                <Textarea
                  value={antiPersonaDraft.myTaboo}
                  onChange={(event) =>
                    setAntiPersonaDraft((current) => ({
                      ...current,
                      myTaboo: event.target.value,
                    }))
                  }
                  placeholder={MY_TABOO_PLACEHOLDER}
                  className="min-h-48 w-full bg-muted/25 transition-[box-shadow,border-color] md:min-h-64 dark:bg-muted/15 focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/35 dark:focus-visible:border-violet-400 dark:focus-visible:ring-violet-400/30"
                  spellCheck={false}
                />
              </label>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-border/60 bg-muted/15 p-4 shadow-sm dark:bg-muted/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="min-w-0 text-[11px] leading-snug text-muted-foreground sm:max-w-md sm:text-xs">
                承認すると、<span className="font-medium text-foreground/80">/lab</span> の生成トーン・ガイドライン・NG ワードに反映されます。
              </p>
              <Button
                type="button"
                size="lg"
                className="h-11 w-full shrink-0 bg-violet-600 text-white hover:bg-violet-500 sm:h-10 sm:w-auto sm:min-w-64"
                onClick={() => setApproveDrawerOpen(true)}
              >
                最終確認して Identity を確定する
              </Button>
            </div>
          </div>
          </div>

          <AestheticEvidencePanel entries={aestheticEvidenceEntries} loading={loading} />
        </div>
      </div>

      <AnimatePresence>
        {approveDrawerOpen ? (
          <motion.div
            key="identity-approve-root"
            className="fixed inset-0 z-80 flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.button
              type="button"
              aria-label="オーバーレイを閉じる"
              className="absolute inset-0 bg-black/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setApproveDrawerOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="identity-approve-drawer-title"
              className="relative z-10 flex h-dvh w-full max-w-md flex-col border-l border-border/60 bg-background shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                <h2 id="identity-approve-drawer-title" className="text-sm font-semibold tracking-tight">
                  Identity の最終確認
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground"
                  aria-label="閉じる"
                  onClick={() => setApproveDrawerOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <p className="text-xs text-muted-foreground">
                  以下を確認のうえ「この内容で確定する」で /lab に反映されるガイドラインを確定します。
                </p>
                {identityDrawerDiff == null ? (
                  <p className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    初めて確定するときは比較対象がありません。確定後、次回から「前回承認」との差分がここに表示されます。
                  </p>
                ) : identityDrawerDiff.hasChanges ? (
                  <div className="rounded-xl border-2 border-violet-400/55 bg-violet-50/50 p-3 dark:border-violet-600/50 dark:bg-violet-950/30">
                    <p className="text-xs font-semibold text-violet-950 dark:text-violet-100">前回の Identity → 今回の更新</p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border/50 bg-background/80 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">以前（反映済み）</p>
                        <p className="mt-1 max-h-40 overflow-y-auto text-xs leading-relaxed text-muted-foreground">
                          {identityDrawerDiff.lastApprovedBaseline.summary || "（要約なし）"}
                        </p>
                        {identityDrawerDiff.styleChanged ? (
                          <p className="mt-2 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                            <span className="font-semibold">スタイル指示</span> も変更あり
                          </p>
                        ) : null}
                        {identityDrawerDiff.kwChanged ? (
                          <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">キーワード構成が更新されます</p>
                        ) : null}
                      </div>
                      <div className="rounded-lg border border-violet-300/60 bg-violet-100/40 p-2.5 dark:border-violet-700/50 dark:bg-violet-900/30">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                          今回確定後
                        </p>
                        <p className="mt-1 max-h-40 overflow-y-auto text-xs font-medium leading-relaxed text-foreground">
                          {(settings?.personaSummary ?? "").trim() || "（要約なし）"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                    要約・スタイル・キーワードは、前回承認時点から変更されていません（Taboo や手入力のみの変更の可能性はあります）。
                  </p>
                )}
                <div
                  className={cn(
                    "rounded-xl border bg-violet-50/60 p-3 dark:bg-violet-950/20",
                    previewFlash && "ring-2 ring-violet-300/60",
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Identity Sample
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{stanceDeclaration}</p>
                </div>
                <div className="rounded-xl border bg-muted/15 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AIが守るルール</p>
                  <ul className="mt-2 space-y-1">
                    {stanceSignals.map((signal) => (
                      <li key={signal} className="text-sm text-foreground/90">
                        ・{signal}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-rose-200/60 bg-rose-50/70 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-200">
                    拒絶フィルタ（参考）
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-rose-700 dark:text-rose-200">{shreddedPreview}</p>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <div className="shrink-0 space-y-3 border-t border-border/60 bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button
                  type="button"
                  onClick={() => void handleApprove()}
                  disabled={saving || !settings?.personaSummary || (settings.personaKeywords?.length ?? 0) < 5}
                  className={cn(
                    "w-full bg-violet-600 text-white hover:bg-violet-500",
                    (syncGlow || hasUnsyncedChanges) && "shadow-[0_0_24px_-10px_rgba(139,92,246,0.9)]",
                  )}
                >
                  <CheckCircle2 className="mr-1 size-4" />
                  {saving ? "保存中..." : "この内容で確定する"}
                </Button>
                <div className="flex justify-center">
                  <Link href="/lab">
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                      /lab に戻る
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
