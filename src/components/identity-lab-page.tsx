"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Fingerprint, Flame, Link2, ShieldBan, Sparkles } from "lucide-react";

import { analyzePersona, fetchArchiveInsights, fetchGhostSettings, updateGhostSettings } from "@/lib/api-client";
import { useAuthSession } from "@/lib/use-auth-session";
import type { ArchiveInsights, GhostSettings } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    leftLabel: "冷徹な分析",
    rightLabel: "熱い共感",
    leftSignal: "筋道で納得を作る",
    rightSignal: "感情の温度から始める",
  },
  {
    id: "break_vs_harmony",
    prompt: "破壊 vs 調和",
    leftLabel: "前提を壊す",
    rightLabel: "関係を守る",
    leftSignal: "常識への反逆を含む",
    rightSignal: "共感と橋渡しを重視する",
  },
  {
    id: "crowd_vs_solitude",
    prompt: "大衆 vs 孤独",
    leftLabel: "大衆へ拡張",
    rightLabel: "孤独を貫く",
    leftSignal: "広い課題に翻訳する",
    rightSignal: "少数派の痛みから始める",
  },
  {
    id: "speed_vs_density",
    prompt: "スピード vs 密度",
    leftLabel: "即断で走る",
    rightLabel: "執念で磨く",
    leftSignal: "検証回数を優先する",
    rightSignal: "意味の濃さを優先する",
  },
  {
    id: "utility_vs_philosophy",
    prompt: "実利 vs 思想",
    leftLabel: "効能を示す",
    rightLabel: "思想で染める",
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
type AntiPersonaInputDraft = Record<AntiPersonaKey, string>;

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

function createEmptyAntiPersonaInputDraft(): AntiPersonaInputDraft {
  return {
    avoid_phrases: "",
    hated_success_patterns: "",
    intolerable_injustice: "",
  };
}

function buildDynamicQuestions(settings: GhostSettings | null, antiPersonaDraft: AntiPersonaDraft): DnaQuestion[] {
  const sourceText = [
    settings?.personaSummary ?? "",
    ...(settings?.personaKeywords ?? []),
    ...(settings?.personaEvidence ?? []),
    ...Object.values(antiPersonaDraft),
  ].join(" ");

  const firstPrompt = /(美学|思想|余韻|世界観|孤独|異物)/.test(sourceText)
    ? {
        id: "speed_vs_density" as const,
        prompt: "Rootsを見ると『利益』より『美学』が強い。今回もそう振る？",
        leftLabel: "利益の手触り",
        rightLabel: "美学の純度",
        leftSignal: "市場価値を先に証明する",
        rightSignal: "美しさで異物感を残す",
        sourceLabel: "ROOTSから生成",
      }
    : {
        id: "speed_vs_density" as const,
        prompt: "Rootsを見ると『速度』と『密度』のどちらを優先すると強い？",
        leftLabel: "まず速く試す",
        rightLabel: "密度高く磨く",
        leftSignal: "検証回数を優先する",
        rightSignal: "意味の濃さを優先する",
        sourceLabel: "ROOTSから生成",
      };

  const secondPrompt = /(当事者|不条理|怒り|報われない|傷|痛み)/.test(sourceText)
    ? {
        id: "utility_vs_philosophy" as const,
        prompt: "いまのログでは『当事者性』が強い。今回もそこから語る？",
        leftLabel: "自分の傷から語る",
        rightLabel: "誰にでも開いて語る",
        leftSignal: "当事者の熱で巻き込む",
        rightSignal: "普遍化して市場へ開く",
        sourceLabel: "ROOTSから生成",
      }
    : {
        id: "utility_vs_philosophy" as const,
        prompt: "いまのRootsでは『実利』と『思想』のどちらを前に出す？",
        leftLabel: "役に立つを先に出す",
        rightLabel: "思想から世界観を作る",
        leftSignal: "即効性のある価値を示す",
        rightSignal: "思想の芯で惹きつける",
        sourceLabel: "ROOTSから生成",
      };

  return [firstPrompt, secondPrompt];
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

function choiceToSliderValue(value: DnaChoiceValue): number {
  if (value === "left") return 0;
  if (value === "right") return 100;
  return 50;
}

function sliderValueToChoice(value: string): DnaChoiceValue {
  if (value === "0") return "left";
  if (value === "100") return "right";
  return null;
}

export function IdentityLabPage() {
  const { user, loading: authLoading } = useAuthSession();
  const autoAnalyzeStartedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GhostSettings | null>(null);
  const [archiveInsights, setArchiveInsights] = useState<ArchiveInsights | null>(null);
  const [dnaChoices, setDnaChoices] = useState<DnaChoiceMap>(createEmptyDnaChoiceMap());
  const [antiPersonaDraft, setAntiPersonaDraft] = useState<AntiPersonaDraft>(createEmptyAntiPersonaDraft());
  const [antiPersonaInput, setAntiPersonaInput] = useState<AntiPersonaInputDraft>(createEmptyAntiPersonaInputDraft());
  const [legacyLines, setLegacyLines] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncGlow, setSyncGlow] = useState(false);
  const [activeTuningId, setActiveTuningId] = useState<DnaQuestionId | null>(null);

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
        setError(cause instanceof Error ? cause.message : "Identity 設定の取得に失敗しました");
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
      ? "Identity · Lab 同期済み"
      : settings?.personaStatus === "draft"
        ? "Identity · 承認待ち"
        : "Identity · 未生成";
  const resolvedDnaQuestions = useMemo(
    () => [...FIXED_DNA_QUESTIONS.slice(0, 3), ...buildDynamicQuestions(settings, antiPersonaDraft)],
    [antiPersonaDraft, settings],
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

  const prophecyLabel = useMemo(() => {
    const logicEmotion = dnaChoices.logic_vs_emotion;
    const breakHarmony = dnaChoices.break_vs_harmony;
    const crowdSolitude = dnaChoices.crowd_vs_solitude;
    const unresolvedCount = Object.values(dnaChoices).filter((value) => value == null).length;

    if (unresolvedCount > 0) {
      return "平均的な起業家";
    }

    const tone =
      logicEmotion === "left" ? "論理的な" : logicEmotion === "right" ? "情緒的な" : "均整の取れた";
    const posture =
      breakHarmony === "left" ? "異端児" : breakHarmony === "right" ? "調律者" : "探究者";
    const audience =
      crowdSolitude === "left" ? "市場翻訳型" : crowdSolitude === "right" ? "少数派特化型" : "中間型";

    return `${tone}${posture} / ${audience}`;
  }, [dnaChoices]);

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
        setStatus(
          options?.silent
            ? "最新ログを取り込み、Identity DNA を自動更新しました。"
            : "Identity DNA を再構成しました。中央と右の内容を確認してください。",
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Identity の分析に失敗しました");
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
      setSyncGlow(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("emoswitch_identity_sync_glow", String(Date.now()));
      }
      setStatus("Identityを同期しました。あなたの思想がLabに反映されました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Identity の同期に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [applySettingsToView, derivedNgWords, serializedControls, settings, totalHot]);

  const appendAntiPersonaTag = useCallback((field: AntiPersonaKey, rawValue: string) => {
    const nextValue = rawValue.trim();
    if (!nextValue) return;
    setAntiPersonaDraft((current) => {
      const tags = splitTagDraft(current[field]);
      if (tags.includes(nextValue)) return current;
      return {
        ...current,
        [field]: [...tags, nextValue].join(" / "),
      };
    });
    setAntiPersonaInput((current) => ({
      ...current,
      [field]: "",
    }));
  }, []);

  const removeAntiPersonaTag = useCallback((field: AntiPersonaKey, tag: string) => {
    setAntiPersonaDraft((current) => {
      const tags = splitTagDraft(current[field]).filter((item) => item !== tag);
      return {
        ...current,
        [field]: tags.join(" / "),
      };
    });
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
                {saving ? "確定中..." : "Commit Identity"}
              </Button>
              <Link href="/lab">
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                  /lab
                </Button>
              </Link>
            </div>
          </div>
        </div>
        {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </header>

      <div className="grid gap-7 xl:grid-cols-[0.95fr_1.18fr_0.95fr]">
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
                    {pendingGrowthCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleAnalyze();
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 shadow-[0_0_30px_-14px_rgba(251,146,60,0.8)] transition-all hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200"
                      >
                        <span className="size-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
                        +{pendingGrowthCount} New Insights
                      </button>
                    ) : (
                      <Badge variant="outline" className="rounded-full">
                        {readyToGrow ? "Ready to Grow" : "変化なし"}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">Hot {totalHot} / 検証 {totalHomeSignals}</span>
                  </div>
                </div>

              <div className="space-y-3 px-3 py-5 md:px-4">
                <div className="flex items-center gap-2">
                  <ShieldBan className="size-4 text-rose-500" />
                  <div>
                    <p className="text-sm font-medium">My Taboo</p>
                    <p className="text-xs text-muted-foreground">思いついた拒絶を、Enterでタグとして溜めていきます。</p>
                  </div>
                </div>
                {ANTI_PERSONA_FIELDS.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">{field.label}</p>
                    {antiPersonaTags[field.id].length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {antiPersonaTags[field.id].map((tag) => (
                          <button
                            key={`${field.id}-${tag}`}
                            type="button"
                            onClick={() => removeAntiPersonaTag(field.id, tag)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200/80 bg-rose-50/80 px-3 py-1 text-xs text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200"
                          >
                            {tag}
                            <span aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <Input
                      value={antiPersonaInput[field.id]}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAntiPersonaInput((current) => ({
                          ...current,
                          [field.id]: value,
                        }));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          appendAntiPersonaTag(field.id, antiPersonaInput[field.id]);
                        }
                      }}
                      className="h-11 border-0 bg-muted/25 shadow-none placeholder:text-muted-foreground/35"
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
                {derivedNgWords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {derivedNgWords.map((word) => (
                      <Badge key={word} variant="outline" className="rounded-full text-[11px]">
                        {word}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <Card className="rounded-[30px] border-0 bg-white/60 shadow-none backdrop-blur-[2px] dark:bg-background/48">
            <CardHeader className="px-3 pb-3 md:px-4">
              <CardTitle>THE CORE</CardTitle>
              <CardDescription>あなたの存在の設計図</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border/20 border-t border-border/20 pt-2">
              {resolvedDnaQuestions.map((question) => {
                const selected = dnaChoices[question.id];
                const sliderValue = choiceToSliderValue(selected);
                return (
                  <div key={question.id} className="px-3 py-3.5 md:px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ArrowLeftRight className="size-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{question.prompt}</p>
                        {question.sourceLabel ? <Link2 className="size-3.5 text-muted-foreground/70" /> : null}
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3">
                      <span
                        className={cn(
                          "min-w-0 shrink-0 text-[10px] leading-tight text-muted-foreground/85 transition-colors",
                          selected === "left" && "font-semibold text-foreground",
                        )}
                      >
                        {question.leftLabel}
                      </span>
                      <div className="relative flex-1">
                        <div className="h-2 rounded-full bg-linear-to-r from-violet-200/80 via-zinc-200/70 to-amber-200/80 dark:from-violet-800/60 dark:via-zinc-700/60 dark:to-amber-800/60" />
                        <div
                          className={cn(
                            "pointer-events-none absolute top-1/2 size-5 -translate-y-1/2 rounded-full border-2 border-white bg-violet-600 shadow-[0_0_24px_-6px_rgba(124,58,237,0.9)] transition-all duration-200 dark:border-background",
                            activeTuningId === question.id && "scale-110",
                          )}
                          style={{ left: `calc(${sliderValue}% - 10px)` }}
                        />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="50"
                          value={sliderValue}
                          onChange={(event) => {
                            const next = sliderValueToChoice(event.target.value);
                            setActiveTuningId(question.id);
                            setDnaChoices((current) => ({
                              ...current,
                              [question.id]: next,
                            }));
                          }}
                          className="absolute inset-0 h-5 w-full cursor-pointer opacity-0"
                        />
                      </div>
                      <span
                        className={cn(
                          "min-w-0 shrink-0 text-[10px] leading-tight text-right text-muted-foreground/85 transition-colors",
                          selected === "right" && "font-semibold text-foreground",
                        )}
                      >
                        {question.rightLabel}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-2xl bg-linear-to-r from-violet-50/70 via-transparent to-amber-50/35 px-3 py-4 transition-all dark:from-violet-950/15 dark:to-amber-950/10 md:px-4">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground/85">
                  Detected Identity（検知されたアイデンティティ）
                </p>
                <p
                  className={cn(
                    "mt-1 text-[1.45rem] font-semibold leading-tight text-violet-700 transition-all duration-300 dark:text-violet-200",
                    prophecyGlow && "[text-shadow:0_0_32px_rgba(139,92,246,0.55)]",
                  )}
                >
                  「{prophecyLabel}」
                </p>
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
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <Card className="rounded-[30px] border-0 bg-white/58 shadow-none backdrop-blur-[2px] dark:bg-background/46">
            <CardHeader className="px-3 pb-3 md:px-4">
              <CardTitle>EVIDENCE / PREVIEW</CardTitle>
              <CardDescription>思想を論理に。アイデンティティを言葉に。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border/20 border-t border-border/20 pt-2">
              <div className="space-y-3 px-3 py-5 md:px-4">
                <div className="rounded-2xl bg-linear-to-br from-violet-50/80 via-white to-amber-50/45 p-4 dark:from-violet-950/15 dark:via-background dark:to-amber-950/10">
                  <p className="text-[11px] font-semibold tracking-wide text-violet-700 dark:text-violet-300">Identity Sample</p>
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
                      <p className="mt-4 text-sm leading-7">{tunedPreview}</p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm tracking-wide text-muted-foreground/45">( ? ) Identity を抽出中...</p>
                  )}
                </div>

                <p className="text-sm font-medium">Identity Filter</p>
                <div
                  className="rounded-2xl bg-rose-50/50 p-4 shadow-[0_18px_38px_-30px_rgba(244,63,94,0.85)] dark:bg-rose-950/10"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, rgba(244,63,94,0.12) 0px, rgba(244,63,94,0.12) 12px, rgba(255,255,255,0.0) 12px, rgba(255,255,255,0.0) 24px)",
                    transform: "rotate(-1deg)",
                  }}
                >
                  <p className="text-[11px] font-semibold tracking-wide text-rose-700 dark:text-rose-300">SHREDDER / FAKE SUCCESS SAMPLE</p>
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
                  <p className="text-sm font-medium">Identity Logic</p>
                </div>
                {settings?.personaSummary?.trim() ||
                settings?.stylePrompt ||
                (settings?.personaEvidence && settings.personaEvidence.length > 0) ? (
                  <div className="space-y-4">
                    {settings?.personaSummary?.trim() ? (
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">Identity Summary</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{settings.personaSummary.trim()}</p>
                      </div>
                    ) : null}
                    {settings?.stylePrompt ? (
                      <div className={cn(settings?.personaSummary?.trim() && "border-t border-border/15 pt-4")}>
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">Style Prompt</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{settings.stylePrompt}</p>
                      </div>
                    ) : null}
                    {settings?.personaEvidence && settings.personaEvidence.length > 0 ? (
                      <div
                        className={cn(
                          (settings?.personaSummary?.trim() || settings?.stylePrompt) && "border-t border-border/15 pt-4",
                        )}
                      >
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">Reasoning</p>
                        <div className="mt-2 space-y-2">
                          {settings.personaEvidence.map((item) => (
                            <p key={item} className="text-sm text-muted-foreground">
                              ・{item}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted/18 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="size-2 rounded-full bg-violet-400/70" />
                      <span className="h-px flex-1 bg-border/35" />
                      <span className="size-2 rounded-full bg-amber-400/60" />
                    </div>
                    <div className="flex items-center gap-3 opacity-45">
                      <div className="size-8 rounded-full border border-border/50" />
                      <div className="space-y-2 flex-1">
                        <div className="h-2 w-2/3 rounded-full bg-muted-foreground/20" />
                        <div className="h-2 w-1/2 rounded-full bg-muted-foreground/15" />
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground/55">分析完了後に、あなたの Identity の相関図が表示されます。</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

    </div>
  );
}
