"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Fingerprint, Scissors } from "lucide-react";

import {
  analyzePersona,
  fetchArchiveInsights,
  fetchGhostSettings,
  resolveIdentityFieldBufferEntries,
  updateGhostSettings,
} from "@/lib/api-client";
import {
  clearIdentityFieldLog,
} from "@/lib/roadmap-deploy";
import { useAuthSession } from "@/lib/use-auth-session";
import type { ArchiveInsights, GhostSettings } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ANTI_PERSONA_PREFIX = "anti_persona";

const ANTI_PERSONA_FIELDS = [
  {
    id: "avoid_phrases",
    label: "絶対に避ける言い回し",
    placeholder: "例: 人生変わる / 誰でも簡単 / 稼げる など",
  },
  {
    id: "hated_success_patterns",
    label: "嫌いな成功法則",
    placeholder: "例: 不安を煽って売る / 再現性を盛る / 権威だけで押し切る",
  },
  {
    id: "intolerable_injustice",
    label: "許せない不条理",
    placeholder: "例: 当事者が報われない構造 / 努力する人が損をする空気",
  },
];
type AntiPersonaKey = (typeof ANTI_PERSONA_FIELDS)[number]["id"];
type AntiPersonaDraft = Record<AntiPersonaKey, string>;

function createEmptyAntiPersonaDraft(): AntiPersonaDraft {
  return {
    avoid_phrases: "",
    hated_success_patterns: "",
    intolerable_injustice: "",
  };
}

function parsePersonaControls(lines: string[]) {
  const antiPersona = createEmptyAntiPersonaDraft();
  const legacyLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith(`${ANTI_PERSONA_PREFIX}|`)) {
      const [, id, ...rest] = line.split("|");
      const value = rest.join("|").trim();
      if (id in antiPersona) {
        antiPersona[id as AntiPersonaKey] = value;
        continue;
      }
    }

    legacyLines.push(line);
  }

  return { antiPersona, legacyLines };
}

function serializePersonaControls(antiPersona: AntiPersonaDraft, legacyLines: string[]) {
  const next = [...legacyLines];

  for (const field of ANTI_PERSONA_FIELDS) {
    const value = antiPersona[field.id].trim();
    if (value) {
      next.push(`${ANTI_PERSONA_PREFIX}|${field.id}|${value}`);
    }
  }

  return next;
}

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

