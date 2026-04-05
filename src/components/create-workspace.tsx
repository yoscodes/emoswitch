"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, ChevronDown, Copy, Fingerprint, Heart, Lightbulb, Palette, Sparkles, Swords } from "lucide-react";

import { EmotionDial } from "@/components/emotion-dial";
import { GenerationSkeleton } from "@/components/generation-skeleton";
import { PhysicalGenerateLever } from "@/components/physical-generate-lever";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ensureDemoWorkspace,
  fetchArchiveOverview,
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

const toneOptions = [
  { id: "empathy" as const, icon: <Heart className="size-5" /> },
  { id: "toxic" as const, icon: <Swords className="size-5" /> },
  { id: "mood" as const, icon: <Palette className="size-5" /> },
  { id: "useful" as const, icon: <BookOpen className="size-5" /> },
  { id: "minimal" as const, icon: <Sparkles className="size-5" /> },
];

const SEED_QUESTIONS = [
  "誰の、どんな見過ごされた痛みを解きたい？",
  "その課題に怒りや違和感を覚える理由は？",
  "なぜ今の自分がこのテーマをやる価値がある？",
];

const SEED_TEMPLATES = [
  {
    label: "原体験から始める",
    template:
      "自分が何度も困ったのは「〇〇」。この痛みはまだ十分に言語化されていない。まずはこの違和感を市場にぶつけたい。",
  },
  {
    label: "顧客観察から始める",
    template:
      "最近よく見るのは「〇〇」で困っている人。彼らは既存の解決策に納得していない。このズレから事業の種を探したい。",
  },
  {
    label: "思想から始める",
    template:
      "自分が信じているのは「〇〇」。この価値観に沿ったプロダクトや支援の形を、発信を通して市場に問いかけたい。",
  },
  {
    label: "検証案から始める",
    template:
      "まず試したい仮説は「〇〇」。完璧なプロダクトではなく、今の時点で反応を取りにいくための見せ方を整理したい。",
  },
];

const INTENSITY_BANDS = [
  {
    id: "whisper",
    label: "観察",
    description: "静かに仮説を置き、反応を観察する温度。",
    anchor: 10,
  },
  {
    id: "conversation",
    label: "対話",
    description: "読者と一緒に問いを深める標準温度。",
    anchor: 50,
  },
  {
    id: "declaration",
    label: "宣言",
    description: "思想や勝負仮説を強く打ち出す温度。",
    anchor: 90,
  },
] as const;

const ENERGY_RGB_BY_EMOTION: Record<EmotionTone, string> = {
  empathy: "236, 72, 153",
  toxic: "220, 38, 38",
  mood: "124, 58, 237",
  useful: "8, 145, 178",
  minimal: "82, 82, 91",
};

type StrategyGoal = "awareness" | "education" | "engagement";
type StrategyTemplateId = "ai-recommend" | "pain-signal" | "authority-proof" | "validation" | "movement";

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
  featured?: boolean;
}> = [
  {
    id: "pain-signal",
    label: "課題突破",
    summary: "見過ごされた痛みを強く言語化して共感を集める",
    emotion: "toxic",
    intensity: 90,
    strategyGoal: "awareness",
  },
  {
    id: "authority-proof",
    label: "なぜ自分か",
    summary: "知見・経験・実例で納得感をつくる",
    emotion: "useful",
    intensity: 55,
    strategyGoal: "education",
  },
  {
    id: "validation",
    label: "仮説検証",
    summary: "問いかけと募集で市場の反応を取りにいく",
    emotion: "empathy",
    intensity: 50,
    strategyGoal: "engagement",
  },
  {
    id: "movement",
    label: "ビジョン提示",
    summary: "思想や未来像を語って共鳴する人を引き寄せる",
    emotion: "mood",
    intensity: 45,
    strategyGoal: "engagement",
  },
];

function aiRecommendationTemplatePlaceholder(
  loading: boolean,
  template: {
    id: StrategyTemplateId;
    label: string;
    summary: string;
    emotion: EmotionTone;
    intensity: number;
    strategyGoal: StrategyGoal;
    featured?: boolean;
  } | null,
) {
  if (template) return template;

  return {
    id: "ai-recommend" as const,
    label: loading ? "AI学習中" : "AI推奨待ち",
    summary: loading ? "Archive から黄金律を解析しています" : "反応ログが溜まると、ここに黄金律が表示されます",
    emotion: "useful" as const,
    intensity: 50,
    strategyGoal: "education" as const,
    featured: true,
  };
}

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

