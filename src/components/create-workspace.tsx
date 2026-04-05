"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Copy, Fingerprint, Heart, Lightbulb, Palette, Sparkles, Swords } from "lucide-react";

import { EmotionDial } from "@/components/emotion-dial";
import { GenerationSkeleton } from "@/components/generation-skeleton";
import { PhysicalGenerateLever } from "@/components/physical-generate-lever";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ensureDemoWorkspace,
  fetchArchiveOverview,
  fetchCreditSummary,
  fetchGhostSettings,
  generateTriple,
  type GenerateSeriesItem,
  type GenerateSeriesResponse,
  type GenerateSingleResponse,
  fetchUserProfile,
  patchGenerationRecord,
  saveGenerationRecord,
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

const MATERIAL_QUESTIONS = [
  "今日、1ミリでも「心が動いたこと」は？",
  "今、誰に「ありがとう」と言いたい？",
  "最近、イラッとした「世の中の常識」はある？",
];

const MATERIAL_TEMPLATES = [
  {
    label: "仕事の気づき",
    template: "今日は仕事で「〇〇」という気づきがあった。これを、いまの自分らしい温度感で伝えたい。",
  },
  {
    label: "失敗談",
    template: "今日やらかしたのは「〇〇」。でも、その失敗から見えたことがある。これを正直な気分で伝えたい。",
  },
  {
    label: "感謝",
    template: "今日は「〇〇」に助けられた。ちゃんとありがとうが伝わる形で、この気持ちを残したい。",
  },
  {
    label: "未来の野望",
    template: "いま本気で叶えたいのは「〇〇」。まだ途中だけど、この熱を自分の言葉で伝えたい。",
  },
];

