"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Flame, Heart, Swords } from "lucide-react";

import { GenerationSkeleton } from "@/components/generation-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ensureDemoWorkspace,
  fetchArchiveInsights,
  analyzeHypothesisCanvas,
  fetchCreditSummary,
  fetchGhostSettings,
  fetchUserProfile,
  generateTriple,
  patchGenerationRecord,
  saveGenerationRecord,
  type GenerateSeriesItem,
  type GenerateSeriesResponse,
  type GenerateSingleResponse,
} from "@/lib/api-client";
import { CHAMELEON } from "@/lib/chameleon";
import { EMOTION_LABELS, type EmotionTone } from "@/lib/emotions";
import { parseEmotionFromQuery, readAndClearReuseSession } from "@/lib/reuse-session";
import { SERIES_SLOT_CONFIG } from "@/lib/series";
import { playSwitchClick } from "@/lib/switch-sound";
import { cn } from "@/lib/utils";

const CANVAS_PLACEHOLDER =
  "誰の、どんな痛みを、なぜあなたが解くのか。\n違和感、原体験、怒り、試したい仮説をそのまま置いてください。";

const ENERGY_RGB_BY_EMOTION: Record<EmotionTone, string> = {
  empathy: "236, 72, 153",
  toxic: "220, 38, 38",
  mood: "124, 58, 237",
  useful: "8, 145, 178",
  minimal: "82, 82, 91",
};

type StrategyGoal = "awareness" | "education" | "engagement";
type StrategyTemplateId = "validation" | "pain-signal" | "authority-proof";

type ArchiveRecommendation = {
  summary: string;
  emotion: EmotionTone | null;
  intensity: number | null;
};

const STRATEGY_TEMPLATES: Array<{
  id: StrategyTemplateId;
  label: string;
  summary: string;
  emotion: EmotionTone;
  intensity: number;
  strategyGoal: StrategyGoal;
}> = [
  {
    id: "validation",
    label: "共感を武器にする検証",
    summary: "共感から入り、同じ痛みを持つ人の反応を確かめる",
    emotion: "empathy",
    intensity: 50,
    strategyGoal: "engagement",
  },
  {
    id: "pain-signal",
    label: "課題を武器にする検証",
    summary: "課題の強さを前面に出し、市場の違和感をあぶり出す",
    emotion: "toxic",
    intensity: 90,
    strategyGoal: "awareness",
  },
  {
    id: "authority-proof",
    label: "論理を武器にする検証",
    summary: "論点を整理し、筋の良さで納得と反応を取る",
    emotion: "useful",
    intensity: 55,
    strategyGoal: "education",
  },
];

const GOAL_LABELS: Record<StrategyGoal, string> = {
  awareness: "共感",
  education: "納得",
  engagement: "検証",
};

function inferGoalFromEmotion(emotion: EmotionTone): StrategyGoal {
  if (emotion === "useful") return "education";
  if (emotion === "mood") return "engagement";
  return "awareness";
}

function buildSeriesRoadmap(templateLabel: string, emotionLabel: string) {
  return [
    {
      rangeLabel: "DAY 1-10",
      focus: "第1フェーズ",
      goal: "認知ではなく共感",
      objective: "課題を自分ごとにしてもらう",
      detail: `${templateLabel}の切り口で痛みを可視化し、${emotionLabel}の見せ方で最初の反応を集める`,
    },
    {
      rangeLabel: "DAY 11-20",
      focus: "第2フェーズ",
      goal: "信頼ではなく納得",
      objective: "なぜその仮説が成立するかを示す",
      detail: "経験・観察・小さな実験結果を出し、事業の筋が通っていると感じてもらう",
    },
    {
      rangeLabel: "DAY 21-30",
      focus: "第3フェーズ",
      goal: "ファン化ではなく検証",
      objective: "一緒に試したい人を集める",
      detail: "募集、壁打ち、簡易オファーを提示して、市場から次の一手を受け取る",
    },
  ];
}

const STRATEGY_TILE_META: Record<StrategyTemplateId, { icon: React.ReactElement }> = {
  validation: {
    icon: <Heart className="size-4" />,
  },
  "pain-signal": {
    icon: <Swords className="size-4" />,
  },
  "authority-proof": {
    icon: <BookOpen className="size-4" />,
  },
};

const SPRINT_PHASE_STYLES = [
  {
    tone: "bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    border: "border-rose-200/80 dark:border-rose-800/60",
    bar: "bg-rose-400/80 dark:bg-rose-400/70",
    glow: "bg-rose-500/10 dark:bg-rose-500/15",
  },
  {
    tone: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    border: "border-amber-200/80 dark:border-amber-800/60",
    bar: "bg-amber-400/85 dark:bg-amber-400/70",
    glow: "bg-amber-500/10 dark:bg-amber-500/15",
  },
  {
    tone: "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
    border: "border-violet-200/80 dark:border-violet-800/60",
    bar: "bg-violet-400/85 dark:bg-violet-400/70",
    glow: "bg-violet-500/10 dark:bg-violet-500/15",
  },
] as const;

const LIGHTWEIGHT_PREVIEW_TONE: EmotionTone = "empathy";
const LIGHTWEIGHT_PREVIEW_INTENSITY = 50;

