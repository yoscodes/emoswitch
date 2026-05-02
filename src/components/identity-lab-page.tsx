"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Fingerprint, Flame, Scissors, ShieldBan, Sparkles } from "lucide-react";

import { analyzePersona, fetchArchiveInsights, fetchGhostSettings, updateGhostSettings } from "@/lib/api-client";
import { DATA_SYNC_EVENT } from "@/lib/data-sync";
import {
  clearIdentityFieldLog,
  readIdentityFieldLog,
  summarizeIdentityFieldBuffer,
} from "@/lib/roadmap-deploy";
import { useAuthSession } from "@/lib/use-auth-session";
import type { ArchiveInsights, GhostSettings } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DNA_CHOICE_PREFIX = "dna_choice";
const ANTI_PERSONA_PREFIX = "anti_persona";

type DnaQuestionId =
  | "logic_vs_emotion"
  | "break_vs_harmony"
  | "crowd_vs_solitude"
  | "speed_vs_density"
  | "utility_vs_philosophy";

type DnaQuestion = {
  id: DnaQuestionId;
  prompt: string;
  leftLabel: string;
  rightLabel: string;
  leftSignal: string;
  rightSignal: string;
  sourceLabel?: string;
};

const FIXED_DNA_QUESTIONS: DnaQuestion[] = [
  {
    id: "logic_vs_emotion",
    prompt: "論理 vs 情緒",
    leftLabel: "データが語る真実",
    rightLabel: "魂を揺さぶる言葉",
    leftSignal: "筋道で納得を作る",
    rightSignal: "感情の温度から始める",
  },
  {
    id: "break_vs_harmony",
    prompt: "破壊 vs 調和",
    leftLabel: "前提を壊して突破する",
    rightLabel: "合意をつないで進める",
    leftSignal: "常識への反逆を含む",
    rightSignal: "共感と橋渡しを重視する",
  },
  {
    id: "crowd_vs_solitude",
    prompt: "大衆 vs 孤独",
    leftLabel: "みんなの不便を一気に解く",
    rightLabel: "少数派の痛みを深く救う",
    leftSignal: "広い課題に翻訳する",
    rightSignal: "少数派の痛みから始める",
  },
  {
    id: "speed_vs_density",
    prompt: "スピード vs 密度",
    leftLabel: "まず出して走りながら直す",
    rightLabel: "納得するまで削って磨く",
    leftSignal: "検証回数を優先する",
    rightSignal: "意味の濃さを優先する",
  },
  {
    id: "utility_vs_philosophy",
    prompt: "実利 vs 思想",
    leftLabel: "使ってすぐ効く実利",
    rightLabel: "世界の見方を変える思想",
    leftSignal: "すぐ効く価値を示す",
    rightSignal: "信念の芯を前に出す",
  },
];

const DNA_QUESTION_IDS: DnaQuestionId[] = [
  "logic_vs_emotion",
  "break_vs_harmony",
  "crowd_vs_solitude",
  "speed_vs_density",
  "utility_vs_philosophy",
];

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
type DnaChoiceValue = "left" | "right" | null;
type DnaChoiceMap = Record<DnaQuestionId, DnaChoiceValue>;
type AntiPersonaKey = (typeof ANTI_PERSONA_FIELDS)[number]["id"];
type AntiPersonaDraft = Record<AntiPersonaKey, string>;

function createEmptyDnaChoiceMap(): DnaChoiceMap {
  return {
    logic_vs_emotion: null,
    break_vs_harmony: null,
    crowd_vs_solitude: null,
    speed_vs_density: null,
    utility_vs_philosophy: null,
  };
}

function createEmptyAntiPersonaDraft(): AntiPersonaDraft {
  return {
    avoid_phrases: "",
    hated_success_patterns: "",
    intolerable_injustice: "",
  };
}