const INTENSITY_BANDS = [
  {
    id: "whisper",
    rangeLabel: "0-20%",
    label: "独り言・ささやき",
    description: "内省的で静かなトーン。自分の胸の内をそっと言葉にする強さです。",
    anchor: 10,
  },
  {
    id: "conversation",
    rangeLabel: "40-60%",
    label: "会話・やり取り",
    description: "標準的で自然な距離感。誰かに話しかけるように届く強さです。",
    anchor: 50,
  },
  {
    id: "declaration",
    rangeLabel: "80-100%",
    label: "宣言・叫び",
    description: "強調・情熱・主張が前に出る強さ。エネルギーが外へ大きく放たれます。",
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

const DEFAULT_SNS_LIMIT = 140;
type StrategyGoal = "awareness" | "education" | "engagement";
type StrategyTemplateId = "ai-recommend" | "buzz" | "trust" | "engage" | "empathy" | "series-launch";

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
  generationMode: "single" | "series";
  featured?: boolean;
}> = [
  {
    id: "buzz",
    label: "バズ狙い",
    summary: "刺激を強めて認知を取りにいく",
    emotion: "toxic",
    intensity: 90,
    strategyGoal: "awareness",
    generationMode: "single",
  },
  {
    id: "trust",
    label: "信頼構築",
    summary: "学びと整理感で信頼を積む",
    emotion: "useful",
    intensity: 55,
    strategyGoal: "education",
    generationMode: "single",
  },
  {
    id: "engage",
    label: "会話を増やす",
    summary: "反応したくなる距離感に寄せる",
    emotion: "empathy",
    intensity: 50,
    strategyGoal: "engagement",
    generationMode: "single",
  },
  {
    id: "empathy",
    label: "共感を深める",
    summary: "余韻を残してファン化に寄せる",
    emotion: "mood",
    intensity: 45,
    strategyGoal: "engagement",
    generationMode: "single",
  },
  {
    id: "series-launch",
    label: "30日運用",
    summary: "認知から信頼までを連載で積む",
    emotion: "useful",
    intensity: 60,
    strategyGoal: "education",
    generationMode: "series",
  },
];

const GOAL_LABELS: Record<StrategyGoal, string> = {
  awareness: "認知",
  education: "教育",
  engagement: "交流",
};

function inferGoalFromEmotion(emotion: EmotionTone): StrategyGoal {
  if (emotion === "toxic" || emotion === "minimal") return "awareness";
  if (emotion === "useful") return "education";
  return "engagement";
}

function buildSeriesRoadmap(templateLabel: string, emotionLabel: string) {
  return [
    {
      weekLabel: "DAY 1-10",
      focus: "第1フェーズ",
      goal: "認知",
      objective: "あなたをまだ知らない人に『刺す』期間",
      detail: `${templateLabel}の入口を作り、${emotionLabel}のフックでまず目を止めてもらう`,
    },
    {
      weekLabel: "DAY 11-20",
      focus: "第2フェーズ",
      goal: "信頼",
      objective: "専門性を出して『納得させる』期間",
      detail: "体験談や学びを出して、発信の軸と専門性を伝える",
    },
    {
      weekLabel: "DAY 21-30",
      focus: "第3フェーズ",
      goal: "ファン化",
      objective: "本音を語り『仲間を作る』期間",
      detail: "失敗や迷いも出して、読者が感情移入できる余白を作る",
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

function getCharacterCount(text: string) {
  return Array.from(text).length;
}

function getCharacterMeta(text: string, limit = DEFAULT_SNS_LIMIT) {
  const count = getCharacterCount(text);
  const remaining = limit - count;
  return {
    count,
    limit,
    remaining,
    withinLimit: remaining >= 0,
    statusLabel: remaining >= 0 ? `${count}文字` : `${count}文字（要調整）`,
  };
}

type SingleResult = GenerateSingleResponse;
type SeriesResult = GenerateSeriesResponse;

export function CreateWorkspace() {
  const router = useRouter();
  const hasAppliedInitialOverridesRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [generationMode, setGenerationMode] = useState<"single" | "series">("single");
  const [strategyGoal, setStrategyGoal] = useState<StrategyGoal>("engagement");
  const [emotion, setEmotion] = useState<EmotionTone>("empathy");
  const [intensity, setIntensity] = useState(70);
  const [stylePrompt, setStylePrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [variants, setVariants] = useState<string[]>([]);
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
  const templateCards = archiveRecommendation?.emotion != null && archiveRecommendation.intensity != null
    ? [
        {
          id: "ai-recommend" as const,
          label: "AI推奨",
          summary: archiveRecommendation.summary,
          emotion: archiveRecommendation.emotion,
          intensity: archiveRecommendation.intensity,
          strategyGoal: inferGoalFromEmotion(archiveRecommendation.emotion),
          generationMode: "single" as const,
          featured: true,
        },
        ...STRATEGY_TEMPLATES,
      ]
    : STRATEGY_TEMPLATES;
  const aiRecommendationTemplate = templateCards.find((template) => template.featured) ?? null;
  const activeTemplate = templateCards.find((template) => template.id === activeTemplateId) ?? null;
  const seriesRoadmap = buildSeriesRoadmap(activeTemplate?.label ?? currentGoalLabel, EMOTION_LABELS[emotion]);
  const leverTitle = loading ? "生成中…" : `レバーを引く（${intensityBand.label}モード）`;
  const leverSubtitle =
    generationMode === "series"
      ? `${activeTemplate?.label ?? "現在の戦略"}で、${EMOTION_LABELS[emotion]}の1週間分を生成します`
      : `${activeTemplate?.label ?? "現在の戦略"}で、${EMOTION_LABELS[emotion]}の3案とハッシュタグを生成します`;
  const draftMeta = getCharacterMeta(draft);

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
        setStylePrompt(ghost.stylePrompt);
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
    if (!draft.trim()) return;
    setError(null);
    setLoading(true);
    setVariants([]);
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
        draft: draft.trim(),
        generationMode,
        strategyGoal,
        emotion,
        speedMode,
        intensity,
        ngWords: ghost.ngWords,
        stylePrompt: stylePrompt.trim(),
        personaKeywords,
        personaSummary,
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
          draft: draft.trim(),
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
        setHashtags(singleData.hashtags);
        setAdviceHint(singleData.adviceHint ?? null);
        setGhostWhisper(singleData.ghostWhisper ?? null);
        setMemoryTags(singleData.memoryTags ?? []);

        const row = await saveGenerationRecord({
          generationMode: "single",
          draft: draft.trim(),
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
  }, [draft, emotion, generationMode, intensity, personaKeywords, personaSummary, speedMode, strategyGoal, stylePrompt]);

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
        const hashtagsLine = item.hashtags.length > 0 ? `\n${item.hashtags.join(" ")}` : "";
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
    setGenerationMode(template.generationMode);
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
          className="absolute bottom-6 left-1/2 h-64 w-md rounded-full blur-3xl transition-all duration-500 ease-out"
          style={{
            backgroundColor: `rgba(${energyGlow}, ${0.06 + energyLevel * 0.18})`,
            transform: `translateX(-50%) scale(${0.9 + energyLevel * 0.3})`,
          }}
        />
      </div>
      <div className="relative mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 pb-28 md:px-6">
        <header className="space-y-1">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
            Create Workspace
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">いまの本音を、刺さる形に変換</h1>
        </header>

        <Card className="border-0 bg-card/80 shadow-xl backdrop-blur-md">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">素材（テキスト）</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Whisper 音声OK
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
                    <span>ヒント</span>
                  </Button>
                </div>
              </div>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="今日の本音や、書きたい断片をそのまま置いてください"
                className="min-h-[180px] resize-y text-base"
              />
              <div className="flex items-center justify-end gap-2 text-xs">
                <span className="text-muted-foreground">標準 140字</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-1 tabular-nums",
                    draftMeta.withinLimit
                      ? "border-border bg-background/80 text-muted-foreground"
                      : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/60 dark:bg-orange-950/30 dark:text-orange-300",
                  )}
                >
                  {draftMeta.count} / {draftMeta.limit}
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    draftMeta.withinLimit ? "text-muted-foreground" : "font-medium text-orange-700 dark:text-orange-300",
                  )}
                >
                  {draftMeta.withinLimit ? `残り ${draftMeta.remaining}` : `${Math.abs(draftMeta.remaining)}字オーバー`}
                </span>
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
                          <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                            どこから書けばいいか迷ったら
                          </p>
                          <p className="text-xs text-muted-foreground">
                            質問やテーマから、最初の一文だけ置いてみてください。
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {MATERIAL_QUESTIONS.map((question) => (
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
                          <p className="text-xs font-medium text-muted-foreground">
                            テーマ・チップス
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {MATERIAL_TEMPLATES.map((template) => (
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
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadAudio(file);
                  }}
                />
                {uploading ? "文字起こし中…" : "独り言をテキスト化"}
              </label>
              {aiRecommendationTemplate ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/20">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="font-semibold text-amber-700 dark:text-amber-300">🔥 AI推奨</span>
                    <span className="truncate text-muted-foreground">
                      {EMOTION_LABELS[aiRecommendationTemplate.emotion]} × {aiRecommendationTemplate.intensity}%（過去の成功パターンから算出）
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full px-3"
                    onClick={() => applyStrategyTemplate(aiRecommendationTemplate.id)}
                  >
                    セットする
                  </Button>
                </div>
              ) : archiveRecommendationLoading ? (
                <div className="rounded-2xl border bg-background/70 px-4 py-3 text-xs text-muted-foreground">
                  AI推奨を確認中…
                </div>
              ) : null}
              <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">戦略テンプレ</p>
                  {activeTemplate ? (
                    <Badge variant="secondary" className="rounded-full">
                      適用中: {activeTemplate.label}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">迷ったら上のAI推奨から始められます</span>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {STRATEGY_TEMPLATES.map((template) => {
                    const active = template.id === activeTemplateId;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyStrategyTemplate(template.id)}
                        className={cn(
                          "rounded-xl border bg-background/85 px-3 py-3 text-left transition-all hover:bg-background",
                          active && cn("border-foreground/30 bg-background shadow-sm ring-2 ring-offset-2", chameleon.ring),
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{template.label}</p>
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
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">感情スイッチ</p>
                  <p className="text-xs text-muted-foreground">テンプレで大枠を決めて、ここで感情だけ微調整します。</p>
                </div>
                <Link href="/persona">
                  <Button type="button" variant="outline" size="sm">
                    ペルソナを更新
                  </Button>
                </Link>
              </div>
              <EmotionDial
                options={toneOptions}
                value={emotion}
                onChange={setEmotion}
                accentRing={chameleon.ring}
              />
            </div>

            <div className="space-y-4 rounded-2xl border bg-background/60 p-4">
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">テンション強度</p>
                  <p className="text-xs text-muted-foreground">
                    強度は「どれくらい大きな心の声で届けるか」です。
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-lg font-semibold", chameleon.accentFg)}>{intensityBand.label}</p>
                  <p className="text-xs font-medium text-foreground">{intensityBand.label}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {INTENSITY_BANDS.map((band) => {
                  const active = band.id === intensityBand.id;
                  return (
                    <button
                      key={band.id}
                      type="button"
                      onClick={() => setIntensity(band.anchor)}
                      className={cn(
                        "rounded-xl border bg-background/80 px-4 py-4 text-left transition-all hover:bg-background",
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

            <div className="rounded-2xl border bg-background/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="size-4 text-primary" />
                    <p className="text-sm font-medium">ペルソナ資産</p>
                    <Badge variant="outline" className="rounded-full">
                      {personaStatus === "approved" ? "承認済み" : personaStatus === "draft" ? "確認待ち" : "未設定"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    どう書くかは毎回入力せず、ペルソナ側で育てる設計です。
                  </p>
                </div>
                <Link href="/persona">
                  <Button type="button" size="sm" variant="outline">
                    ペルソナを開く
                  </Button>
                </Link>
              </div>
              {personaSummary ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{personaSummary}</p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  まだペルソナ分析がありません。`/persona` でURLを登録して、5キーワードを抽出できます。
                </p>
              )}
              {personaKeywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {personaKeywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="rounded-full">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border bg-background/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">生成モード</p>
                  <p className="text-xs text-muted-foreground">
                    連載モードなら、1回のレバー操作で月・水・金の3本をまとめて出します。
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
                    単発モード
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={generationMode === "series" ? "default" : "ghost"}
                    onClick={() => setGenerationMode("series")}
                    className="rounded-lg"
                  >
                    連載モード
                  </Button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {generationMode === "series" ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: 8 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-3 rounded-2xl border border-dashed bg-muted/20 p-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          30回投稿する作業ではなく、1ヶ月でブランドを築くプロジェクトとして設計します
                        </p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {seriesRoadmap.map((phase) => (
                          <div key={phase.weekLabel} className="rounded-xl border bg-background/85 p-4 text-left shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-muted-foreground">{phase.weekLabel}</p>
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
                ) : null}
              </AnimatePresence>
            </div>

            <PhysicalGenerateLever
              disabled={!draft.trim() || uploading}
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
                <motion.div
                  key="sk"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
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
                    {resultMode === "series"
                      ? "1週間分の構成案をまとめて生成"
                      : "3案から「これだ！」を選ぶ"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">
                      戦略: {activeTemplate?.label ?? currentGoalLabel}
                    </Badge>
                    {resultMode === "series" ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void copySeriesBundle()}>
                        <Copy className="mr-1 size-3" />
                        1週間分をコピー
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
                          ペルソナからの気づき
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
                    <p className="text-sm font-medium text-muted-foreground">連載タイトル</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{seriesTitle}</p>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  {(resultMode === "series" ? seriesItems.map((item) => item.body) : variants).map((text, idx) => {
                    const picked = selectedIndex === idx;
                    const slot = SERIES_SLOT_CONFIG[idx];
                    const textMeta = getCharacterMeta(text);
                    const label =
                      resultMode === "series" && slot
                        ? `${slot.day} | ${slot.title}（${slot.subtitle}）`
                        : `案 ${idx + 1}`;

                    return resultMode === "series" ? (
                      <motion.div
                        key={idx}
                        layout
                        className="rounded-2xl border bg-background/90 p-4 text-left text-sm leading-relaxed shadow-sm transition-all hover:shadow-md"
                        whileHover={{ y: -2 }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge variant="outline">{label}</Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              textMeta.withinLimit
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/60 dark:bg-orange-950/30 dark:text-orange-300",
                            )}
                          >
                            {textMeta.statusLabel}
                          </Badge>
                        </div>
                        <p className="min-h-18 text-foreground">{text}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(seriesItems[idx]?.hashtags ?? []).map((tag) => (
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
                        key={idx}
                        type="button"
                        layout
                        onClick={() => selectVariant(idx)}
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
                            <Badge
                              variant="outline"
                              className={cn(
                                textMeta.withinLimit
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                                  : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/60 dark:bg-orange-950/30 dark:text-orange-300",
                              )}
                            >
                              {textMeta.statusLabel}
                            </Badge>
                            {picked ? (
                              <Check className="size-4 text-green-600" />
                            ) : null}
                          </div>
                        </div>
                        <p className="min-h-18 text-foreground">{text}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-8 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
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
                    <p className="text-sm font-medium">ハッシュタグ（提案）</p>
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
                    💡 {adviceHint}
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