function splitTagDraft(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,、]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeIdentityTerm(input: string): string {
  return input.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function IdentityLabPage() {
  const { user, loading: authLoading } = useAuthSession();
  const autoAnalyzeStartedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GhostSettings | null>(null);
  const [archiveInsights, setArchiveInsights] = useState<ArchiveInsights | null>(null);
  const [antiPersonaDraft, setAntiPersonaDraft] = useState<AntiPersonaDraft>(createEmptyAntiPersonaDraft());
  const [legacyLines, setLegacyLines] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncGlow, setSyncGlow] = useState(false);
  const [previewFlash, setPreviewFlash] = useState(false);
  const [tabooQuickInput, setTabooQuickInput] = useState("");

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

    void Promise.all([fetchGhostSettings(), fetchArchiveInsights()])
      .then(([data, insights]) => {
        applySettingsToView(data);
        setArchiveInsights(insights);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "保存に失敗しました。");
      })
      .finally(() => setLoading(false));
  }, [applySettingsToView, authLoading, user]);

  useEffect(() => {
    if (!syncGlow) return;
    const timeoutId = window.setTimeout(() => setSyncGlow(false), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [syncGlow]);

  useEffect(() => {
    setPreviewFlash(true);
    const timeoutId = window.setTimeout(() => setPreviewFlash(false), 260);
    return () => window.clearTimeout(timeoutId);
  }, [antiPersonaDraft, settings?.stylePrompt, settings?.personaSummary]);

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
  const antiPersonaCount = useMemo(
    () => Object.values(antiPersonaDraft).filter((value) => value.trim() !== "").length,
    [antiPersonaDraft],
  );
  const derivedNgWords = useMemo(() => splitAvoidPhrases(antiPersonaDraft.avoid_phrases), [antiPersonaDraft]);
  const canAnalyze = totalHomeSignals > 0 || antiPersonaCount > 0 || legacyLines.length > 0;
  const identityStatusLabel =
    settings?.personaStatus === "approved"
      ? "Identity · 保存済み"
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
    const signals: string[] = [];
    if (antiPersonaDraft.avoid_phrases.trim()) signals.push("強引な成功テンプレを使わない");
    if (antiPersonaDraft.hated_success_patterns.trim()) signals.push("煽り売りの文脈に寄せない");
    if (antiPersonaDraft.intolerable_injustice.trim()) signals.push("許せない構造から論点を外さない");
    if (signals.length === 0) signals.push("反応ログに沿って、誇張より検証を優先する");
    return signals;
  }, [antiPersonaDraft]);
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
    if (antiPersonaDraft.hated_success_patterns.trim()) {
      return `${antiPersonaDraft.hated_success_patterns.trim()} に寄せたキラキラ成功者風の文章は、この Identity では除外されます。`;
    }
    return "不安を煽って売る、誰でも成功できると断言する、権威だけで押し切る文体はこの Identity で除外されます。";
  }, [antiPersonaDraft.hated_success_patterns]);
  const antiPersonaTags = useMemo(
    () =>
      ANTI_PERSONA_FIELDS.reduce(
        (acc, field) => {
          acc[field.id] = splitTagDraft(antiPersonaDraft[field.id]);
          return acc;
        },
        {
          avoid_phrases: [],
          hated_success_patterns: [],
          intolerable_injustice: [],
        } as Record<AntiPersonaKey, string[]>,
      ),
    [antiPersonaDraft],
  );
  const allTabooTags = useMemo(
    () =>
      Array.from(
        new Set([
          ...antiPersonaTags.avoid_phrases,
          ...antiPersonaTags.hated_success_patterns,
          ...antiPersonaTags.intolerable_injustice,
        ]),
      ),
    [antiPersonaTags],
  );

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
      await resolveIdentityFieldBufferEntries();
      clearIdentityFieldLog();
      setSyncGlow(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("emoswitch_identity_sync_glow", String(Date.now()));
      }
      setStatus("保存しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }, [applySettingsToView, derivedNgWords, serializedControls, settings, totalHot]);

  const removeAntiPersonaTag = useCallback((field: AntiPersonaKey, tag: string) => {
    setAntiPersonaDraft((current) => {
      const tags = splitTagDraft(current[field]).filter((item) => item !== tag);
      return {
        ...current,
        [field]: tags.join(" / "),
      };
    });
  }, []);
  const appendQuickTabooTag = useCallback((rawValue: string) => {
    const normalized = normalizeIdentityTerm(rawValue);
    if (!normalized) return;
    setAntiPersonaDraft((current) => {
      const existing = splitTagDraft(current.avoid_phrases).map((item) => normalizeIdentityTerm(item));
      if (existing.includes(normalized)) return current;
      return {
        ...current,
        avoid_phrases: [...existing, normalized].filter(Boolean).join(" / "),
      };
    });
    setTabooQuickInput("");
  }, []);

  if (authLoading || loading) {
    return <div className="mx-auto max-w-6xl px-4 py-8 pb-28 md:px-6">読み込み中...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-28 md:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Identity DNA</h1>
          <p className="text-muted-foreground">
            Google ログイン後、`/lab` の行動ログをもとに Identity DNA を育てられます。
          </p>
        </header>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto max-w-[1800px] space-y-6 px-4 py-8 pb-28 md:px-6",
        syncGlow && "transition-all duration-700",
      )}
    >
      <header className={cn("space-y-3 rounded-2xl border bg-background/80 p-5 transition-all", syncGlow && "border-violet-300/70 shadow-[0_0_40px_-20px_rgba(139,92,246,0.6)]")}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Fingerprint className="size-5" />
          <span className="text-sm font-medium">Identity Lab</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">TabooでAI出力ルールを確定する</h1>
        <p className="max-w-4xl text-sm text-muted-foreground">ゲーム的な調整は行わず、やりたくないことを定義して、/lab でAIが守るガイドラインを決める画面です。</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {identityStatusLabel}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            `/lab` 検証数 {totalHomeSignals}
          </Badge>
          <span className="text-xs text-muted-foreground">未承認の成長 {pendingGrowthCount} 件</span>
        </div>
        {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </header>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>1. 軌跡の分析（AIの仕事）</CardTitle>
            <CardDescription>これまでの検証ログから、AIがあなたの傾向を要約します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">ROOTS</p>
              <p className="mt-1 text-sm">検証ログ: <span className="font-semibold">{totalHomeSignals}</span>件 / Hot: <span className="font-semibold">{totalHot}</span>件</p>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-xs text-muted-foreground">AIが読み取った傾向</p>
              <p className="mt-2 text-sm leading-7">{aiTrendSummary}</p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleAnalyze()}
              disabled={analyzing || !canAnalyze}
              className="w-full bg-violet-600 text-white hover:bg-violet-500"
            >
              {analyzing ? "分析中..." : "軌跡を再分析する"}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>2. タブーの設定（あなたの仕事）</CardTitle>
            <CardDescription>美学に反するNG行動・NGワードを箇条書きで追加します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ANTI_PERSONA_FIELDS.map((field) => (
              <label key={field.id} className="block space-y-2">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground">{field.label}</span>
                <Textarea
                  value={antiPersonaDraft[field.id]}
                  onChange={(event) =>
                    setAntiPersonaDraft((current) => ({
                      ...current,
                      [field.id]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className="min-h-20"
                />
              </label>
            ))}
            <div className="rounded-xl border border-rose-200/60 bg-rose-50/70 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-200">追加済みタブー</p>
              {allTabooTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {allTabooTags.map((tag) => (
                    <button
                      key={`taboo-fragment-${tag}`}
                      type="button"
                      onClick={() => {
                        removeAntiPersonaTag("avoid_phrases", tag);
                        removeAntiPersonaTag("hated_success_patterns", tag);
                        removeAntiPersonaTag("intolerable_injustice", tag);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-300/80 bg-white px-3 py-1 text-xs text-rose-700"
                    >
                      <Scissors className="size-3" />
                      {tag}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">まだ追加されていません。</p>
              )}
            </div>
            <Input
              value={tabooQuickInput}
              onChange={(event) => setTabooQuickInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                appendQuickTabooTag(tabooQuickInput);
              }}
              className="h-11"
              placeholder="箇条書きで追加（Enterで確定）"
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>3. スタンスの確定（コントロールパネル）</CardTitle>
            <CardDescription>AIが今後 /lab で守るべきガイドラインを確認して確定します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn("rounded-xl border bg-violet-50/60 p-4 dark:bg-violet-950/20", previewFlash && "ring-2 ring-violet-300/60")}>
              <p className="text-xs font-semibold tracking-wide text-violet-700 dark:text-violet-300">Identity Sample</p>
              <p className="mt-2 text-sm leading-7">{stanceDeclaration}</p>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">AIが守るルール</p>
              <ul className="mt-2 space-y-1">
                {stanceSignals.map((signal) => (
                  <li key={signal} className="text-sm text-foreground/90">・{signal}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-rose-200/60 bg-rose-50/70 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-200">拒絶フィルタ（参考）</p>
              <p className="mt-2 text-sm text-rose-700 dark:text-rose-200">{shreddedPreview}</p>
            </div>
            <Button
              type="button"
              onClick={() => void handleApprove()}
              disabled={saving || !settings?.personaSummary || (settings.personaKeywords?.length ?? 0) < 5}
              className={cn("w-full bg-violet-600 text-white hover:bg-violet-500", (syncGlow || hasUnsyncedChanges) && "shadow-[0_0_24px_-10px_rgba(139,92,246,0.9)]")}
            >
              <CheckCircle2 className="mr-1 size-4" />
              {saving ? "保存中..." : "保存して確定する"}
            </Button>
            <div className="flex justify-end">
              <Link href="/lab">
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                  /lab に戻る
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