function parsePersonaControls(lines: string[]) {
  const choices = createEmptyDnaChoiceMap();
  const antiPersona = createEmptyAntiPersonaDraft();
  const legacyLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith(`${DNA_CHOICE_PREFIX}|`)) {
      const [, id, value] = line.split("|");
      if (id in choices && (value === "left" || value === "right")) {
        choices[id as DnaQuestionId] = value;
        continue;
      }
    }

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

  return { choices, antiPersona, legacyLines };
}

function serializePersonaControls(choices: DnaChoiceMap, antiPersona: AntiPersonaDraft, legacyLines: string[]) {
  const next = [...legacyLines];

  for (const questionId of DNA_QUESTION_IDS) {
    const value = choices[questionId];
    if (value) {
      next.push(`${DNA_CHOICE_PREFIX}|${questionId}|${value}`);
    }
  }

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

function resolveProphecyFromChoices(choices: DnaChoiceMap): string {
  const logicEmotion = choices.logic_vs_emotion;
  const breakHarmony = choices.break_vs_harmony;
  const crowdSolitude = choices.crowd_vs_solitude;
  const unresolvedCount = Object.values(choices).filter((value) => value == null).length;

  if (unresolvedCount > 0) return "平均的な起業家";

  const tone = logicEmotion === "left" ? "論理的な" : logicEmotion === "right" ? "情緒的な" : "均整の取れた";
  const posture = breakHarmony === "left" ? "異端児" : breakHarmony === "right" ? "調律者" : "探究者";
  const audience = crowdSolitude === "left" ? "市場翻訳型" : crowdSolitude === "right" ? "少数派特化型" : "中間型";
  return `${tone}${posture} / ${audience}`;
}

export function IdentityLabPage() {
  const { user, loading: authLoading } = useAuthSession();
  const autoAnalyzeStartedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GhostSettings | null>(null);
  const [archiveInsights, setArchiveInsights] = useState<ArchiveInsights | null>(null);
  const [dnaChoices, setDnaChoices] = useState<DnaChoiceMap>(createEmptyDnaChoiceMap());
  const [antiPersonaDraft, setAntiPersonaDraft] = useState<AntiPersonaDraft>(createEmptyAntiPersonaDraft());
  const [legacyLines, setLegacyLines] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncGlow, setSyncGlow] = useState(false);
  const [activeTuningId, setActiveTuningId] = useState<DnaQuestionId | null>(null);
  const [previewFlash, setPreviewFlash] = useState(false);
  const [tabooQuickInput, setTabooQuickInput] = useState("");
  const [roadmapFieldBuffer, setRoadmapFieldBuffer] = useState(() => readIdentityFieldLog());

  const refreshRoadmapFieldBuffer = useCallback(() => {
    setRoadmapFieldBuffer(readIdentityFieldLog());
  }, []);

  useEffect(() => {
    refreshRoadmapFieldBuffer();
    if (typeof window === "undefined") return;
    window.addEventListener(DATA_SYNC_EVENT, refreshRoadmapFieldBuffer);
    return () => window.removeEventListener(DATA_SYNC_EVENT, refreshRoadmapFieldBuffer);
  }, [refreshRoadmapFieldBuffer]);

  const roadmapBufferSummary = useMemo(
    () => summarizeIdentityFieldBuffer(roadmapFieldBuffer),
    [roadmapFieldBuffer],
  );

  const applySettingsToView = useCallback((next: GhostSettings) => {
    const controls = parsePersonaControls(next.manualPosts);
    setSettings(next);
    setDnaChoices(controls.choices);
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
    if (!activeTuningId) return;
    const timeoutId = window.setTimeout(() => setActiveTuningId(null), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [activeTuningId]);
  useEffect(() => {
    setPreviewFlash(true);
    const timeoutId = window.setTimeout(() => setPreviewFlash(false), 260);
    return () => window.clearTimeout(timeoutId);
  }, [dnaChoices]);

  const serializedControls = useMemo(
    () => serializePersonaControls(dnaChoices, antiPersonaDraft, legacyLines),
    [antiPersonaDraft, dnaChoices, legacyLines],
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
  const selectedChoiceCount = useMemo(
    () => Object.values(dnaChoices).filter((value) => value != null).length,
    [dnaChoices],
  );
  const antiPersonaCount = useMemo(
    () => Object.values(antiPersonaDraft).filter((value) => value.trim() !== "").length,
    [antiPersonaDraft],
  );
  const derivedNgWords = useMemo(() => splitAvoidPhrases(antiPersonaDraft.avoid_phrases), [antiPersonaDraft]);
  const canAnalyze = totalHomeSignals > 0 || selectedChoiceCount > 0 || antiPersonaCount > 0 || legacyLines.length > 0;
  const identityStatusLabel =
    settings?.personaStatus === "approved"
      ? "Identity · 保存済み"
      : settings?.personaStatus === "draft"
        ? "Identity · 承認待ち"
        : "Identity · 未生成";
  const resolvedDnaQuestions = useMemo(
    () => FIXED_DNA_QUESTIONS,
    [],
  );
  const extractionRate = Math.min(100, selectedChoiceCount * 12 + antiPersonaCount * 13 + Math.min(totalHot * 6, 35));
  const hasUnsyncedChanges = useMemo(() => {
    if (!settings) return false;
    const manualChanged = JSON.stringify(serializedControls) !== JSON.stringify(settings.manualPosts);
    const ngChanged = JSON.stringify(derivedNgWords) !== JSON.stringify(settings.ngWords);
    return manualChanged || ngChanged || settings.personaStatus !== "approved" || pendingGrowthCount > 0;
  }, [derivedNgWords, pendingGrowthCount, serializedControls, settings]);

  const tuningSignals = useMemo(
    () => {
      const signals = resolvedDnaQuestions.map((question) => {
        const selected = dnaChoices[question.id];
        if (selected === "left") return question.leftSignal;
        if (selected === "right") return question.rightSignal;
        return null;
      });
      return signals.filter((item) => item !== null);
    },
    [dnaChoices, resolvedDnaQuestions],
  );
  const tuningHighlights = useMemo(
    () =>
      resolvedDnaQuestions.map((question) => {
        const selected = dnaChoices[question.id];
        if (!selected) return null;
        return {
          id: question.id,
          label: selected === "left" ? question.leftSignal : question.rightSignal,
        };
      }).filter((item) => item !== null),
    [dnaChoices, resolvedDnaQuestions],
  );
  const readyToGrow = extractionRate === 0;

  const prophecyLabel = useMemo(() => resolveProphecyFromChoices(dnaChoices), [dnaChoices]);

  const prevProphecyLabelRef = useRef(prophecyLabel);
  const [prophecyGlow, setProphecyGlow] = useState(false);
  useEffect(() => {
    if (prevProphecyLabelRef.current !== prophecyLabel) {
      prevProphecyLabelRef.current = prophecyLabel;
      setProphecyGlow(true);
      const timeoutId = window.setTimeout(() => setProphecyGlow(false), 780);
      return () => window.clearTimeout(timeoutId);
    }
  }, [prophecyLabel]);
  const marketGapLine = useMemo(() => {
    const toneGap =
      dnaChoices.logic_vs_emotion === "left"
        ? "感情論に寄りすぎた領域で、根拠ある厳密な仮説検証"
        : dnaChoices.logic_vs_emotion === "right"
          ? "情報過多で疲れた市場に、体温ある共感ストーリー"
          : "論理と情緒の橋渡しが不足している領域";
    const postureGap =
      dnaChoices.break_vs_harmony === "left"
        ? "旧来前提を壊すカウンター提案"
        : dnaChoices.break_vs_harmony === "right"
          ? "分断を避けつつ合意を作る翻訳提案"
          : "極端な主張の間を埋める実装案";
    const audienceGap =
      dnaChoices.crowd_vs_solitude === "left"
        ? "ニッチ課題を大衆向けに再定義する余白"
        : dnaChoices.crowd_vs_solitude === "right"
          ? "見過ごされた少数派の痛みを言語化する余白"
          : "大衆と少数派の境界にある未充足課題";
    return `${toneGap} × ${postureGap} × ${audienceGap}を狙う。`;
  }, [dnaChoices.break_vs_harmony, dnaChoices.crowd_vs_solitude, dnaChoices.logic_vs_emotion]);

  const previewMutation = useMemo(() => {
    const removedWords: string[] = [];
    const addedWords: string[] = [];

    if (dnaChoices.logic_vs_emotion === "left") {
      removedWords.push("切実", "やさしい", "ひりつく");
      addedWords.push("構造", "仮説", "したがって");
    } else if (dnaChoices.logic_vs_emotion === "right") {
      removedWords.push("構造", "最適化", "再現性");
      addedWords.push("切実", "体温", "胸のざわめき");
    }

    if (dnaChoices.break_vs_harmony === "left") {
      removedWords.push("穏やかに");
      addedWords.push("前提を壊す");
    } else if (dnaChoices.break_vs_harmony === "right") {
      removedWords.push("過激に");
      addedWords.push("橋を架ける");
    }

    if (dnaChoices.crowd_vs_solitude === "left") {
      removedWords.push("孤独な");
      addedWords.push("広い市場");
    } else if (dnaChoices.crowd_vs_solitude === "right") {
      removedWords.push("みんなの");
      addedWords.push("少数派の痛み");
    }

    return { removedWords, addedWords };
  }, [dnaChoices]);

  const tunedPreview = useMemo(() => {
    const fragments = [
      dnaChoices.logic_vs_emotion === "left" ? "まず構造を示し、どこを検証するかを明確にする。" : dnaChoices.logic_vs_emotion === "right" ? "まず感情の温度を差し出し、なぜそれが痛いのかを触らせる。" : "まず違和感の輪郭を静かに置く。",
      dnaChoices.break_vs_harmony === "left" ? "古い前提を壊しながら、新しい見方を提示する。" : dnaChoices.break_vs_harmony === "right" ? "対立を煽らず、相手の世界に橋を架ける。" : "対話の余白を残しながら進める。",
      dnaChoices.crowd_vs_solitude === "left" ? "広い市場へ翻訳し、共通課題として開いていく。" : dnaChoices.crowd_vs_solitude === "right" ? "少数派の孤独に深く刺し、わかる人だけに届かせる。" : "届く相手を慎重に見極める。",
    ];
    return fragments.join(" ");
  }, [dnaChoices]);

  const shreddedPreview = useMemo(() => {
    if (antiPersonaDraft.hated_success_patterns.trim()) {
      return `${antiPersonaDraft.hated_success_patterns.trim()} に寄せたキラキラ成功者風の文章は、この Identity では除外されます。`;
    }
    return "不安を煽って売る、誰でも成功できると断言する、権威だけで押し切る文体はこの Identity で除外されます。";
  }, [antiPersonaDraft.hated_success_patterns]);
  const rejectedSample = useMemo(() => {
    if (antiPersonaDraft.avoid_phrases.trim()) {
      return `「${antiPersonaDraft.avoid_phrases.trim()}」のような強引な成功者テンプレは、この Identity では偽物感として弾かれます。`;
    }
    return "あなたも今日から変われる。誰でも最短で成功できる。そんな都合の良い約束は、この Identity では拒絶されます。";
  }, [antiPersonaDraft.avoid_phrases]);
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
    async (options?: { silent?: boolean }) => {
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
      void handleAnalyze({ silent: true });
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
      <header className={cn("space-y-4 rounded-[28px] px-1 py-1 transition-all duration-700", syncGlow && "bg-violet-500/8 shadow-[0_0_120px_-40px_rgba(139,92,246,0.65)]")}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Fingerprint className="size-5" />
          <span className="text-sm font-medium">Identity Lab</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Identity の純度を上げる</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              あなたの軌跡から、揺るぎないアイデンティティを抽出する。
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">
                {identityStatusLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                `/lab` 検証数 {totalHomeSignals}
              </Badge>
            </div>
            {roadmapBufferSummary.total > 0 ? (
              <div className="max-w-3xl space-y-3 rounded-2xl border border-violet-200/80 bg-violet-50/50 p-4 text-sm dark:border-violet-800/50 dark:bg-violet-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-violet-900 dark:text-violet-100">
                    Roadmap 還流バッファ（未反映）
                  </p>
                  <Badge variant="outline" className="rounded-full border-violet-300/80 text-[10px] dark:border-violet-700/60">
                    {roadmapBufferSummary.total}件 · 🔥{roadmapBufferSummary.hot} · 刺さらず{roadmapBufferSummary.cold}
                    {roadmapBufferSummary.withMemo > 0 ? ` · メモ${roadmapBufferSummary.withMemo}` : ""}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  `/roadmap` で「結果を送信」した Hot / Cold / メモがここに積まれます。DNA やタブーを手で直したあと「確認済み」で空にするか、承認保存時に自動で空になります。
                </p>
                <ul className="max-h-40 space-y-2 overflow-y-auto text-xs text-foreground/90">
                  {roadmapFieldBuffer.slice(-8).map((entry) => (
                    <li key={`${entry.at}-${entry.itemId}`} className="rounded-lg border border-violet-200/40 bg-background/60 px-2 py-1.5 dark:border-violet-800/40">
                      <span className="font-medium text-muted-foreground">
                        {entry.quickFeedback === "hot" ? "🔥" : entry.quickFeedback === "cold" ? "刺さらず" : "—"}
                      </span>
                      {entry.memo?.trim() ? (
                        <span className="ml-2 text-muted-foreground">「{entry.memo.trim().slice(0, 120)}{entry.memo.trim().length > 120 ? "…" : ""}」</span>
                      ) : (
                        <span className="ml-2 text-muted-foreground/70">メモなし</span>
                      )}
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-violet-300/80 text-violet-900 hover:bg-violet-100/80 dark:border-violet-700/60 dark:text-violet-100 dark:hover:bg-violet-950/40"
                  onClick={() => {
                    clearIdentityFieldLog();
                    setRoadmapFieldBuffer([]);
                  }}
                >
                  確認済みでバッファを空にする
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 sm:max-w-xl sm:items-stretch">
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground">Identity Extraction</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{extractionRate}%</span>
              <div className="h-1.5 min-w-[140px] flex-1 overflow-hidden rounded-full bg-muted/80 sm:max-w-[220px]">
                <div
                  className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500"
                  style={{ width: `${extractionRate}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  pendingGrowthCount > 0
                    ? "border-amber-300 bg-amber-50 text-amber-700 shadow-[0_0_28px_-16px_rgba(251,146,60,0.85)] dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200"
                    : "border-border/50 bg-background/55 text-muted-foreground",
                )}
              >
                {hasUnsyncedChanges ? <span className="size-1.5 rounded-full bg-current animate-pulse" /> : null}
                未承認の成長 {pendingGrowthCount} 件
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleApprove()}
                disabled={saving || !settings?.personaSummary || (settings.personaKeywords?.length ?? 0) < 5}
                title="確定すると /lab の仮説圧縮、逆質問、本文生成に反映されます。"
                className={cn(
                  "min-w-[168px] bg-violet-600 text-white hover:bg-violet-500",
                  (syncGlow || hasUnsyncedChanges) && "shadow-[0_0_36px_-10px_rgba(139,92,246,0.9)]",
                )}
              >
                {pendingGrowthCount > 0 ? <span className="mr-1.5 size-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" /> : null}
                <CheckCircle2 className="mr-1 size-4" />
                {saving ? "保存中..." : "保存する"}
              </Button>
              <Link href="/lab">
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                  戻る
                </Button>
              </Link>
            </div>
          </div>
        </div>
        {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </header>

      <div className="grid gap-7 xl:grid-cols-[0.82fr_1.32fr_1.02fr]">
        <section className="space-y-6">
          <Card className="rounded-[30px] border-0 bg-white/58 shadow-none backdrop-blur-[2px] dark:bg-background/46">
            <CardHeader className="px-3 pb-3 md:px-4">
              <CardTitle>ROOTS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border/20">
              <div className="px-3 py-5 md:px-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">Identity DNA</p>
                      <p className="mt-1 text-sm text-muted-foreground">あなたの検証ログが、Identity DNA の純度を高めます。</p>
                    </div>
                    <div
                      className={cn(
                        "relative grid size-28 place-items-center rounded-full transition-all duration-500",
                        pendingGrowthCount > 0 && "shadow-[0_0_50px_-18px_rgba(251,146,60,0.9)]",
                      )}
                      style={{
                        background: `conic-gradient(${pendingGrowthCount > 0 ? "rgba(249,115,22,0.95)" : "rgba(124,58,237,0.9)"} 0% ${extractionRate}%, rgba(228,228,231,0.45) ${extractionRate}% 100%)`,
                      }}
                    >
                      {pendingGrowthCount > 0 ? (
                        <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-amber-400/60 animate-ping" />
                      ) : null}
                      {pendingGrowthCount > 0 ? (
                        <div className="absolute -right-2 top-2 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 shadow-[0_0_24px_-12px_rgba(251,146,60,0.9)] dark:bg-amber-950/25 dark:text-amber-200">
                          +{pendingGrowthCount}
                        </div>
                      ) : null}
                      <div className="grid size-[98px] place-items-center rounded-full bg-background/95 text-center">
                        <div>
                          <p className="text-2xl font-semibold">{extractionRate}%</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {readyToGrow ? "Ready to Grow" : "Identity DNA"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full",
                        pendingGrowthCount > 0 &&
                          "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200",
                      )}
                    >
                      {pendingGrowthCount > 0 ? `未保存 +${pendingGrowthCount}` : readyToGrow ? "Ready to Grow" : "変化なし"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Hot {totalHot} / 検証 {totalHomeSignals}</span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleAnalyze({ silent: true })}
                      disabled={analyzing || !canAnalyze}
                      className={cn(
                        "bg-linear-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500",
                        pendingGrowthCount > 0 && "shadow-[0_0_36px_-10px_rgba(124,58,237,0.95)]",
                      )}
                    >
                      {analyzing ? "保存中..." : "保存する"}
                    </Button>
                  </div>
                </div>

              <div
                className={cn(
                  "space-y-3 px-3 py-5 md:px-4 transition-all duration-500",
                )}
              >
                <div className="flex items-center gap-2">
                  <ShieldBan className="size-4 text-rose-500" />
                  <div>
                    <p className="text-sm font-medium">My Taboo</p>
                    <p className="text-xs text-muted-foreground">裁断した破片を管理し、必要な拒絶を追加します。</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-200/60 bg-rose-50/65 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                  {allTabooTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {allTabooTags.map((tag) => (
                        <button
                          key={`taboo-fragment-${tag}`}
                          type="button"
                          onClick={() => {
                            removeAntiPersonaTag("avoid_phrases", tag);
                            removeAntiPersonaTag("hated_success_patterns", tag);
                            removeAntiPersonaTag("intolerable_injustice", tag);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-300/80 bg-white/80 px-3 py-1 text-xs text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/35 dark:text-rose-200"
                        >
                          <Scissors className="size-3" />
                          {tag}
                          <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">まだ裁断済みの破片はありません。下の入力から追加できます。</p>
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
                  className="h-11 border-0 bg-muted/25 shadow-none placeholder:text-muted-foreground/35"
                  placeholder="拒絶ワードを追加して Enter"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <Card className="rounded-[30px] border-0 bg-white/60 shadow-none backdrop-blur-[2px] dark:bg-background/48">
            <CardHeader className="px-3 pb-3 md:px-4">
              <CardTitle>THE CORE</CardTitle>
              <CardDescription>中央で DNA をチューニングすると、右のプレビューが即座に反応します。</CardDescription>
            </CardHeader>
            <CardContent className="border-t border-border/20 pt-3">
              <div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
                <div className="space-y-3 px-3 py-2 md:px-4">
                  {resolvedDnaQuestions.map((question) => {
                    const selected = dnaChoices[question.id];
                    return (
                      <div key={question.id} className="space-y-2 rounded-2xl border border-border/40 bg-background/50 p-3">
                        <div className="flex items-center gap-2">
                          <ArrowLeftRight className="size-4 text-muted-foreground" />
                          <p className="text-sm font-medium">{question.prompt}</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTuningId(question.id);
                              setDnaChoices((current) => ({ ...current, [question.id]: "left" }));
                            }}
                            className={cn(
                              "rounded-xl border px-3 py-3 text-left text-sm transition-all duration-200",
                              selected === "left"
                                ? "border-violet-500 bg-violet-50 text-violet-900 opacity-100 shadow-[0_0_34px_-14px_rgba(124,58,237,0.95)] dark:border-violet-400 dark:bg-violet-950/35 dark:text-violet-100"
                                : selected === "right"
                                  ? "opacity-45"
                                  : "border-border/60 bg-background/75 hover:border-violet-300",
                            )}
                          >
                            {question.leftLabel}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTuningId(question.id);
                              setDnaChoices((current) => ({ ...current, [question.id]: "right" }));
                            }}
                            className={cn(
                              "rounded-xl border px-3 py-3 text-left text-sm transition-all duration-200",
                              selected === "right"
                                ? "border-violet-500 bg-violet-50 text-violet-900 opacity-100 shadow-[0_0_34px_-14px_rgba(124,58,237,0.95)] dark:border-violet-400 dark:bg-violet-950/35 dark:text-violet-100"
                                : selected === "left"
                                  ? "opacity-45"
                                  : "border-border/60 bg-background/75 hover:border-violet-300",
                            )}
                          >
                            {question.rightLabel}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-2xl border border-violet-200/50 bg-violet-50/60 px-3 py-4 dark:border-violet-800/40 dark:bg-violet-950/20 md:px-4">
                  <p className="text-xs font-semibold tracking-wide text-violet-700/90 dark:text-violet-200/90">DNAシグナル（詳細）</p>
                  {tuningHighlights.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tuningHighlights.map((item) => (
                        <span
                          key={item.id}
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-medium transition-all",
                            activeTuningId === item.id
                              ? "animate-pulse bg-violet-600 text-white shadow-[0_0_28px_-8px_rgba(124,58,237,0.9)]"
                              : "bg-violet-100/80 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200",
                          )}
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-violet-700/80 dark:text-violet-200/80">選択後にここへDNAシグナルが表示されます。</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <Card className="rounded-[30px] border-0 bg-white/58 shadow-none backdrop-blur-[2px] dark:bg-background/46">
            <CardHeader className="px-3 pb-3 md:px-4">
              <CardTitle>PREVIEW LAB</CardTitle>
              <CardDescription>THE CORE の結果として、称号・文体・拒絶フィルタのプレビューがここに集約されます。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border/20 border-t border-border/20 pt-2">
              <div className="px-3 py-5 md:px-4">
                <div className="rounded-2xl border border-violet-300/60 bg-linear-to-r from-violet-100/85 via-fuchsia-50/70 to-indigo-50/65 px-4 py-4 shadow-[0_0_55px_-20px_rgba(139,92,246,0.9)] dark:border-violet-700/50 dark:from-violet-950/35 dark:via-fuchsia-950/20 dark:to-indigo-950/20">
                  <p className="text-center text-[11px] font-semibold tracking-[0.18em] text-violet-700 dark:text-violet-200">CURRENT PROPHECY</p>
                  <p
                    className={cn(
                      "mt-2 text-center text-[2rem] font-extrabold leading-tight text-violet-900 transition-all duration-300 dark:text-violet-100 md:text-[2.4rem]",
                      prophecyGlow && "[text-shadow:0_0_36px_rgba(139,92,246,0.6)]",
                    )}
                  >
                    「{prophecyLabel}」
                  </p>
                  <p className="mt-2 text-center text-sm leading-6 text-violet-900/85 dark:text-violet-100/85">{marketGapLine}</p>
                </div>
              </div>
              <div className="space-y-3 px-3 py-5 md:px-4">
                <div
                  className={cn(
                    "rounded-2xl bg-linear-to-br from-violet-50/80 via-white to-amber-50/45 p-4 transition-all duration-200 dark:from-violet-950/15 dark:via-background dark:to-amber-950/10",
                    previewFlash && "scale-[1.01] shadow-[0_0_44px_-22px_rgba(139,92,246,0.9)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wide text-violet-700 dark:text-violet-300">Identity Sample</p>
                    <Badge variant="secondary" className={cn("rounded-full text-[10px]", previewFlash && "animate-pulse")}>
                      LIVE
                    </Badge>
                  </div>
                  {tunedPreview ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {previewMutation.removedWords.map((word) => (
                          <span key={`removed-${word}`} className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs text-rose-700 line-through decoration-2 dark:bg-rose-950/30 dark:text-rose-200">
                            {word}
                          </span>
                        ))}
                        {previewMutation.addedWords.map((word) => (
                          <span key={`added-${word}`} className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 shadow-[0_0_18px_-10px_rgba(16,185,129,0.9)] dark:bg-emerald-950/30 dark:text-emerald-200">
                            {word}
                          </span>
                        ))}
                      </div>
                      <p className="mt-4 text-base leading-8">{tunedPreview}</p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm tracking-wide text-muted-foreground/45">( ? ) Identity を抽出中...</p>
                  )}
                </div>

                <p className="text-sm font-medium">Identity Filter</p>
                <div
                  className="rounded-2xl border border-rose-400/55 bg-rose-50/70 p-4 shadow-[0_24px_52px_-24px_rgba(244,63,94,0.95)] dark:border-rose-700/50 dark:bg-rose-950/20"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, rgba(244,63,94,0.12) 0px, rgba(244,63,94,0.12) 12px, rgba(255,255,255,0.0) 12px, rgba(255,255,255,0.0) 24px)",
                    transform: "rotate(-1deg)",
                  }}
                >
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-rose-700 dark:text-rose-300">SHREDDER / REJECTED TEXT</p>
                  <p className="relative mt-2 text-sm leading-6 text-rose-700 [text-shadow:0_1px_0_rgba(244,63,94,0.12)] before:absolute before:left-0 before:right-6 before:top-[42%] before:h-[2px] before:-rotate-2 before:bg-rose-500/90 after:absolute after:left-2 after:right-0 after:top-[58%] after:h-[2px] after:rotate-[1.4deg] after:bg-rose-400/80 dark:text-rose-200">
                    {shreddedPreview}
                  </p>
                  <div className="mt-3 rounded-xl bg-white/70 p-3 ring-1 ring-rose-200/60 dark:bg-background/40 dark:ring-rose-900/40">
                    <p className="inline-flex rounded-sm border border-rose-500/60 bg-rose-100/85 px-2 py-1 font-mono text-[11px] font-bold tracking-[0.22em] text-rose-700 shadow-[0_0_0_1px_rgba(244,63,94,0.08)] dark:border-rose-400/40 dark:bg-rose-950/25 dark:text-rose-200">
                      TRASH / FAKE
                    </p>
                    <p className="mt-2 text-sm leading-6 text-rose-700 dark:text-rose-200">{rejectedSample}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-3 py-5 md:px-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <p className="text-sm font-medium">Strategy Note</p>
                </div>
                <div className="rounded-2xl border border-violet-200/50 bg-violet-50/55 p-4 dark:border-violet-800/40 dark:bg-violet-950/20">
                  <p className="mt-3 text-sm leading-7 text-violet-900/85 dark:text-violet-100/85">
                    {tuningSignals.length > 0
                      ? `現在のDNAシグナル: ${tuningSignals.join(" / ")}`
                      : "中央の THE CORE で DNA を調整すると、このカードのプレビューが先に動きます。"}
                  </p>
                  <div className="mt-3">
                    <Link href="/lab">
                      <Button type="button" size="sm" className="bg-violet-600 text-white hover:bg-violet-500">
                        戻る
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