function getIntensityBand(intensity: number) {
  return INTENSITY_BANDS.reduce((closest, band) =>
    Math.abs(intensity - band.anchor) < Math.abs(intensity - closest.anchor) ? band : closest,
  );
}

function clampEnergy(value: number) {
  return Math.min(Math.max(value, 0), 1);
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
    params.whyMe.trim() ? `なぜ自分がやる意味があるか:\n${params.whyMe.trim()}` : null,
    params.firstExperiment.trim() ? `まず何を試すか:\n${params.firstExperiment.trim()}` : null,
  ].filter(Boolean);

  return sections.join("\n\n");
}

type SingleResult = GenerateSingleResponse;
type SeriesResult = GenerateSeriesResponse;

export function CreateWorkspace() {
  const router = useRouter();
  const hasAppliedInitialOverridesRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [audience, setAudience] = useState("");
  const [pain, setPain] = useState("");
  const [whyMe, setWhyMe] = useState("");
  const [firstExperiment, setFirstExperiment] = useState("");
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
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [archiveRecommendation, setArchiveRecommendation] = useState<ArchiveRecommendation | null>(null);
  const [archiveRecommendationLoading, setArchiveRecommendationLoading] = useState(true);
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [helperFieldsOpen, setHelperFieldsOpen] = useState(false);
  const [personaBadgeOpen, setPersonaBadgeOpen] = useState(false);
  const [personaKeywords, setPersonaKeywords] = useState<string[]>([]);
  const [personaSummary, setPersonaSummary] = useState("");
  const [personaStatus, setPersonaStatus] = useState<"empty" | "draft" | "approved">("empty");
  const [activeTemplateId, setActiveTemplateId] = useState<StrategyTemplateId | null>(null);

  const chameleon = CHAMELEON[emotion];
  const energyLevel = clampEnergy(intensity / 100);
  const intensityBand = getIntensityBand(intensity);
  const energyGlow = ENERGY_RGB_BY_EMOTION[emotion];
  const speedMode = generationMode === "series" ? "pro" : "flash";
  const currentGoalLabel = GOAL_LABELS[strategyGoal];
  const storedSeed = useMemo(
    () => buildOpportunitySeed({ draft, audience, pain, whyMe, firstExperiment }),
    [audience, draft, firstExperiment, pain, whyMe],
  );
  const hasStartedSeed = draft.trim().length > 0;
  const hasHelperInput = [audience, pain, whyMe, firstExperiment].some((item) => item.trim().length > 0);
  const inputCompletionCount = [draft, audience, pain, whyMe, firstExperiment].filter((item) => item.trim()).length;
  const helperCompletedCount = [audience, pain, whyMe, firstExperiment].filter((item) => item.trim()).length;
  const helperCompleted = helperCompletedCount === 4;
  const templateCards = archiveRecommendation?.emotion != null && archiveRecommendation.intensity != null
    ? [
        {
          id: "ai-recommend" as const,
          label: "AI推奨",
          summary: archiveRecommendation.summary,
          emotion: archiveRecommendation.emotion,
          intensity: archiveRecommendation.intensity,
          strategyGoal: inferGoalFromEmotion(archiveRecommendation.emotion),
          featured: true,
        },
        ...STRATEGY_TEMPLATES,
      ]
    : STRATEGY_TEMPLATES;
  const strategyTiles = [
    aiRecommendationTemplatePlaceholder(archiveRecommendationLoading, templateCards.find((template) => template.featured) ?? null),
    ...STRATEGY_TEMPLATES,
  ];
  const aiRecommendationTemplate = templateCards.find((template) => template.featured) ?? null;
  const activeTemplate = templateCards.find((template) => template.id === activeTemplateId) ?? null;
  const seriesRoadmap = buildSeriesRoadmap(activeTemplate?.label ?? currentGoalLabel, EMOTION_LABELS[emotion]);
  const leverTitle = loading ? "生成中…" : generationMode === "series" ? "30日ロードマップを生成" : "市場テスト案を生成";
  const leverSubtitle =
    generationMode === "series"
      ? `${activeTemplate?.label ?? "現在の戦略"}で、30日物語を3フェーズに分けて設計します`
      : `${activeTemplate?.label ?? "現在の戦略"}で、発信案3本と観測ポイントをまとめて出します`;

  useEffect(() => {
    if (hasAppliedInitialOverridesRef.current) return;

    const fromSession = readAndClearReuseSession();
    if (fromSession) {
      hasAppliedInitialOverridesRef.current = true;
      setDraft(fromSession.draft);
      setEmotion(fromSession.emotion);
      setIntensity(fromSession.intensity);
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
      setEmotion(qEmotion);
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
        setEmotion(profile.defaultEmotion);
        setStrategyGoal(inferGoalFromEmotion(profile.defaultEmotion));
      })
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    void ensureDemoWorkspace();
  }, []);

  useEffect(() => {
    void ensureDemoWorkspace()
      .then(() => fetchGhostSettings())
      .then((ghost) => {
        setPersonaKeywords(ghost.personaKeywords);
        setPersonaSummary(ghost.personaSummary);
        setPersonaStatus(ghost.personaStatus);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    setArchiveRecommendationLoading(true);

    void fetchArchiveOverview()
      .then((overview) => {
        if (!active) return;
        setArchiveRecommendation({
          summary: overview.insights.bestPatternSummary,
          emotion: overview.insights.recommendedEmotion,
          intensity: overview.insights.recommendedIntensity,
        });
      })
      .catch(() => {
        if (!active) return;
        setArchiveRecommendation(null);
      })
      .finally(() => {
        if (!active) return;
        setArchiveRecommendationLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hasStartedSeed || hasHelperInput) {
      setHelperFieldsOpen(true);
    }
  }, [hasHelperInput, hasStartedSeed]);

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

  const runGenerate = useCallback(async () => {
    if (!storedSeed.trim()) return;
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
    setResultMode(generationMode);
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
        generationMode,
        strategyGoal,
        emotion,
        speedMode,
        intensity,
        ngWords: ghost.ngWords,
        stylePrompt: ghost.stylePrompt.trim(),
        personaKeywords,
        personaSummary,
        audience,
        pain,
        whyMe,
        firstExperiment,
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
          intensity,
          speedMode,
          adviceHint: seriesData.adviceHint ?? null,
          ghostWhisper: seriesData.ghostWhisper ?? null,
          quickFeedback: null,
          memoryTags: seriesData.memoryTags ?? [],
          items: seriesData.items,
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
          intensity,
          speedMode,
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
    audience,
    emotion,
    firstExperiment,
    generationMode,
    intensity,
    pain,
    personaKeywords,
    personaSummary,
    speedMode,
    storedSeed,
    strategyGoal,
    whyMe,
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

  const appendToDraft = (text: string) => {
    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
    setInspirationOpen(false);
  };

  const applyStrategyTemplate = (templateId: StrategyTemplateId) => {
    const template = templateCards.find((item) => item.id === templateId);
    if (!template) return;
    setActiveTemplateId(template.id);
    setStrategyGoal(template.strategyGoal);
    setEmotion(template.emotion);
    setIntensity(template.intensity);
    playSwitchClick();
  };

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

      <div className="relative mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 pb-28 md:px-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground">Seed Workspace</p>
              <Badge variant="outline" className="rounded-full bg-background/70">
                {generationMode === "single" ? "Labモード" : "Projectモード"}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">思想に合う事業の種を、市場に届く仮説へ</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              まずは完璧な事業計画ではなく、違和感・原体験・試したい仮説を置いてください。AI が発信案と検証ロードマップに変換します。
            </p>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setPersonaBadgeOpen((open) => !open)}
              className="flex items-center gap-2 rounded-2xl border bg-background/75 px-3 py-2 text-left shadow-sm backdrop-blur"
              aria-expanded={personaBadgeOpen}
            >
              <Fingerprint className="size-4 text-primary" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium">ペルソナDNA</p>
                <p className="text-[11px] text-muted-foreground">
                  {personaStatus === "approved" ? "承認済み" : personaStatus === "draft" ? "確認待ち" : "未設定"}
                </p>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {personaBadgeOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">承認済みペルソナ</p>
                      <Link href="/persona" className="text-xs text-primary underline-offset-4 hover:underline">
                        更新
                      </Link>
                    </div>
                    {personaSummary ? (
                      <p className="text-xs leading-5 text-muted-foreground">{personaSummary}</p>
                    ) : (
                      <p className="text-xs leading-5 text-muted-foreground">
                        まだ分析がありません。`/persona` で思想・強み・価値観を言語化できます。
                      </p>
                    )}
                    {personaKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {personaKeywords.map((keyword) => (
                          <Badge key={keyword} variant="secondary" className="rounded-full">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </header>

        <Card className="border-0 bg-card/80 shadow-xl backdrop-blur-md">
          <CardContent className="space-y-6 p-6">
            <div className="rounded-2xl border bg-background/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">戦い方を選ぶ</p>
                  <p className="text-xs text-muted-foreground">
                    まずは単発で切り口を試すか、30日物語として検証を設計するかを決めます。
                  </p>
                </div>
                <div className="inline-flex rounded-xl border bg-muted/30 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={generationMode === "single" ? "default" : "ghost"}
                    onClick={() => setGenerationMode("single")}
                    className="rounded-lg"
                  >
                    単発検証
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={generationMode === "series" ? "default" : "ghost"}
                    onClick={() => setGenerationMode("series")}
                    className="rounded-lg"
                  >
                    30日物語
                  </Button>
                </div>
              </div>
            </div>

            <section className="space-y-3 rounded-3xl border bg-background/55 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">PHASE 1 / INPUT</p>
                  <p className="text-sm font-medium">思想の投下</p>
                </div>
                <div className="flex items-center gap-2">
                  {helperCompleted ? (
                    <Badge className="rounded-full bg-emerald-600 text-white">DNA同期完了 👻</Badge>
                  ) : null}
                  <Badge variant="secondary" className="text-xs">
                    思考メモ音声OK
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full px-2"
                    aria-expanded={inspirationOpen}
                    onClick={() => setInspirationOpen((open) => !open)}
                  >
                    <Lightbulb className="size-3.5" />
                    <span>書き出しヒント</span>
                  </Button>
                </div>
              </div>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="いま掘りたい市場、怒りを感じる課題、作ってみたい世界観を自由に置いてください"
                className="min-h-[180px] resize-y border-0 bg-background/90 text-base shadow-sm"
              />
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>雑でも大丈夫です。原体験・違和感・仮説の断片だけでも生成できます。</span>
                <span>{inputCompletionCount}/5 項目入力</span>
              </div>

              <AnimatePresence initial={false}>
                {inspirationOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-dashed bg-background/88 p-4 shadow-sm backdrop-blur-sm">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold tracking-wide text-muted-foreground">迷ったらこの問いから</p>
                          <p className="text-xs text-muted-foreground">最初の一文だけ置けば、残りは補助入力で整えられます。</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {SEED_QUESTIONS.map((question) => (
                            <Button
                              key={question}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-auto rounded-full px-3 py-1.5 text-left whitespace-normal"
                              onClick={() => appendToDraft(`${question}\n`)}
                            >
                              {question}
                            </Button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">たたき台テンプレ</p>
                          <div className="flex flex-wrap gap-2">
                            {SEED_TEMPLATES.map((template) => (
                              <Button
                                key={template.label}
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="rounded-full"
                                onClick={() => appendToDraft(template.template)}
                              >
                                {template.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                <span className="rounded-lg border bg-muted/50 px-2 py-1">音声をアップロード</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUploadAudio(file);
                  }}
                />
                {uploading ? "文字起こし中…" : "頭の中の壁打ちをテキスト化"}
              </label>

              <AnimatePresence initial={false}>
                {hasStartedSeed || hasHelperInput ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-dashed bg-background/70 p-4">
                      <button
                        type="button"
                        onClick={() => setHelperFieldsOpen((open) => !open)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                        aria-expanded={helperFieldsOpen}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">💡 精度を上げるヒント</p>
                          <p className="text-xs text-muted-foreground">
                            まだ全部埋めなくて大丈夫です。必要なところだけ深掘りすると、仮説の精度が上がります。
                          </p>
                        </div>
                        <ChevronDown className={cn("size-4 shrink-0 transition-transform", helperFieldsOpen && "rotate-180")} />
                      </button>

                      <AnimatePresence initial={false}>
                        {helperFieldsOpen ? (
                          <motion.div
                            initial={{ opacity: 0, y: -4, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -4, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <p className="text-sm font-medium">誰の課題か</p>
                                <Input
                                  value={audience}
                                  onChange={(event) => setAudience(event.target.value)}
                                  placeholder="例: 採用広報に疲れている小規模SaaSの代表"
                                />
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">どんな痛みか</p>
                                <Input
                                  value={pain}
                                  onChange={(event) => setPain(event.target.value)}
                                  placeholder="例: 施策は打つのに、刺さっている手応えがない"
                                />
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">なぜ自分がやる意味があるか</p>
                                <Input
                                  value={whyMe}
                                  onChange={(event) => setWhyMe(event.target.value)}
                                  placeholder="例: 自分も同じ痛みを抱え、解決策を独自に試してきた"
                                />
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm font-medium">まず何を試すか</p>
                                <Input
                                  value={firstExperiment}
                                  onChange={(event) => setFirstExperiment(event.target.value)}
                                  placeholder="例: 相談募集投稿を出して、3人の壁打ちを取る"
                                />
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span>深掘りしたいところだけ埋めれば十分です。</span>
                              <span>{helperCompletedCount}/4 同期済み</span>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>

            <section className="space-y-3 rounded-3xl border bg-background/55 p-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">PHASE 2 / STRATEGY</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">戦略の選択</p>
                  {activeTemplate ? (
                    <Badge variant="secondary" className="rounded-full">
                      適用中: {activeTemplate.label}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">AI推奨か、今回ぶつけたい仮説の型を選びます</span>
                  )}
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {strategyTiles.map((template, index) => {
                  const active = template.id === activeTemplateId;
                  const isAiTile = index === 0;
                  const isDisabledAi = isAiTile && aiRecommendationTemplate == null;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      disabled={isDisabledAi}
                      onClick={() => applyStrategyTemplate(template.id)}
                      className={cn(
                        "rounded-xl border bg-background/88 px-3 py-3 text-left transition-all hover:bg-background disabled:cursor-not-allowed disabled:opacity-75",
                        isAiTile && "border-amber-300/80 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/20",
                        active && cn("border-foreground/30 bg-background shadow-sm ring-2 ring-offset-2", chameleon.ring),
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {isAiTile ? "🔥 AI推奨（あなたの黄金律）" : template.label}
                        </p>
                        <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                          {GOAL_LABELS[template.strategyGoal]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {EMOTION_LABELS[template.emotion]} / {getIntensityBand(template.intensity).label}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{template.summary}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4 rounded-3xl border bg-background/55 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">PHASE 3 / TONE</p>
                  <p className="text-sm font-medium">市場へのチューニング</p>
                  <p className="text-xs text-muted-foreground">
                    見せ方と強度をひとつの操作盤として整えます。ここを触ると、レバーの空気も変わります。
                  </p>
                </div>
                <Link href="/persona">
                  <Button type="button" variant="outline" size="sm">
                    ペルソナを更新
                  </Button>
                </Link>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl border bg-background/80 p-4">
                  <p className="mb-3 text-sm font-medium">見せ方</p>
                  <EmotionDial
                    options={toneOptions}
                    value={emotion}
                    onChange={setEmotion}
                    accentRing={chameleon.ring}
                  />
                </div>

                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="font-medium">強度</p>
                      <p className="text-xs text-muted-foreground">観察・対話・宣言のどこで市場に出すかを決めます。</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-lg font-semibold", chameleon.accentFg)}>{intensityBand.label}</p>
                      <p className="text-xs font-medium text-foreground">{intensity}%</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {INTENSITY_BANDS.map((band) => {
                      const active = band.id === intensityBand.id;
                      return (
                        <button
                          key={band.id}
                          type="button"
                          onClick={() => setIntensity(band.anchor)}
                          className={cn(
                            "rounded-xl border bg-background/80 px-4 py-3 text-left transition-all hover:bg-background",
                            active && cn("border-foreground/30 bg-background shadow-sm ring-2 ring-offset-2", chameleon.ring),
                          )}
                        >
                          <p className="text-sm font-semibold">{band.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{band.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {generationMode === "series" ? (
              <div className="rounded-2xl border bg-background/60 p-4">
                <AnimatePresence initial={false}>
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: 8 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 rounded-2xl border border-dashed bg-muted/20 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        30回投稿する作業ではなく、1ヶ月で市場から学ぶ物語として設計します。
                      </p>
                      <div className="grid gap-3 md:grid-cols-3">
                        {seriesRoadmap.map((phase) => (
                          <div key={phase.rangeLabel} className="rounded-xl border bg-background/85 p-4 text-left shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-muted-foreground">{phase.rangeLabel}</p>
                              <Badge variant="outline" className="rounded-full text-[11px]">
                                {phase.focus}
                              </Badge>
                            </div>
                            <p className="mt-3 text-xl font-bold tracking-tight">{phase.goal}</p>
                            <p className="mt-2 text-sm font-medium">{phase.objective}</p>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">{phase.detail}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {SERIES_SLOT_CONFIG.map((slot) => (
                          <div key={slot.day} className="rounded-xl border bg-background/85 p-3 text-left shadow-sm">
                            <p className="text-xs font-semibold text-muted-foreground">{slot.day}</p>
                            <p className="mt-1 text-sm font-medium">{slot.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{slot.subtitle}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : null}

            <PhysicalGenerateLever
              disabled={!storedSeed.trim() || uploading}
              loading={loading}
              onPull={runGenerate}
              accentClass={cn(chameleon.accent, "text-white")}
              energy={energyLevel}
              glowColor={energyGlow}
              title={leverTitle}
              subtitle={leverSubtitle}
            />

            {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <GenerationSkeleton />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!loading &&
            ((resultMode === "single" && variants.length === 3) || (resultMode === "series" && seriesItems.length === 3)) ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {resultMode === "series" ? "30日間の検証ロードマップ" : "市場にぶつける発信案3本"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">
                      戦略: {activeTemplate?.label ?? currentGoalLabel}
                    </Badge>
                    {resultMode === "series" ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void copySeriesBundle()}>
                        <Copy className="mr-1 size-3" />
                        ロードマップをコピー
                      </Button>
                    ) : null}
                  </div>
                </div>

                {ghostWhisper ? (
                  <div className="rounded-2xl border border-violet-200/70 bg-violet-50/70 p-3 text-sm text-violet-950 shadow-sm dark:border-violet-800/60 dark:bg-violet-950/30 dark:text-violet-100">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-violet-500/10 p-2 text-violet-600 dark:text-violet-300">
                        <Fingerprint className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700/80 dark:text-violet-300/80">
                          ペルソナからの示唆
                        </p>
                        <p className="leading-relaxed">{ghostWhisper}</p>
                      </div>
                    </div>
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

                {resultMode === "series" ? (
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-muted-foreground">30日ロードマップ名</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{seriesTitle}</p>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  {(resultMode === "series" ? seriesItems.map((item) => item.body) : variants).map((text, index) => {
                    const picked = selectedIndex === index;
                    const slot = SERIES_SLOT_CONFIG[index];
                    const variantFocus = variantFocuses[index] ?? `仮説の切り口 ${index + 1}`;
                    const label =
                      resultMode === "series" && slot
                        ? `${slot.day} | ${slot.title}（${slot.subtitle}）`
                        : `仮説案 ${index + 1}`;

                    return resultMode === "series" ? (
                      <motion.div
                        key={index}
                        layout
                        className="rounded-2xl border bg-background/90 p-4 text-left text-sm leading-relaxed shadow-sm transition-all hover:shadow-md"
                        whileHover={{ y: -2 }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge variant="outline">{label}</Badge>
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            30日フェーズ
                          </Badge>
                        </div>
                        <p className="min-h-24 text-foreground">{text}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(seriesItems[index]?.hashtags ?? []).map((tag) => (
                            <Badge key={`${label}-${tag}`} variant="outline" className="rounded-full text-[11px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-8 px-2 text-xs"
                          onClick={() => void copyText(text)}
                        >
                          <Copy className="mr-1 size-3" />
                          コピー
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.button
                        key={index}
                        type="button"
                        layout
                        onClick={() => selectVariant(index)}
                        className={cn(
                          "rounded-2xl border-2 bg-background/90 p-4 text-left text-sm leading-relaxed shadow-sm transition-all hover:shadow-md",
                          picked ? cn("ring-2 ring-offset-2", chameleon.ring) : "border-border",
                        )}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge variant="outline">{label}</Badge>
                          <div className="flex items-center gap-2">
                            {picked ? <Check className="size-4 text-green-600" /> : null}
                          </div>
                        </div>
                        <div className="mb-3">
                          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">今回ぶつける仮説</p>
                          <p className="mt-1 inline-flex rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
                            【{variantFocus}】重視
                          </p>
                        </div>
                        <p className="min-h-24 text-foreground">{text}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-8 px-2 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            void copyText(text);
                          }}
                        >
                          <Copy className="mr-1 size-3" />
                          コピー
                        </Button>
                      </motion.button>
                    );
                  })}
                </div>

                {resultMode === "single" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">検証タグ</p>
                    <div className="flex flex-wrap gap-2">
                      {hashtags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => void copyText(tag)}
                          className={cn(
                            "rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-muted",
                            chameleon.accentFg,
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {adviceHint ? (
                  <p className="rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                    観測ポイント: {adviceHint}
                  </p>
                ) : null}
              </motion.div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