function clampEnergy(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function getIntensityFireCount(intensity: number) {
  if (intensity >= 80) return 3;
  if (intensity >= 55) return 2;
  return 1;
}

function buildOpportunitySeed(params: {
  draft: string;
  audience: string;
  pain: string;
  whyMe: string;
  firstExperiment: string;
}) {
  const sections = [
    params.draft.trim() ? `事業の種:\n${params.draft.trim()}` : null,
    params.audience.trim() ? `誰の課題か:\n${params.audience.trim()}` : null,
    params.pain.trim() ? `どんな痛みか:\n${params.pain.trim()}` : null,
    params.whyMe.trim() ? `AIへの追加回答:\n${params.whyMe.trim()}` : null,
    params.firstExperiment.trim() ? `まず何を試すか:\n${params.firstExperiment.trim()}` : null,
  ].filter(Boolean);

  return sections.join("\n\n");
}

type SingleResult = GenerateSingleResponse;
type SeriesResult = GenerateSeriesResponse;

export function CreateWorkspace() {
  const router = useRouter();
  const hasAppliedInitialOverridesRef = useRef(false);
  const canvasRequestIdRef = useRef(0);
  const lastAnalyzedCanvasKeyRef = useRef("");
  const [draft, setDraft] = useState("");
  const [refinementAnswer, setRefinementAnswer] = useState("");
  const [generationMode, setGenerationMode] = useState<"single" | "series">("single");
  const [strategyGoal, setStrategyGoal] = useState<StrategyGoal>("awareness");
  const [emotion, setEmotion] = useState<EmotionTone>("empathy");
  const [intensity, setIntensity] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [variants, setVariants] = useState<string[]>([]);
  const [variantFocuses, setVariantFocuses] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesItems, setSeriesItems] = useState<GenerateSeriesItem[]>([]);
  const [adviceHint, setAdviceHint] = useState<string | null>(null);
  const [ghostWhisper, setGhostWhisper] = useState<string | null>(null);
  const [memoryTags, setMemoryTags] = useState<string[]>([]);
  const [resultMode, setResultMode] = useState<"single" | "series">("single");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [archiveRecommendation, setArchiveRecommendation] = useState<ArchiveRecommendation | null>(null);
  const [personaKeywords, setPersonaKeywords] = useState<string[]>([]);
  const [personaSummary, setPersonaSummary] = useState("");
  const [personaStatus, setPersonaStatus] = useState<"empty" | "draft" | "approved">("empty");
  const [activeTemplateId, setActiveTemplateId] = useState<StrategyTemplateId | null>(null);
  const [canvasSummary, setCanvasSummary] = useState("");
  const [canvasPreviewTitle, setCanvasPreviewTitle] = useState("");
  const [canvasQuestion, setCanvasQuestion] = useState("");
  const [canvasDnaAlignment, setCanvasDnaAlignment] = useState<number | null>(null);
  const [canvasDnaReason, setCanvasDnaReason] = useState("");
  const [canvasWarning, setCanvasWarning] = useState<string | null>(null);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const deferredDraft = useDeferredValue(draft);
  const deferredRefinementAnswer = useDeferredValue(refinementAnswer);

  const chameleon = CHAMELEON[emotion];
  const energyLevel = clampEnergy(intensity / 100);
  const energyGlow = ENERGY_RGB_BY_EMOTION[emotion];
  const currentGoalLabel = GOAL_LABELS[strategyGoal];
  const isSprintMode = generationMode === "series";
  const trimmedDraft = draft.trim();
  const hasRefinementAnswer = refinementAnswer.trim().length > 0;
  const deferredTrimmedDraft = deferredDraft.trim();
  const storedSeed = useMemo(
    () =>
      buildOpportunitySeed({
        draft,
        audience: "",
        pain: "",
        whyMe: refinementAnswer,
        firstExperiment: "",
      }),
    [draft, refinementAnswer],
  );
  const deferredCanvasKey = useMemo(
    () =>
      JSON.stringify({
        draft: deferredDraft.trim().replace(/\s+/g, " "),
        refinementAnswer: deferredRefinementAnswer.trim().replace(/\s+/g, " "),
        generationMode,
        personaKeywords,
        personaSummary: personaSummary.trim().replace(/\s+/g, " "),
      }),
    [deferredDraft, deferredRefinementAnswer, generationMode, personaKeywords, personaSummary],
  );
  const inputCompletionCount = [draft, refinementAnswer].filter((item) => item.trim()).length;
  const strategyMatrixTiles = STRATEGY_TEMPLATES;
  const activeTemplate = STRATEGY_TEMPLATES.find((template) => template.id === activeTemplateId) ?? null;
  const canChooseSprint = Boolean(canvasSummary) && trimmedDraft.length > 0 && (canvasQuestion === "" || hasRefinementAnswer);
  const canvasAnalysisDelayMs = hasRefinementAnswer ? 650 : 1600;
  const summaryCardCopy = useMemo(() => {
    if (canvasSummary) {
      return {
        label: canvasLoading ? (hasRefinementAnswer ? "返答を反映中" : "更新中") : hasRefinementAnswer ? "AIリフレーム" : "AIパンチライン",
        text: canvasSummary,
        hint: hasRefinementAnswer
          ? "逆質問への返答を踏まえて、いま検証すべき仮説へ再圧縮しています。"
          : "左カラムの入力をもとに、いま検証すべき仮説へ圧縮しました。",
      };
    }
    if (hasRefinementAnswer && trimmedDraft.length > 0) {
      const firstLine = trimmedDraft.replace(/\s+/g, " ").slice(0, 54);
      return {
        label: canvasLoading ? "壁打ち中" : "再解釈待ち",
        text: `「${firstLine}${trimmedDraft.length > 54 ? "..." : ""}」を、返答込みで1行仮説に組み直しています`,
        hint: "一言の返答でも、中央カラムがあなたの意図に合わせて研ぎ直されます。",
      };
    }
    if (trimmedDraft.length >= 12) {
      const firstLine = trimmedDraft.replace(/\s+/g, " ").slice(0, 54);
      return {
        label: canvasLoading ? "AI圧縮中" : "ドラフト要約",
        text: `「${firstLine}${trimmedDraft.length > 54 ? "..." : ""}」を1行仮説に変換しています`,
        hint: "入力直後から、中央カラムが具体化されるように待機表示を出します。",
      };
    }
    return {
      label: "入力待ち",
      text: "左で事業の種を書き始めると、ここに1行の仮説がリアルタイム表示されます。",
      hint: "例: 創業者の孤独に寄り添い、AIでメンタルヘルスをケアするアプリ",
    };
  }, [canvasLoading, canvasSummary, hasRefinementAnswer, trimmedDraft]);
  const previewCandidates = useMemo(() => {
    const baseTitle =
      canvasPreviewTitle ||
      (trimmedDraft.length > 0 ? `${trimmedDraft.replace(/\s+/g, " ").slice(0, 28)}${trimmedDraft.length > 28 ? "..." : ""}` : "ここに仮説のタイトル断片が出ます");
    const templateLabel = activeTemplate?.label ?? STRATEGY_TEMPLATES[0].label;
    const goalLabel = GOAL_LABELS[activeTemplate?.strategyGoal ?? strategyGoal];

    return [
      {
        focus: `${goalLabel}入口`,
        title: baseTitle,
        note: `${templateLabel}で最初の共感を取る案`,
      },
      {
        focus: "論点の切り出し",
        title: `${baseTitle}${baseTitle ? " を" : ""}どう市場にぶつけるか`,
        note: "単発検証として筋の良さを見せる案",
      },
      {
        focus: "検証の呼びかけ",
        title: `${baseTitle}${baseTitle ? " を試したい人へ" : " 一緒に試す人へ"}`,
        note: "反応や参加を取りにいく案",
      },
    ];
  }, [activeTemplate?.label, activeTemplate?.strategyGoal, canvasPreviewTitle, strategyGoal, trimmedDraft]);
  const selectedPreview = previewCandidates[selectedPreviewIndex] ?? previewCandidates[0];
  const seriesRoadmap = buildSeriesRoadmap(activeTemplate?.label ?? currentGoalLabel, EMOTION_LABELS[emotion]);
  const activeStrategyDetail = activeTemplate ?? null;
  const activeStrategyInsight = activeStrategyDetail
    ? archiveRecommendation?.summary ?? activeStrategyDetail.summary
    : null;
  const sprintTimelinePhases = useMemo(
    () =>
      seriesRoadmap.map((phase, index) => {
        const slot = SERIES_SLOT_CONFIG[index];
        const generated = seriesItems[index];

        return {
          ...phase,
          slot,
          body: generated?.body ?? phase.detail,
          validationMetric: generated?.validationMetric ?? null,
          hashtags: generated?.hashtags ?? [],
          style: SPRINT_PHASE_STYLES[index] ?? SPRINT_PHASE_STYLES[0],
        };
      }),
    [seriesItems, seriesRoadmap],
  );
  const sprintFlowDays = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const day = index + 1;
        const phaseIndex = day <= 10 ? 0 : day <= 20 ? 1 : 2;
        const positionInPhase = phaseIndex === 0 ? day : phaseIndex === 1 ? day - 10 : day - 20;
        const height =
          phaseIndex === 0
            ? 24 + positionInPhase * 3
            : phaseIndex === 1
              ? 56 - Math.abs(5.5 - positionInPhase) * 3
              : 34 + positionInPhase * 4;

        return {
          day,
          phaseIndex,
          height,
          style: SPRINT_PHASE_STYLES[phaseIndex] ?? SPRINT_PHASE_STYLES[0],
        };
      }),
    [],
  );
  const deployTitle =
    generationMode === "series"
      ? seriesTitle || canvasSummary || "現在の仮説で検証スプリントを設計する"
      : selectedPreview?.title || "現在の仮説で検証を開始する";
  const deployHint =
    generationMode === "series"
      ? "30日間の流れと各フェーズの検証ポイントをまとめて生成します。"
      : selectedPreview?.focus
        ? `優先する切り口: ${selectedPreview.focus}`
        : "見出しの断片を選ぶと、ここに反映されます。";
  const dnaAdjustmentCopy = useMemo(() => {
    const strongerLabel =
      emotion === "toxic"
        ? "らしさを鋭く前に出す"
        : emotion === "useful"
          ? "らしさをもう少し論理的に"
          : "らしさをもう少し前に出す";
    const softerLabel =
      emotion === "toxic"
        ? "らしさを少し穏やかにする"
        : emotion === "useful"
          ? "らしさに余白を残す"
          : "らしさを少しやわらげる";
    const intensityLabel = intensity >= 76 ? "輪郭強め" : intensity >= 48 ? "標準" : "余白あり";

    return {
      strongerLabel,
      softerLabel,
      intensityLabel,
    };
  }, [emotion, intensity]);
  const applyTonePreset = useCallback((nextEmotion: EmotionTone, nextIntensity?: number) => {
    setEmotion(nextEmotion);
    if (typeof nextIntensity === "number") {
      setIntensity(nextIntensity);
    }
  }, []);

  useEffect(() => {
    if (hasAppliedInitialOverridesRef.current) return;

    const fromSession = readAndClearReuseSession();
    if (fromSession) {
      hasAppliedInitialOverridesRef.current = true;
      setDraft(fromSession.draft);
      applyTonePreset(fromSession.emotion, fromSession.intensity);
      setStrategyGoal(inferGoalFromEmotion(fromSession.emotion));
      router.replace("/home", { scroll: false });
      return;
    }
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qEmotion = parseEmotionFromQuery(sp.get("emotion"));
    const qIntensity = sp.get("intensity");
    const qDraft = sp.get("draft");
    let changed = false;
    if (qEmotion) {
      applyTonePreset(qEmotion);
      setStrategyGoal(inferGoalFromEmotion(qEmotion));
      changed = true;
    }
    if (qIntensity != null && qIntensity !== "") {
      const n = Number.parseInt(qIntensity, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) {
        setIntensity(n);
        changed = true;
      }
    }
    if (qDraft != null && qDraft !== "") {
      try {
        setDraft(decodeURIComponent(qDraft));
        changed = true;
      } catch {
        /* ignore */
      }
    }
    if (changed) {
      hasAppliedInitialOverridesRef.current = true;
      router.replace("/home", { scroll: false });
      return;
    }

    void ensureDemoWorkspace()
      .then(() => fetchUserProfile())
      .then((profile) => {
        applyTonePreset(profile.defaultEmotion);
        setStrategyGoal(inferGoalFromEmotion(profile.defaultEmotion));
      })
      .catch(() => undefined);
  }, [applyTonePreset, router]);

  useEffect(() => {
    let active = true;

    void ensureDemoWorkspace()
      .then(() => Promise.all([fetchGhostSettings(), fetchArchiveInsights()]))
      .then(([ghost, insights]) => {
        if (!active) return;
        setPersonaKeywords(ghost.personaKeywords);
        setPersonaSummary(ghost.personaSummary);
        setPersonaStatus(ghost.personaStatus);
        setArchiveRecommendation({
          summary: insights.bestPatternSummary,
          emotion: insights.recommendedEmotion,
          intensity: insights.recommendedIntensity,
        });
      })
      .catch(() => {
        if (!active) return;
        setArchiveRecommendation(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!deferredTrimmedDraft) {
      lastAnalyzedCanvasKeyRef.current = "";
      setCanvasSummary("");
      setCanvasPreviewTitle("");
      setCanvasQuestion("");
      setCanvasDnaAlignment(null);
      setCanvasDnaReason("");
      setCanvasWarning(null);
      return;
    }

    if (deferredTrimmedDraft.length < 24 && deferredRefinementAnswer.trim().length === 0) {
      return;
    }

    if (lastAnalyzedCanvasKeyRef.current === deferredCanvasKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const requestId = canvasRequestIdRef.current + 1;
      canvasRequestIdRef.current = requestId;
      setCanvasLoading(true);
      void analyzeHypothesisCanvas({
        draft: deferredDraft,
        refinementAnswer: deferredRefinementAnswer,
        generationMode,
        emotion: LIGHTWEIGHT_PREVIEW_TONE,
        intensity: LIGHTWEIGHT_PREVIEW_INTENSITY,
        personaKeywords,
        personaSummary,
        strategyLabel: "",
      })
        .then((canvas) => {
          if (canvasRequestIdRef.current !== requestId) return;
          lastAnalyzedCanvasKeyRef.current = deferredCanvasKey;
          setCanvasSummary(canvas.summary);
          setCanvasPreviewTitle(canvas.previewTitle);
          setCanvasQuestion(canvas.question);
          setCanvasDnaAlignment(canvas.dnaAlignment);
          setCanvasDnaReason(canvas.dnaReason);
          setCanvasWarning(canvas.warning ?? null);
        })
        .catch(() => {
          if (canvasRequestIdRef.current !== requestId) return;
          lastAnalyzedCanvasKeyRef.current = deferredCanvasKey;
          setCanvasSummary("");
          setCanvasPreviewTitle("");
          setCanvasQuestion("");
          setCanvasDnaAlignment(null);
          setCanvasDnaReason("");
          setCanvasWarning(null);
        })
        .finally(() => {
          if (canvasRequestIdRef.current !== requestId) return;
          setCanvasLoading(false);
        });
    }, canvasAnalysisDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    deferredCanvasKey,
    deferredDraft,
    deferredRefinementAnswer,
    deferredTrimmedDraft,
    generationMode,
    canvasAnalysisDelayMs,
    personaKeywords,
    personaSummary,
  ]);

  const handleUploadAudio = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("audio", file);
    try {
      const response = await fetch("/api/transcribe", { method: "POST", body: formData });
      const data: { text?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "文字起こしエラー");
      const transcriptText = data.text ?? "";
      if (transcriptText) {
        setDraft((prev) => (prev ? `${prev}\n${transcriptText}` : transcriptText));
      }
    } finally {
      setUploading(false);
    }
  };

  const runGenerate = useCallback(async (options?: { modeOverride?: "single" | "series"; intensityOverride?: number }) => {
    const requestedMode = options?.modeOverride ?? generationMode;
    const requestedIntensity = options?.intensityOverride ?? intensity;
    const requestedSpeedMode = requestedMode === "series" ? "pro" : "flash";
    if (!storedSeed.trim()) return;
    if (canvasQuestion && !hasRefinementAnswer) {
      setError("生成前に、AIからの逆質問に1つだけ答えてください。");
      return;
    }
    setError(null);
    setLoading(true);
    setVariants([]);
    setVariantFocuses([]);
    setHashtags([]);
    setSeriesTitle("");
    setSeriesItems([]);
    setAdviceHint(null);
    setGhostWhisper(null);
    setMemoryTags([]);
    setResultMode(requestedMode);
    setSelectedIndex(null);
    setCurrentId(null);
    playSwitchClick();

    try {
      await ensureDemoWorkspace();
      const [ghost, credit] = await Promise.all([fetchGhostSettings(), fetchCreditSummary()]);
      if (credit.remaining <= 0) {
        throw new Error("クレジットが残っていません。");
      }

      const data = await generateTriple({
        draft: storedSeed,
        generationMode: requestedMode,
        strategyGoal,
        emotion,
        speedMode: requestedSpeedMode,
        intensity: requestedIntensity,
        ngWords: ghost.ngWords,
        stylePrompt: ghost.stylePrompt.trim(),
        personaKeywords,
        personaSummary,
        whyMe: [
          refinementAnswer.trim(),
          requestedMode === "series" ? "検証スプリントとして30日間の流れも設計したい" : null,
          requestedMode === "single" && selectedPreview?.focus ? `優先したい切り口: ${selectedPreview.focus}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });

      if ("seriesTitle" in data) {
        const seriesData = data as SeriesResult;
        setSeriesTitle(seriesData.seriesTitle);
        setSeriesItems(seriesData.items);
        setAdviceHint(seriesData.adviceHint ?? null);
        setGhostWhisper(seriesData.ghostWhisper ?? null);
        setMemoryTags(seriesData.memoryTags ?? []);

        await saveGenerationRecord({
          generationMode: "series",
          title: seriesData.seriesTitle,
          draft: storedSeed,
          emotion,
          intensity: requestedIntensity,
          speedMode: requestedSpeedMode,
          adviceHint: seriesData.adviceHint ?? null,
          ghostWhisper: seriesData.ghostWhisper ?? null,
          quickFeedback: null,
          memoryTags: seriesData.memoryTags ?? [],
          items: seriesData.items.map((item) => ({
            slotKey: item.slotKey,
            slotLabel: item.slotLabel,
            body: item.body,
            hashtags: item.hashtags,
          })),
        });
      } else {
        const singleData = data as SingleResult;
        setVariants(singleData.variants);
        setVariantFocuses(singleData.variantFocuses ?? []);
        setHashtags(singleData.hashtags);
        setAdviceHint(singleData.adviceHint ?? null);
        setGhostWhisper(singleData.ghostWhisper ?? null);
        setMemoryTags(singleData.memoryTags ?? []);

        const row = await saveGenerationRecord({
          generationMode: "single",
          draft: storedSeed,
          emotion,
          intensity: requestedIntensity,
          speedMode: requestedSpeedMode,
          variants: singleData.variants,
          hashtags: singleData.hashtags,
          selectedIndex: null,
          likes: null,
          memo: null,
          adviceHint: singleData.adviceHint ?? null,
          quickFeedback: null,
          memoryTags: singleData.memoryTags ?? [],
        });

        if (row.generationMode === "single") {
          setCurrentId(row.id);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, [
    canvasQuestion,
    emotion,
    generationMode,
    intensity,
    personaKeywords,
    personaSummary,
    hasRefinementAnswer,
    refinementAnswer,
    selectedPreview?.focus,
    storedSeed,
    strategyGoal,
  ]);

  const selectVariant = (index: number) => {
    setSelectedIndex(index);
    if (currentId) {
      void patchGenerationRecord(currentId, { selectedIndex: index }).catch(() => undefined);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const copySeriesBundle = async () => {
    const bundle = seriesItems
      .map((item, index) => {
        const slot = SERIES_SLOT_CONFIG[index];
        const hashtagsLine = item.hashtags.length > 0 ? `\n観測タグ: ${item.hashtags.join(" / ")}` : "";
        return slot ? `${slot.day}: ${slot.title}（${slot.subtitle}）\n${item.body}${hashtagsLine}` : item.body;
      })
      .join("\n\n");
    await copyText(bundle);
  };

  const applyStrategyTemplate = (templateId: StrategyTemplateId) => {
    const template = STRATEGY_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setActiveTemplateId(template.id);
    setStrategyGoal(template.strategyGoal);
    applyTonePreset(template.emotion, template.intensity);
    playSwitchClick();
  };

  const nudgeIntensity = async (direction: "stronger" | "softer") => {
    const nextIntensity = Math.min(100, Math.max(0, intensity + (direction === "stronger" ? 12 : -12)));
    if (nextIntensity === intensity) return;
    setIntensity(nextIntensity);
  };

  useEffect(() => {
    setSelectedPreviewIndex(0);
  }, [canvasPreviewTitle, generationMode, activeTemplateId]);

  const sidePanelClass =
    "h-full min-h-0 overflow-y-auto rounded-[30px] border border-white/65 bg-white/92 p-4 pb-24 shadow-[0_22px_80px_-42px_rgba(15,23,42,0.55)] backdrop-blur-xl [scrollbar-gutter:stable] dark:border-white/10 dark:bg-background/72";
  const outputPanelClass =
    "flex h-full min-h-0 flex-col overflow-y-auto rounded-[30px] border border-white/65 bg-white/92 p-4 pb-6 shadow-[0_22px_80px_-42px_rgba(15,23,42,0.55)] backdrop-blur-xl [scrollbar-gutter:stable] dark:border-white/10 dark:bg-background/72";
  const laneDividerClass = "border-t border-border/40 pt-4";

  return (
    <div
      className={cn(
        "relative min-h-[calc(100vh-4rem)] overflow-hidden transition-[background] duration-700 ease-out",
        chameleon.shell,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 transition-all duration-500 ease-out"
          style={{
            background: `radial-gradient(circle at 50% 0%, rgba(${energyGlow}, ${0.1 + energyLevel * 0.18}) 0%, rgba(${energyGlow}, 0) 60%)`,
            filter: `saturate(${1 + energyLevel * 0.9}) brightness(${1 + energyLevel * 0.08})`,
            opacity: 0.72 + energyLevel * 0.28,
          }}
        />
        <div
          className="absolute left-1/2 top-24 h-72 w-72 rounded-full blur-3xl transition-all duration-500 ease-out"
          style={{
            backgroundColor: `rgba(${energyGlow}, ${0.08 + energyLevel * 0.14})`,
            transform: `translateX(-50%) scale(${0.92 + energyLevel * 0.36})`,
          }}
        />
        <div
          className="absolute inset-0 opacity-40 transition-opacity duration-500"
          style={
            generationMode === "single"
              ? {
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                  maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 75%)",
                }
              : {
                  backgroundImage:
                    "radial-gradient(rgba(255,255,255,0.18) 1.2px, transparent 1.2px), linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0))",
                  backgroundSize: "22px 22px, 100% 2px",
                  backgroundPosition: "0 0, 0 18%",
                  maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 78%)",
                }
          }
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 pb-4 pt-5 md:px-6 md:pt-8 xl:px-8 2xl:px-10 lg:h-[calc(100vh-4rem)]">
        <div className="flex flex-1 min-h-0 flex-col gap-4">
          <div className="hidden lg:grid lg:gap-5 lg:grid-cols-[minmax(280px,1fr)_minmax(440px,1.65fr)_minmax(320px,1.2fr)] xl:gap-6 xl:grid-cols-[minmax(300px,1fr)_minmax(520px,1.65fr)_minmax(340px,1.2fr)] 2xl:grid-cols-[minmax(320px,1fr)_minmax(580px,1.65fr)_minmax(360px,1.2fr)]">
            <div className="flex items-end justify-between gap-3 border-b border-white/25 px-1 pb-1.5 dark:border-white/8">
              <div>
                <p className="text-[10px] font-medium tracking-[0.28em] text-muted-foreground/70">INPUT</p>
                <p className="mt-0.5 text-xs text-muted-foreground/75">アイデア</p>
              </div>
              <Badge variant="secondary" className="h-4 rounded-full bg-background/40 px-1.5 text-[10px] text-muted-foreground/80 shadow-none">
                入力 {inputCompletionCount}/2
              </Badge>
            </div>
            <div className="flex items-end justify-between gap-3 border-b border-white/25 px-1 pb-1.5 dark:border-white/8">
              <div>
                <p className="text-[10px] font-medium tracking-[0.28em] text-muted-foreground/70">PROCESS</p>
                <p className="mt-0.5 text-xs text-muted-foreground/75">{generationMode === "series" ? "検証スプリント設計" : "戦略とチューニング"}</p>
              </div>
              {generationMode === "series" ? (
                <Badge variant="secondary" className="h-4 rounded-full bg-background/40 px-1.5 text-[10px] text-muted-foreground/80 shadow-none">
                  検証スプリント
                </Badge>
              ) : activeTemplate ? (
                <Badge variant="secondary" className="h-4 rounded-full bg-background/40 px-1.5 text-[10px] text-muted-foreground/80 shadow-none">
                  {activeTemplate.label}
                </Badge>
              ) : null}
            </div>
            <div className="flex items-end justify-between gap-3 border-b border-white/25 px-1 pb-1.5 dark:border-white/8">
              <div>
                <p className="text-[10px] font-medium tracking-[0.28em] text-muted-foreground/70">OUTPUT</p>
                <p className="mt-0.5 text-xs text-muted-foreground/75">{generationMode === "series" ? "30日間の流れと山谷" : "比較と次の検証"}</p>
              </div>
              <p className="text-[10px] text-muted-foreground/70">{generationMode === "series" ? "Sprint Output" : "Live Output"}</p>
            </div>
          </div>

          <div className="grid flex-1 min-h-0 gap-5 lg:h-full lg:grid-cols-[minmax(280px,1fr)_minmax(440px,1.65fr)_minmax(320px,1.2fr)] lg:items-start xl:gap-6 xl:grid-cols-[minmax(300px,1fr)_minmax(520px,1.65fr)_minmax(340px,1.2fr)] 2xl:grid-cols-[minmax(320px,1fr)_minmax(580px,1.65fr)_minmax(360px,1.2fr)]">
              <section className={sidePanelClass}>
                <div className="space-y-1 lg:hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">INPUT</p>
                    <Badge variant="secondary" className="text-xs">
                      入力 {inputCompletionCount}/2
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">アイデア</p>
                </div>

                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={CANVAS_PLACEHOLDER}
                  className="min-h-[260px] resize-y border-0 bg-background/90 text-base leading-7 shadow-sm"
                />

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border bg-background/90 px-4 py-3 text-sm shadow-sm transition-colors hover:bg-background">
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">話して入力</span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleUploadAudio(file);
                    }}
                  />
                  {uploading ? "文字起こし中…" : "音声で仮説を置く"}
                </label>

                <div className={laneDividerClass}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">DNA同期</p>
                      <p className="mt-1 text-sm font-medium">
                        {canvasDnaAlignment != null ? `あなたのDNAとの一致率 ${canvasDnaAlignment}%` : "入力するとDNA同期を解析します"}
                      </p>
                    </div>
                    {canvasDnaAlignment != null ? (
                      <Badge className={cn("rounded-full", canvasDnaAlignment >= 70 ? "bg-emerald-600 text-white" : canvasDnaAlignment >= 45 ? "bg-amber-500 text-white" : "bg-rose-600 text-white")}>
                        {canvasDnaAlignment >= 70 ? "一致" : canvasDnaAlignment >= 45 ? "再検討" : "ズレあり"}
                      </Badge>
                    ) : null}
                  </div>
                  {canvasLoading ? (
                    <p className="mt-2 text-xs text-muted-foreground">DNAを照合中…</p>
                  ) : canvasDnaReason ? (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{canvasDnaReason}</p>
                  ) : null}
                  {canvasWarning ? (
                    <p className="mt-3 rounded-xl bg-rose-50/80 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/20 dark:text-rose-200">
                      {canvasWarning}
                    </p>
                  ) : null}
                </div>

                {canvasSummary ? (
                  <div className={laneDividerClass}>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">AI要約</p>
                    <p className="mt-2 text-sm leading-6">今回ぶつける仮説はこれですね？</p>
                    <p className="mt-2 text-base font-medium">{canvasSummary}</p>
                  </div>
                ) : null}

                {canvasQuestion ? (
                  <div className={cn(laneDividerClass, "bg-linear-to-br from-violet-50/50 via-transparent to-transparent dark:from-violet-950/10")}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">AI WALL</p>
                        <p className="mt-1 text-sm font-medium">AIとの短い壁打ち</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full">
                        {hasRefinementAnswer ? (canvasLoading ? "解釈中" : "返答あり") : "未返信"}
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex justify-start">
                        <div className="max-w-[92%] rounded-[22px] rounded-tl-md bg-violet-500/10 px-4 py-3 dark:bg-violet-500/10">
                          <p className="text-[11px] font-semibold tracking-wide text-violet-700 dark:text-violet-200">
                            AIからの逆質問
                          </p>
                          <p className="mt-2 text-sm font-medium leading-6">{canvasQuestion}</p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            この一言で、中央のパンチラインがあなたの意図に寄っていきます。
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="w-full max-w-[94%] rounded-[22px] rounded-tr-md bg-background/70 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">あなたの返答</p>
                            <span className="text-[11px] text-muted-foreground">一言でOK</span>
                          </div>
                          <Textarea
                            value={refinementAnswer}
                            onChange={(event) => setRefinementAnswer(event.target.value)}
                            placeholder="フォームに埋める感覚ではなく、AIに一言返すイメージで書いてください"
                            className="mt-3 min-h-24 resize-y border-0 bg-transparent px-0 pb-0 pt-0 shadow-none focus-visible:ring-0"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {canvasLoading && hasRefinementAnswer
                        ? "返答を受けて仮説を再解釈しています。中央カラムの1行要約がまもなく更新されます。"
                        : "ここで返した言葉が、生成前の最後のチューニングになります。"}
                    </p>
                  </div>
                ) : null}
              </section>

              <section
                className={cn(
                  "h-full min-h-0 overflow-y-auto rounded-[30px] border p-4 pb-24 shadow-[0_26px_90px_-44px_rgba(15,23,42,0.6)] backdrop-blur-xl transition-all duration-500 ease-out [scrollbar-gutter:stable]",
                  isSprintMode
                    ? "border-violet-300/70 bg-white/95 shadow-[0_24px_80px_-36px_rgba(124,58,237,0.45)] dark:border-violet-700/70 dark:bg-violet-950/30"
                    : "border-white/65 bg-white/92 dark:border-white/10 dark:bg-background/72",
                )}
              >
                <div className="space-y-1 lg:hidden">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">PROCESS</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{generationMode === "series" ? "検証スプリント設計" : "戦略とチューニング"}</p>
                    {generationMode === "series" ? (
                      <Badge variant="secondary" className="rounded-full">
                        検証スプリント
                      </Badge>
                    ) : activeTemplate ? (
                      <Badge variant="secondary" className="rounded-full">
                        {activeTemplate.label}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {isSprintMode ? (
                  <motion.div
                    key="strategy-mode-banner"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(laneDividerClass, "bg-linear-to-r from-violet-500/10 via-violet-500/5 to-transparent")}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-violet-700 dark:text-violet-200">STRATEGY MODE</p>
                        <p className="mt-1 text-sm font-medium">30日を設計する本番モードに切り替わりました</p>
                      </div>
                      <Badge className="rounded-full bg-violet-600 text-white">Professional</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      単発の比較ではなく、共感から検証募集までの流れをひとつの戦略として組み上げます。
                    </p>
                  </motion.div>
                ) : null}

                <div className={cn(laneDividerClass, hasRefinementAnswer && "text-violet-950 dark:text-violet-50")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">Hypothesis Summary</p>
                      <p className="text-sm font-medium">1行のパンチライン確認</p>
                    </div>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {summaryCardCopy.label}
                    </Badge>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={`${summaryCardCopy.label}-${summaryCardCopy.text}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="mt-3 text-sm font-medium leading-6"
                    >
                      {summaryCardCopy.text}
                    </motion.p>
                  </AnimatePresence>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{summaryCardCopy.hint}</p>
                </div>

                {canChooseSprint ? (
                  <div className={laneDividerClass}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">検証ルート</p>
                        <p className="text-sm font-medium">次の検証形式を選ぶ</p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        1行仮説の圧縮後に解放
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setGenerationMode("single")}
                        className={cn(
                          "rounded-2xl bg-muted/35 p-4 text-left transition-all hover:bg-muted/55",
                          generationMode === "single" && cn("bg-background ring-2 ring-offset-2", chameleon.ring),
                        )}
                      >
                        <p className="text-sm font-semibold">単発検証</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          いまの仮説を市場にぶつける3案を比較し、まず最初の反応を取りにいきます。
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenerationMode("series")}
                        className={cn(
                          "rounded-2xl bg-muted/35 p-4 text-left transition-all hover:bg-muted/55",
                          generationMode === "series" && "bg-background ring-2 ring-violet-200 ring-offset-2 dark:bg-violet-950/20 dark:ring-violet-900/60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">検証スプリント</p>
                          <Badge className="rounded-full bg-violet-600 text-white">30日</Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          共感、納得、検証募集へと進む30日間の流れを一気に設計します。
                        </p>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={cn(laneDividerClass, "text-muted-foreground")}>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">検証ルート</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      左カラムの入力がまとまり、1行仮説に圧縮されると、ここに検証スプリントの選択肢が現れます。
                    </p>
                  </div>
                )}

                {generationMode === "series" ? (
                  <div className={laneDividerClass}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">スプリントタイムライン</p>
                        <p className="text-sm font-medium">30日を3フェーズで進める</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">横並びのタイムライン</p>
                    </div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-3">
                      {sprintTimelinePhases.map((phase, index) => (
                        <div key={phase.rangeLabel} className="rounded-2xl bg-background/35 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">{phase.rangeLabel}</p>
                              <p className="mt-1 text-sm font-semibold">{phase.slot?.title ?? phase.focus}</p>
                            </div>
                            <Badge className={cn("rounded-full", phase.style.tone)}>{phase.focus}</Badge>
                          </div>
                          <p className="mt-3 text-sm font-medium">{phase.goal}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{phase.objective}</p>
                          <div className={cn("mt-4 rounded-xl p-3", phase.style.glow)}>
                            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">やること</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{phase.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 px-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex size-8 items-center justify-center rounded-full bg-background/70 text-muted-foreground">
                            <BookOpen className="size-4" />
                          </span>
                          <div>
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground">Archive Signal</p>
                            <p className="text-sm font-medium">スプリント全体の反応を読む</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {archiveRecommendation ? "学習済み" : "学習待ち"}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        {archiveRecommendation?.summary ?? "Archive の反応ログを使って、どこで共感を取り、どこで検証募集へ持っていくかを設計します。"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={laneDividerClass}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">Strategy Matrix</p>
                        <p className="text-sm font-medium">何について話すかを直感で選ぶ</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">3つの検証スタイル</p>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {strategyMatrixTiles.map((template) => {
                        const active = template.id === activeTemplateId;
                        const meta = STRATEGY_TILE_META[template.id];
                        const fireCount = getIntensityFireCount(template.intensity);

                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => applyStrategyTemplate(template.id)}
                            className={cn(
                              "flex min-h-[248px] flex-col rounded-3xl bg-muted/35 px-4 py-4 text-left transition-all hover:bg-muted/55",
                              active
                                ? cn("bg-background ring-2 ring-offset-2", chameleon.ring)
                                : "",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-1.5">
                                {Array.from({ length: 3 }, (_, index) => (
                                  <Flame
                                    key={`${template.id}-flame-${index}`}
                                    className={cn(
                                      "size-3.5 transition-all",
                                      index < fireCount
                                        ? "fill-orange-500/25 text-orange-600 dark:fill-orange-400/30 dark:text-orange-400 opacity-100"
                                        : "text-zinc-200/40 dark:text-zinc-800/45 opacity-70",
                                    )}
                                  />
                                ))}
                              </div>
                              <span className="inline-flex size-8 items-center justify-center rounded-full bg-background/70 text-muted-foreground">
                                {meta.icon}
                              </span>
                            </div>
                            <div className="mt-5 flex-1">
                              <p className="text-base font-semibold">{template.label}</p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">{template.summary}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 border-t border-border/40 pt-4">
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">選択中の戦略詳細</p>
                      {activeStrategyDetail ? (
                        <>
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Flame className="size-3.5 text-orange-500" />
                              ターゲットの目的: {GOAL_LABELS[activeStrategyDetail.strategyGoal]}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <BookOpen className="size-3.5 text-violet-500" />
                              推奨トーン: {EMOTION_LABELS[activeStrategyDetail.emotion]}
                            </span>
                          </div>
                          <div className="mt-3 flex items-start gap-3 rounded-2xl bg-linear-to-r from-amber-50 via-violet-50/70 to-transparent px-3 py-2 dark:from-amber-950/10 dark:via-violet-950/20">
                            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-background/70 text-muted-foreground">
                              <BookOpen className="size-4" />
                            </span>
                            <div className="min-w-0 pt-0.5">
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {activeStrategyInsight}{" "}
                                <Link href="/archive" className="text-primary underline-offset-4 hover:underline">
                                  Archiveへ
                                </Link>
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">戦略を選択してください</p>
                      )}
                    </div>
                  </div>
                )}

                {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
              </section>

              <section className={outputPanelClass}>
                <div className="space-y-1 lg:hidden">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">OUTPUT</p>
                  <p className="text-sm font-medium">{generationMode === "series" ? "30日間の流れと山谷" : "比較と次の検証"}</p>
                </div>
                <div className="space-y-4 pb-4">
                <div className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/70">LIVE TITLE</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/65">
                        生成結果は Archive に自動保存されます。反応ログとして育てる前提です。
                      </p>
                    </div>
                    <span className="rounded-full border px-2 py-1 text-[10px] text-muted-foreground/65">Auto saved</span>
                  </div>
                  <div className="mt-4 border-t border-border/40 pt-3">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={`${activeTemplateId ?? "none"}-${emotion}-${intensity}-${canvasPreviewTitle || "empty"}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="mt-2 text-sm font-medium"
                      >
                        {generationMode === "series"
                          ? seriesTitle || canvasSummary || "検証スプリントを選ぶと、ここに30日間のテーマが出ます"
                          : canvasPreviewTitle || "調整すると、ここで発信案タイトルが切り替わります"}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>

                {generationMode === "series" ? (
                  <div className={laneDividerClass}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">スプリントプレビュー</p>
                        <p className="mt-1 text-sm text-muted-foreground">30日間の大きな流れを、山と谷のあるガントチャート風に可視化します。</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full">
                        30日フロー
                      </Badge>
                    </div>
                    <div className="mt-4 bg-muted/20 p-4">
                      <div className="flex items-end gap-1 px-3 pb-3 pt-6">
                        {sprintFlowDays.map((item) => (
                          <div key={item.day} className="flex min-w-0 flex-1 items-end">
                            <motion.div
                              className={cn("w-full rounded-t-[10px] transition-all", item.style.bar)}
                              initial={{ height: 10, opacity: 0.3 }}
                              animate={{ height: item.height, opacity: 1 }}
                              transition={{ duration: 0.45, delay: item.day * 0.012, ease: "easeOut" }}
                              style={{ height: `${item.height}px` }}
                              aria-hidden="true"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground md:grid-cols-3">
                        {sprintTimelinePhases.map((phase) => (
                          <div key={phase.rangeLabel} className={cn("rounded-xl p-3", phase.style.glow)}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{phase.rangeLabel}</span>
                              <Badge className={cn("rounded-full", phase.style.tone)}>{phase.slot?.title ?? phase.focus}</Badge>
                            </div>
                            <p className="mt-2 leading-5">{phase.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={laneDividerClass}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">ライブプレビュー</p>
                        <p className="mt-1 text-sm text-muted-foreground">左で書き、中央で選ぶたびに見出しの断片が先に育ちます。</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full">
                        Title only
                      </Badge>
                    </div>
                    <div className="mt-4 divide-y divide-border/35">
                      {previewCandidates.map((candidate, index) => {
                        const active = selectedPreviewIndex === index;
                        return (
                          <button
                            key={`${candidate.focus}-${index}`}
                            type="button"
                            onClick={() => setSelectedPreviewIndex(index)}
                            className={cn(
                              "w-full rounded-2xl px-0 py-4 text-left first:pt-0 transition-all",
                              active ? cn("bg-background/88 px-3 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.28)] opacity-100", chameleon.ring) : "opacity-85",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Badge variant="outline" className="rounded-full text-[11px]">
                                {candidate.focus}
                              </Badge>
                              {active ? <Check className="size-4 text-green-600" /> : null}
                            </div>
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.p
                                key={`${candidate.title}-${emotion}-${intensity}-${generationMode}`}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.16 }}
                                className="mt-3 text-sm font-medium leading-6"
                              >
                                {candidate.title}
                              </motion.p>
                            </AnimatePresence>
                            <p className="mt-2 text-xs text-muted-foreground">{candidate.note}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <GenerationSkeleton />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {!loading &&
                ((resultMode === "single" && variants.length === 3) || (resultMode === "series" && seriesItems.length === 3)) ? (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cn(laneDividerClass, "space-y-5")}>
                    {ghostWhisper ? (
                      <div className="border-l-2 border-violet-200/70 pl-3 text-sm text-violet-950 dark:border-violet-800/60 dark:text-violet-100">
                        <p className="text-xs font-semibold uppercase tracking-wide">Persona DNA からの示唆</p>
                        <p className="mt-1 leading-relaxed">{ghostWhisper}</p>
                      </div>
                    ) : null}

                    {resultMode === "series" ? (
                      <div className="bg-muted/20 p-4">
                        <p className="text-sm font-medium text-muted-foreground">検証スプリント名</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{seriesTitle}</p>
                      </div>
                    ) : null}

                    {resultMode === "single" ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-muted-foreground">Persona DNAの微調整</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            いまの案をベースに、Persona DNA の出力温度を少しだけ寄せ直して3案を引き直します。
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full">
                            {EMOTION_LABELS[emotion]} {intensity}% / {dnaAdjustmentCopy.intensityLabel}
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loading || uploading || intensity >= 100}
                            onClick={() => {
                              void nudgeIntensity("stronger");
                            }}
                          >
                            {dnaAdjustmentCopy.strongerLabel}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loading || uploading || intensity <= 0}
                            onClick={() => {
                              void nudgeIntensity("softer");
                            }}
                          >
                            {dnaAdjustmentCopy.softerLabel}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {resultMode === "series" ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground">30日間の大きな流れ</p>
                            <p className="mt-1 text-sm font-medium">山と谷を見ながら、どこで何を検証するかを確認</p>
                          </div>
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            ガント風ビュー
                          </Badge>
                        </div>
                        <div className="bg-muted/20 p-4">
                          <div className="flex items-end gap-1 px-3 pb-3 pt-6">
                            {sprintFlowDays.map((item) => (
                              <div key={item.day} className="flex min-w-0 flex-1 items-end">
                                <motion.div
                                  className={cn("w-full rounded-t-[10px]", item.style.bar)}
                                  initial={{ height: 10, opacity: 0.3 }}
                                  animate={{ height: item.height, opacity: 1 }}
                                  transition={{ duration: 0.45, delay: item.day * 0.012, ease: "easeOut" }}
                                  style={{ height: `${item.height}px` }}
                                  aria-hidden="true"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>DAY 1</span>
                            <span>DAY 10</span>
                            <span>DAY 20</span>
                            <span>DAY 30</span>
                          </div>
                          <div className="mt-4 grid gap-3 xl:grid-cols-3">
                            {sprintTimelinePhases.map((phase, index) => {
                              const item = seriesItems[index];

                              return (
                                <div key={phase.rangeLabel} className={cn("rounded-2xl p-4", phase.style.glow)}>
                                  <div className="flex items-center justify-between gap-2">
                                    <Badge className={cn("rounded-full", phase.style.tone)}>{phase.slot?.title ?? phase.focus}</Badge>
                                    <span className="text-[11px] font-semibold text-muted-foreground">{phase.rangeLabel}</span>
                                  </div>
                                  <p className="mt-3 text-sm font-medium">{phase.goal}</p>
                                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item?.body ?? phase.detail}</p>
                                  {item?.validationMetric ? (
                                    <div className="mt-3 border-l-2 border-dashed border-border/50 pl-3">
                                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">成功指標</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{item.validationMetric}</p>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/35">
                        {variants.map((text, index) => {
                          const picked = selectedIndex === index;
                          const variantFocus = variantFocuses[index] ?? `仮説の切り口 ${index + 1}`;
                          const label = `仮説案 ${index + 1}`;

                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => selectVariant(index)}
                              className={cn(
                              "w-full rounded-2xl px-0 py-5 text-left first:pt-0 transition-all",
                              picked
                                ? cn("bg-background/92 px-3 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.26)] opacity-100", chameleon.ring)
                                : "opacity-88",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <Badge variant="outline">{label}</Badge>
                                {picked ? <Check className="size-4 text-green-600" /> : null}
                              </div>
                              <p className="mt-3 inline-flex rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
                                【{variantFocus}】重視
                              </p>
                              <p className="mt-3 text-sm leading-7 text-foreground">{text}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {adviceHint ? (
                      <div className="border-l-2 border-dashed border-border/50 pl-3 text-xs text-muted-foreground">
                        観測ポイント: {adviceHint}
                      </div>
                    ) : null}

                    {resultMode === "single" && hashtags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {hashtags.map((tag) => (
                          <Badge key={tag} variant="outline" className="rounded-full text-[11px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    {memoryTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {memoryTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="rounded-full">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Link href="/archive">
                        <Button type="button">反応ログを見る</Button>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (resultMode === "series") {
                            void copySeriesBundle();
                            return;
                          }
                          void copyText(variants.join("\n\n"));
                        }}
                        className="text-xs text-muted-foreground"
                      >
                        テキストを控える
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className={cn(laneDividerClass, "space-y-3")}>
                    <div className="border-l-2 border-dashed border-border/50 pl-3">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">本文はまだ確定していません</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        今は右上のタイトル断片だけがリアルタイムで育っています。気になる案が見つかったら、下のバーから検証を開始してください。
                      </p>
                    </div>
                    <div className="border-l-2 border-dashed border-border/50 pl-3">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">比較の視点</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        先に見出しの切れ味を見つけてから、本文を重く生成する流れに変えています。
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-auto border-t border-border/40 pt-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/70">DEPLOY</p>
                      <p className="mt-1 truncate text-sm font-medium">{deployTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{deployHint}</p>
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      disabled={!storedSeed.trim() || uploading || loading || (canvasQuestion !== "" && !hasRefinementAnswer)}
                      onClick={() => {
                        void runGenerate({ modeOverride: generationMode });
                      }}
                      className="min-w-[220px]"
                    >
                      {loading ? "本文を組み立て中…" : generationMode === "series" ? "現在の仮説で検証スプリントを設計する" : "現在の仮説で検証を開始する"}
                    </Button>
                  </div>
                </div>
                </div>
              </section>
          </div>
        </div>
      </div>
    </div>
  );
}
