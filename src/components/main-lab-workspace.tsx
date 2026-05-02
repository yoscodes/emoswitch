"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Box, Check, Compass, Flame, Heart, Megaphone, PenLine, Swords, X } from "lucide-react";

import { GenerationSkeleton } from "@/components/generation-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeHypothesisCanvas,
  ensureDemoWorkspace,
  fetchArchiveInsights,
  fetchCreditSummary,
  fetchGhostSettings,
  fetchUserProfile,
  generateTriple,
  patchGenerationRecord,
  saveGenerationRecord,
  type GenerateSeriesItem,
  type GenerateSeriesResponse,
  type GenerateSingleResponse,
  type UsagePurpose,
} from "@/lib/api-client";
import type { QuickFeedback } from "@/lib/types";
import { CHAMELEON } from "@/lib/chameleon";
import { EMOTION_LABELS, type EmotionTone } from "@/lib/emotions";
import { parseEmotionFromQuery, readAndClearReuseSession } from "@/lib/reuse-session";
import { SERIES_SLOT_CONFIG } from "@/lib/series";
import { playSwitchClick } from "@/lib/switch-sound";
import { cn } from "@/lib/utils";

const CANVAS_PLACEHOLDER =
  "整理せず、そのままの言葉で教えてください";

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

const USAGE_PURPOSE_TILES: Array<{
  id: UsagePurpose;
  label: string;
  phase: string;
  summary: string;
}> = [
  {
    id: "discovery",
    label: "探索",
    phase: "Discovery",
    summary: "ニーズ探索・発想の種探し。広がり重視で多様な仮説を増やす。",
  },
  {
    id: "blueprint",
    label: "構築",
    phase: "Blueprint",
    summary: "商品コンセプト・新サービス案。価値の芯とストーリーを組み立てる。",
  },
  {
    id: "refinement",
    label: "研磨",
    phase: "Refinement",
    summary: "仮説の磨き込み・顧客解像度。論理の穴と前提を厳しく圧縮する。",
  },
  {
    id: "communication",
    label: "伝達",
    phase: "Communication",
    summary: "キャッチコピー・クリエイティブ。短文の打ち力と記憶に残る一句。",
  },
];

const USAGE_PURPOSE_TILE_META: Record<UsagePurpose, { icon: React.ReactElement }> = {
  discovery: { icon: <Compass className="size-4" /> },
  blueprint: { icon: <Box className="size-4" /> },
  refinement: { icon: <PenLine className="size-4" /> },
  communication: { icon: <Megaphone className="size-4" /> },
};

const PURPOSE_VAULT_SLOTS: Record<UsagePurpose, string[]> = {
  discovery: ["新しいニーズの言葉", "想定外の共感点", "次の実験アイデア"],
  blueprint: ["価値の理解度", "差別化の納得", "試用・予約の意欲"],
  refinement: ["前提の食い違い", "顧客像の具体エピソード", "論点の穴・リスク"],
  communication: ["一言の印象", "シェアしたくなる理由", "行動の障壁"],
};

const PURPOSE_OUTPUT_SLOTS: Record<UsagePurpose, string[]> = {
  discovery: ["未踏のニーズ（3案）", "「もしも」のアナロジー思考", "既存市場への違和感"],
  blueprint: ["最終目標（North Star）", "逆算された中間指標", "最初のアクション（First Step）"],
  refinement: ["論理の死角（AI Wall）", "顧客の「NO」の理由", "生存日数を延ばすための修正案"],
  communication: ["感情を揺さぶるキャッチコピー", "シェアしたくなる理由の言語化", "行動の障壁を取り除く一言"],
};

type HatTone = "white" | "red" | "black" | "yellow" | "green" | "purple";

const HAT_META: Record<HatTone, { label: string; short: string; dot: string }> = {
  white: { label: "白", short: "事実", dot: "bg-zinc-100 border border-zinc-300 text-zinc-700" },
  red: { label: "赤", short: "感情", dot: "bg-rose-500/90 text-white" },
  black: { label: "黒", short: "リスク", dot: "bg-zinc-900 text-white" },
  yellow: { label: "黄", short: "機会", dot: "bg-amber-400 text-amber-950" },
  green: { label: "緑", short: "創造", dot: "bg-emerald-500/90 text-white" },
  purple: { label: "紫", short: "常識破壊", dot: "bg-violet-500/90 text-white" },
};

const PURPOSE_PROTOCOL: Record<
  UsagePurpose,
  {
    logicSummary: string;
    methods: string;
    detail: string;
    hats: HatTone[];
    modalLines: Array<{ hat: HatTone; line: string }>;
    firstAction: string;
    finalGoal: string;
  }
> = {
  discovery: {
    logicSummary: "MindMapで拡散し、シックスハット法で収束します。",
    methods: "SCAMPER法 + シックスハット法",
    detail: "要素分析（性質・構成・抽象化・時間軸）で、未知の需要と言語化されていない痛みを掘り起こします。",
    hats: ["white", "red", "black", "yellow", "green", "purple"],
    modalLines: [
      { hat: "black", line: "この仮説は導入障壁が高く、初回接点で離脱するリスクがあります。" },
      { hat: "yellow", line: "痛みの共感導線が強いため、刺さる層では高い反応率が期待できます。" },
      { hat: "green", line: "既存の比較軸をずらし、別の価値基準で語ると独自性が立ちます。" },
    ],
    firstAction: "仮説案を1本選び、同じ痛みを持つ3人に30秒で読める形で提示する。",
    finalGoal: "市場の生言葉を3つ以上取得し、次の検証テーマを確定する。",
  },
  blueprint: {
    logicSummary: "価値仮説を分解し、ハットごとに商品コンセプトを設計します。",
    methods: "価値提案マップ + シックスハット法",
    detail: "機能ではなく価値体験を中心に、誰のどの変化を生むかを時間軸で設計します。",
    hats: ["white", "black", "yellow", "green", "purple", "red"],
    modalLines: [
      { hat: "black", line: "提供価値の境界が曖昧だと、既存サービスとの差別化が埋もれます。" },
      { hat: "yellow", line: "利用後の未来像が明確なので、コンセプトの納得が取りやすいです。" },
      { hat: "green", line: "提供順序を再設計すると、最小構成でも強い体験を作れます。" },
    ],
    firstAction: "価値提案を1文で定義し、最初に届ける体験を1つに絞る。",
    finalGoal: "新サービスの核となる提供価値と検証指標を1セットで確定する。",
  },
  refinement: {
    logicSummary: "論点を圧縮し、仮説の弱点を先に露出させて磨き込みます。",
    methods: "反証ベース分析 + シックスハット法",
    detail: "前提・証拠・反証の3層で検証し、顧客解像度と意思決定基準のズレを詰めます。",
    hats: ["black", "white", "red", "yellow", "green", "purple"],
    modalLines: [
      { hat: "black", line: "顧客像が広すぎるため、誰に刺さる仮説かの輪郭が薄くなっています。" },
      { hat: "yellow", line: "対象を絞れば、検証コストを抑えつつ反応の質を上げられます。" },
      { hat: "green", line: "失敗シナリオを先に公開する構成にすると、信頼と反応を同時に取れます。" },
    ],
    firstAction: "対象顧客を1タイプに限定し、反証質問を3つ作って本文を再構成する。",
    finalGoal: "次回の検証で捨てる仮説と残す仮説を明確に分離する。",
  },
  communication: {
    logicSummary: "メッセージ候補を拡散生成し、ハットで打ち出し精度を整えます。",
    methods: "コピー分岐生成 + シックスハット法",
    detail: "印象・理解・行動の3段で評価し、短文でも意味が通る構成へ最適化します。",
    hats: ["red", "white", "yellow", "black", "green", "purple"],
    modalLines: [
      { hat: "black", line: "言い回しが抽象寄りで、行動に落ちる一歩が見えにくいです。" },
      { hat: "yellow", line: "ベネフィットの即時性が高く、初見でも価値が伝わりやすいです。" },
      { hat: "green", line: "比喩を1つ加えると記憶に残り、シェアされる確率が上がります。" },
    ],
    firstAction: "最有力案を15秒で読める長さに圧縮し、CTAを1つだけ置く。",
    finalGoal: "保存・シェア・返信のいずれかで反応率の基準値を超える。",
  },
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

export function MainLabWorkspace() {
  const router = useRouter();
  const hasAppliedInitialOverridesRef = useRef(false);
  const prevHasLiveOutputRef = useRef(false);
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
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [archiveRecommendation, setArchiveRecommendation] = useState<ArchiveRecommendation | null>(null);
  const [personaKeywords, setPersonaKeywords] = useState<string[]>([]);
  const [personaSummary, setPersonaSummary] = useState("");
  const [personaStatus, setPersonaStatus] = useState<"empty" | "draft" | "approved">("empty");
  const [manualPosts, setManualPosts] = useState<string[]>([]);
  const [identitySyncCue, setIdentitySyncCue] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<StrategyTemplateId | null>(null);
  const [usagePurposeId, setUsagePurposeId] = useState<UsagePurpose>("discovery");
  const [dnaAlignment, setDnaAlignment] = useState<number | null>(null);
  const [dnaAlignmentReason, setDnaAlignmentReason] = useState<string | null>(null);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState<QuickFeedback>(null);
  const [likesInput, setLikesInput] = useState("");
  const [memoInput, setMemoInput] = useState("");

  const chameleon = CHAMELEON[emotion];
  const energyGlow = ENERGY_RGB_BY_EMOTION[emotion];
  const currentGoalLabel = GOAL_LABELS[strategyGoal];
  const isSprintMode = generationMode === "series";
  const trimmedDraft = draft.trim();
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
  const inputCompletionCount = [draft, refinementAnswer].filter((item) => item.trim()).length;
  const strategyMatrixTiles = STRATEGY_TEMPLATES;
  const activeTemplate = STRATEGY_TEMPLATES.find((template) => template.id === activeTemplateId) ?? null;
  const canChooseSprint = trimmedDraft.length > 0;
  const vaultReactionSlots = PURPOSE_VAULT_SLOTS[usagePurposeId];
  const outputSlots = PURPOSE_OUTPUT_SLOTS[usagePurposeId];
  const activePurpose = USAGE_PURPOSE_TILES.find((tile) => tile.id === usagePurposeId) ?? USAGE_PURPOSE_TILES[0];
  const activeProtocol = PURPOSE_PROTOCOL[usagePurposeId];
  const seriesRoadmap = buildSeriesRoadmap(activeTemplate?.label ?? currentGoalLabel, EMOTION_LABELS[emotion]);
  const archiveToneLabel = archiveRecommendation?.emotion ? EMOTION_LABELS[archiveRecommendation.emotion] : null;
  const identityExtractionPercent = useMemo(() => {
    const kw = personaKeywords?.length ?? 0;
    const sum = personaSummary?.trim() ? 1 : 0;
    const choiceLines = manualPosts.filter((line) => line.startsWith("dna_choice|")).length;
    let p = Math.min(36, kw * 5) + (sum ? 14 : 0) + Math.min(32, choiceLines * 7);
    if (personaStatus === "approved") p = Math.max(p, 78);
    else if (personaStatus === "draft") p = Math.max(p, 52);
    return Math.min(100, p);
  }, [manualPosts, personaKeywords, personaStatus, personaSummary]);
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
  const deployTitle =
    generationMode === "series"
      ? "30日プランをまとめて生成"
      : activeTemplate
        ? `${activeTemplate.label}で検証を実行`
        : "検証の型を選んでから生成";
  const deployHint =
    generationMode === "series"
      ? `「${activePurpose.label}」の用途で30日案を一括生成します。`
      : activeTemplate
        ? `「${activePurpose.label}」×「${activeTemplate.label}」で3案を出します。`
        : `まず「${activePurpose.label}」の用途を確認し、武器（戦略）を選んでください。`;
  const deployOutputComposition = useMemo(() => {
    const purpose = activePurpose.label;
    const nextActionCopy = "「今日、今すぐできること」まで具体化して提示";
    const depthCopy = `「${purpose}」に基づき、5つの視点から多角分析`;
    if (generationMode === "series") {
      return {
        coreConcept: `30日スプリントを軸に据えた「${purpose}」の最適化案`,
        thinkingDepth: depthCopy,
        nextAction: nextActionCopy,
      };
    }
    const weapon = activeTemplate?.label;
    return {
      coreConcept: weapon
        ? `「${weapon}」を軸に据えた「${purpose}」の最適化案`
        : `武器（検証の型）を軸に据えた「${purpose}」の最適化案`,
      thinkingDepth: depthCopy,
      nextAction: nextActionCopy,
    };
  }, [activePurpose.label, activeTemplate?.label, generationMode]);
  const applyTonePreset = useCallback((nextEmotion: EmotionTone, nextIntensity?: number) => {
    setEmotion(nextEmotion);
    if (typeof nextIntensity === "number") {
      setIntensity(nextIntensity);
    }
  }, []);
  const applyArchiveRecommendationPreset = useCallback(() => {
    if (!archiveRecommendation) return;
    if (archiveRecommendation.emotion) {
      applyTonePreset(archiveRecommendation.emotion, archiveRecommendation.intensity ?? undefined);
      setStrategyGoal(inferGoalFromEmotion(archiveRecommendation.emotion));
    } else if (archiveRecommendation.intensity != null) {
      setIntensity(archiveRecommendation.intensity);
    }
    setActiveTemplateId(null);
    playSwitchClick();
  }, [applyTonePreset, archiveRecommendation]);

  useEffect(() => {
    if (hasAppliedInitialOverridesRef.current) return;

    const fromSession = readAndClearReuseSession();
    if (fromSession) {
      hasAppliedInitialOverridesRef.current = true;
      setDraft(fromSession.draft);
      applyTonePreset(fromSession.emotion, fromSession.intensity);
      setStrategyGoal(inferGoalFromEmotion(fromSession.emotion));
      router.replace("/lab", { scroll: false });
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
      router.replace("/lab", { scroll: false });
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
      .then(() => Promise.all([fetchGhostSettings(), fetchArchiveInsights(), fetchCreditSummary()]))
      .then(([ghost, insights, credit]) => {
        if (!active) return;
        setPersonaKeywords(ghost.personaKeywords);
        setPersonaSummary(ghost.personaSummary);
        setPersonaStatus(ghost.personaStatus);
        setManualPosts(ghost.manualPosts ?? []);
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
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("emoswitch_identity_sync_glow");
    if (!raw) return;
    sessionStorage.removeItem("emoswitch_identity_sync_glow");
    setIdentitySyncCue(true);
    const timeoutId = window.setTimeout(() => setIdentitySyncCue(false), 2400);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!storedSeed.trim()) {
      setDnaAlignment(null);
      setDnaAlignmentReason(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void analyzeHypothesisCanvas({
        draft: storedSeed,
        refinementAnswer,
        generationMode,
        emotion,
        intensity,
        personaKeywords,
        personaSummary,
        strategyLabel: activeTemplate?.label ?? "",
        usagePurpose: usagePurposeId,
      })
        .then((res) => {
          if (cancelled) return;
          setDnaAlignment(res.dnaAlignment);
          setDnaAlignmentReason(res.dnaReason);
        })
        .catch(() => {
          if (cancelled) return;
          setDnaAlignment(null);
          setDnaAlignmentReason(null);
        });
    }, 420);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    activeTemplate?.label,
    emotion,
    generationMode,
    intensity,
    personaKeywords,
    personaSummary,
    refinementAnswer,
    storedSeed,
    usagePurposeId,
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
    setQuickFeedback(null);
    setLikesInput("");
    setMemoInput("");
    setResultsModalOpen(false);
    playSwitchClick();

    try {
      await ensureDemoWorkspace();
      const [ghost, credit] = await Promise.all([fetchGhostSettings(), fetchCreditSummary()]);
      if (!credit.isUnlimited && credit.dailyLimit != null && credit.dailyUsed >= credit.dailyLimit) {
        throw new Error("無料プランの本日の生成上限（3回）に達しました。");
      }
      if (!credit.isUnlimited && credit.remaining <= 0) {
        throw new Error("クレジットが残っていません。プランをアップグレードしてください。");
      }
      setManualPosts(ghost.manualPosts ?? []);

      const data = await generateTriple({
        draft: storedSeed,
        generationMode: requestedMode,
        strategyGoal,
        usagePurpose: usagePurposeId,
        emotion,
        speedMode: requestedSpeedMode,
        intensity: requestedIntensity,
        ngWords: ghost.ngWords,
        stylePrompt: ghost.stylePrompt.trim(),
        personaKeywords,
        personaSummary,
        whyMe: [
          refinementAnswer.trim(),
          `活用目的: ${activePurpose.label}（${activePurpose.phase}）。${activePurpose.summary}`,
          requestedMode === "series" ? "30日の検証プランとして設計したい" : null,
          requestedMode === "single" && activeTemplate
            ? `優先したい切り口: ${GOAL_LABELS[activeTemplate.strategyGoal]}（${activeTemplate.label}）`
            : null,
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
          setQuickFeedback(row.quickFeedback ?? null);
          setLikesInput(row.likes != null ? String(row.likes) : "");
          setMemoInput(row.memo ?? "");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, [
    emotion,
    generationMode,
    intensity,
    personaKeywords,
    personaSummary,
    activePurpose.phase,
    activePurpose.label,
    activePurpose.summary,
    activeTemplate,
    refinementAnswer,
    storedSeed,
    strategyGoal,
    usagePurposeId,
  ]);

  const selectVariant = (index: number) => {
    setSelectedIndex(index);
    if (currentId) {
      void patchGenerationRecord(currentId, { selectedIndex: index })
        .then((row) => {
          setQuickFeedback(row.quickFeedback ?? null);
          setLikesInput(row.likes != null ? String(row.likes) : "");
          setMemoInput(row.memo ?? "");
        })
        .catch(() => undefined);
    }
  };
  const saveSingleFeedback = useCallback(
    async (payload: Partial<{ quickFeedback: QuickFeedback; likes: number | null; memo: string | null }>) => {
      if (!currentId) return;
      setFeedbackSaving(true);
      setError(null);
      try {
        const row = await patchGenerationRecord(currentId, payload);
        setQuickFeedback(row.quickFeedback ?? null);
        setLikesInput(row.likes != null ? String(row.likes) : "");
        setMemoInput(row.memo ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "フィードバック保存に失敗しました");
      } finally {
        setFeedbackSaving(false);
      }
    },
    [currentId],
  );
  const handleQuickFeedback = useCallback(
    (nextValue: Exclude<QuickFeedback, null>) => {
      const resolved = quickFeedback === nextValue ? null : nextValue;
      setQuickFeedback(resolved);
      void saveSingleFeedback({ quickFeedback: resolved });
    },
    [quickFeedback, saveSingleFeedback],
  );
  const handleSaveValidationMemo = useCallback(() => {
    const parsedLikes = likesInput.trim() === "" ? null : Number.parseInt(likesInput, 10);
    void saveSingleFeedback({
      likes: parsedLikes == null || Number.isNaN(parsedLikes) ? null : parsedLikes,
      memo: memoInput.trim() === "" ? null : memoInput.trim(),
    });
  }, [likesInput, memoInput, saveSingleFeedback]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const applyStrategyTemplate = (templateId: StrategyTemplateId) => {
    const template = STRATEGY_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setActiveTemplateId(template.id);
    setStrategyGoal(template.strategyGoal);
    applyTonePreset(template.emotion, template.intensity);
    playSwitchClick();
  };

  const applyUsagePurpose = (purposeId: UsagePurpose) => {
    setUsagePurposeId(purposeId);
    playSwitchClick();
  };

  const columnCardClass =
    "flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-border/10 bg-white/95 shadow-[0_20px_55px_-44px_rgba(15,23,42,0.18)] dark:border-border/15 dark:bg-background/94";
  const columnHeaderClass =
    "shrink-0 border-b border-border/20 bg-linear-to-r from-violet-50/40 via-muted/30 to-fuchsia-50/20 px-4 py-3 dark:from-violet-950/25 dark:via-background/50 dark:to-fuchsia-950/10";
  const columnBodyClass =
    "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 [scrollbar-gutter:stable]";
  const outputBodyClass =
    "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 [scrollbar-gutter:stable]";
  const laneDividerClass = "border-t border-border/15 pt-4";
  const hasLiveOutput =
    (resultMode === "single" && variants.length === 3) || (resultMode === "series" && seriesItems.length === 3);
  const alignmentPercent =
    dnaAlignment == null ? null : Math.min(100, Math.max(0, Math.round(dnaAlignment)));
  const canDeploy =
    Boolean(storedSeed.trim()) &&
    !uploading &&
    !loading &&
    (generationMode === "series" || activeTemplate != null);

  const seedReportFragment = useMemo(() => {
    const raw = draft.trim() || storedSeed.replace(/\n+/g, " ").trim();
    const flat = raw.replace(/\s+/g, " ").trim();
    if (!flat) return "";
    return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
  }, [draft, storedSeed]);

  const identityResonancePercent = useMemo(() => {
    if (alignmentPercent != null) {
      return Math.round(Math.min(100, Math.max(0, (alignmentPercent + identityExtractionPercent) / 2)));
    }
    return identityExtractionPercent;
  }, [alignmentPercent, identityExtractionPercent]);

  const survivalBoostDays = useMemo(() => {
    return Math.min(28, Math.max(3, Math.round(identityResonancePercent * 0.16 + 7)));
  }, [identityResonancePercent]);

  useEffect(() => {
    if (hasLiveOutput && !prevHasLiveOutputRef.current) {
      setResultsModalOpen(true);
    }
    prevHasLiveOutputRef.current = hasLiveOutput;
  }, [hasLiveOutput]);

  useEffect(() => {
    if (!resultsModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setResultsModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resultsModalOpen]);

  useEffect(() => {
    if (!resultsModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [resultsModalOpen]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-zinc-50 transition-colors duration-500 ease-out dark:bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-violet-100/18 to-transparent dark:from-violet-950/20" />
        <div
          className="absolute inset-0 opacity-[0.14] transition-opacity duration-500 dark:opacity-[0.12]"
          style={{
            background: `radial-gradient(ellipse 90% 45% at 50% -10%, rgba(${energyGlow}, 0.35), transparent 55%)`,
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 pb-4 pt-5 md:px-6 md:pt-8 xl:px-8 2xl:px-10 lg:h-[calc(100vh-4rem)]">
        <div className="flex flex-1 min-h-0 flex-col gap-4">
          <div className="grid flex-1 min-h-0 gap-5 lg:h-full lg:grid-cols-[minmax(280px,1fr)_minmax(440px,1.65fr)_minmax(320px,1.2fr)] lg:items-start xl:gap-6 xl:grid-cols-[minmax(300px,1fr)_minmax(520px,1.65fr)_minmax(340px,1.2fr)] 2xl:grid-cols-[minmax(320px,1fr)_minmax(580px,1.65fr)_minmax(360px,1.2fr)]">
              <section className={columnCardClass}>
                <div className={columnHeaderClass}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="text-xl leading-none" aria-hidden>
                        🌱
                      </span>
                      <div>
                        <p className="text-sm font-semibold tracking-tight text-foreground">SEED</p>
                        <p className="text-xs text-muted-foreground">種（入力）</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <div
                        className="flex flex-col items-end gap-1"
                        title="キーワード・要約・DNA 選択などの入力から推定した整理度（Identity Lab と連動）"
                      >
                        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">DNA 整理度</p>
                        <div
                          className={cn(
                            "relative grid size-9 shrink-0 place-items-center rounded-full transition-all duration-700",
                            identitySyncCue && "shadow-[0_0_28px_-8px_rgba(139,92,246,0.85)]",
                          )}
                          style={{
                            background: `conic-gradient(rgba(124,58,237,0.92) 0% ${identityExtractionPercent}%, rgba(228,228,231,0.42) ${identityExtractionPercent}% 100%)`,
                          }}
                        >
                          <div className="grid size-[2.15rem] place-items-center rounded-full bg-background/95 text-center">
                            <p className="text-[11px] font-semibold tabular-nums leading-none text-foreground">
                              {identityExtractionPercent}
                              <span className="text-[9px] font-semibold">%</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        入力 {inputCompletionCount}/2
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className={cn(columnBodyClass, "pb-24")}>
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={CANVAS_PLACEHOLDER}
                  className="min-h-[240px] resize-y rounded-2xl border-0 bg-muted/20 text-base leading-7 shadow-none placeholder:text-muted-foreground/45"
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

                </div>
              </section>

              <section
                className={cn(
                  columnCardClass,
                  "flex min-h-0 flex-col",
                  isSprintMode && "bg-violet-50/30 dark:bg-violet-950/18",
                )}
              >
                <div className={columnHeaderClass}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold tracking-tight text-foreground">STRATEGY</p>
                      <p className="text-xs text-muted-foreground">
                        {generationMode === "series" ? "目的 → 30日プラン" : "目的 → 武器（戦略）"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {loading ? (
                        <Badge className="animate-pulse rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] text-white">検証中</Badge>
                      ) : null}
                      <Badge variant="outline" className="rounded-full border-amber-200/60 bg-amber-50/80 text-[10px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
                        {activePurpose.label}
                      </Badge>
                      {generationMode === "series" ? (
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          30日プラン
                        </Badge>
                      ) : activeTemplate ? (
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {activeTemplate.label}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={cn(columnBodyClass, "min-h-0 flex-1 overflow-y-auto pb-2")}>
                <div className={laneDividerClass}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">STEP 1</p>
                      <p className="text-sm font-medium">活用方法（いまの目的）</p>
                    </div>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {activePurpose.phase}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    事業フェーズに合わせて出力の型と鋭さを切り替えます。次に「武器」として共感・課題・論理のどれを前に出すかを選びます。
                  </p>
                  <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    {USAGE_PURPOSE_TILES.map((tile) => {
                      const active = tile.id === usagePurposeId;
                      const meta = USAGE_PURPOSE_TILE_META[tile.id];
                      return (
                        <button
                          key={tile.id}
                          type="button"
                          onClick={() => applyUsagePurpose(tile.id)}
                          className={cn(
                            "min-h-[128px] rounded-2xl border border-border/25 bg-muted/20 px-3.5 py-3 text-left transition-all hover:bg-muted/40 sm:min-h-[118px] sm:px-3 sm:py-3.5",
                            active &&
                              "border-violet-400/55 bg-background shadow-[0_0_24px_-14px_rgba(124,58,237,0.5)] ring-2 ring-violet-500/45 ring-offset-1 ring-offset-zinc-50 dark:border-violet-500/40 dark:bg-violet-950/20 dark:ring-offset-background",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-background/85 text-muted-foreground sm:size-8">
                              {meta.icon}
                            </span>
                            <span className="max-w-[52%] text-right text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground/85">
                              {tile.phase}
                            </span>
                          </div>
                          <p className="mt-2.5 text-sm font-semibold leading-tight">{tile.label}</p>
                          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{tile.summary}</p>
                        </button>
                      );
                    })}
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
                        <p className="text-xs font-semibold tracking-wide text-violet-700 dark:text-violet-200">PLAN MODE</p>
                        <p className="mt-1 text-sm font-medium">30日プラン作成モードです</p>
                      </div>
                      <Badge className="rounded-full bg-violet-600 text-white">Professional</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      3フェーズで実行計画を作ります。
                    </p>
                  </motion.div>
                ) : null}

                {canChooseSprint ? (
                  <div className={laneDividerClass}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">検証ルート</p>
                        <p className="text-sm font-medium">次の検証形式を選ぶ</p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[11px]">入力後に選択可能</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setGenerationMode("single")}
                        className={cn(
                          "rounded-2xl border border-border/30 bg-muted/25 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-all hover:bg-muted/45 dark:border-border/25 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                          generationMode === "single" &&
                            cn(
                              "bg-background shadow-[0_0_36px_-10px_rgba(124,58,237,0.55),inset_0_1px_0_rgba(255,255,255,0.85)] ring-2 ring-offset-2 dark:bg-background/90 dark:shadow-[0_0_40px_-12px_rgba(139,92,246,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]",
                              chameleon.ring,
                            ),
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
                          "rounded-2xl border border-border/30 bg-muted/25 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-all hover:bg-muted/45 dark:border-border/25 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                          generationMode === "series" &&
                            "border-violet-300/45 bg-background shadow-[0_0_36px_-10px_rgba(124,58,237,0.6),inset_0_1px_0_rgba(255,255,255,0.85)] ring-2 ring-violet-400/55 ring-offset-2 ring-offset-zinc-50 dark:border-violet-500/35 dark:bg-violet-950/25 dark:shadow-[0_0_40px_-12px_rgba(139,92,246,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] dark:ring-violet-400/45 dark:ring-offset-background",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">30日プラン</p>
                          <Badge className="rounded-full bg-violet-600 text-white">30日</Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          30日分の実行計画を一括で作成します。
                        </p>
                      </button>
                    </div>
                  </div>
                ) : null}

                {generationMode === "series" ? (
                  <div className={laneDividerClass}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">STEP 2</p>
                        <p className="text-sm font-medium">30日を3フェーズで管理</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">タイムライン</p>
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
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground">Vault Signal</p>
                            <p className="text-sm font-medium">反応傾向を参照</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {archiveRecommendation ? "学習済み" : "学習待ち"}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        {archiveRecommendation?.summary ?? "Vault の反応ログを使って、進め方を調整します。"}
                      </p>
                      {archiveRecommendation ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {archiveToneLabel ? (
                            <Badge variant="outline" className="rounded-full text-[11px]">
                              推奨トーン: {archiveToneLabel}
                            </Badge>
                          ) : null}
                          {archiveRecommendation.intensity != null ? (
                            <Badge variant="outline" className="rounded-full text-[11px]">
                              推奨強度: {archiveRecommendation.intensity}%
                            </Badge>
                          ) : null}
                          {(archiveRecommendation.emotion || archiveRecommendation.intensity != null) ? (
                            <Button type="button" variant="ghost" size="sm" onClick={applyArchiveRecommendationPreset} className="h-7 px-2 text-xs">
                              保存する
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className={laneDividerClass}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">STEP 2</p>
                        <p className="text-sm font-medium">武器（検証の型）</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">3スタイル</p>
                    </div>
                    <div className="mt-3.5 grid gap-2.5 md:grid-cols-3 md:gap-3">
                      {strategyMatrixTiles.map((template) => {
                        const active = template.id === activeTemplateId;
                        const meta = STRATEGY_TILE_META[template.id];

                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => applyStrategyTemplate(template.id)}
                            className={cn(
                              "flex min-h-[198px] flex-col rounded-[22px] border border-transparent bg-muted/25 px-3.5 pb-3.5 pt-3 text-left transition-all hover:bg-muted/40 md:min-h-[208px] md:rounded-[24px] md:px-4 md:pb-4 md:pt-3.5",
                              active
                                ? "border-violet-400/40 bg-white/90 shadow-[0_0_32px_-14px_rgba(124,58,237,0.55)] ring-2 ring-violet-500/50 ring-offset-1 ring-offset-white/80 dark:border-violet-500/35 dark:bg-background/85 dark:ring-violet-400/45 dark:ring-offset-background"
                                : "border-border/15",
                            )}
                          >
                            <div className="flex justify-end pb-0.5">
                              <span className="inline-flex size-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground md:size-8">
                                {meta.icon}
                              </span>
                            </div>
                            <div className="mt-3 flex-1 md:mt-3.5">
                              <p className="text-[15px] font-semibold leading-snug md:text-base">{template.label}</p>
                              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground md:text-sm md:leading-6">
                                {template.summary}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                </div>
              </section>

              <section className={cn(columnCardClass, "flex flex-col")}>
                <div className={columnHeaderClass}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold tracking-tight text-foreground">LIVE OUTPUT</p>
                      <p className="text-sm text-muted-foreground">
                        {generationMode === "series"
                          ? "生成後はモーダルで30日プランを表示"
                          : "生成後はモーダルで検証レポートを表示"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 rounded-full border-border/35 text-[10px] text-muted-foreground">
                      {generationMode === "series" ? "Sprint" : "シグナル"}
                    </Badge>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                <div className={cn(outputBodyClass, "space-y-4")}>
                {!hasLiveOutput ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border/15 bg-background/50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">何を出すか</p>
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          {activePurpose.phase}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        「{activePurpose.label}」では、次の3スロットを優先して出力します。
                      </p>
                      <div className="mt-3 grid gap-2">
                        {outputSlots.map((slot, index) => (
                          <div
                            key={slot}
                            className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-muted/12 px-3 py-2.5"
                          >
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                              {index + 1}
                            </span>
                            <span className="text-xs font-medium text-foreground/90">{slot}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/15 bg-background/40 p-4">
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">期待する反応</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        「{activePurpose.label}」に合わせた Vault 還流の観測スロット
                      </p>
                      <div className="mt-3 grid gap-2">
                        {vaultReactionSlots.map((slot) => (
                          <div
                            key={slot}
                            className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/45 bg-muted/15 px-3 py-2.5"
                          >
                            <span className="size-1.5 shrink-0 rounded-full bg-violet-400/80" aria-hidden />
                            <span className="text-xs font-medium text-foreground/85">{slot}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <GenerationSkeleton />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {!loading && hasLiveOutput && !resultsModalOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(laneDividerClass, "rounded-2xl border border-violet-200/35 bg-linear-to-br from-violet-50/70 to-background p-4 dark:border-violet-900/40 dark:from-violet-950/25")}
                  >
                    <p className="text-xs font-semibold tracking-wide text-violet-900 dark:text-violet-100">検証レポート</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {resultMode === "series" ? "30日プランをモーダルで確認できます。" : "仮説案はモーダルにまとまっています。"}
                    </p>
                    <Button type="button" className="mt-3" onClick={() => setResultsModalOpen(true)}>
                      レポートを開く
                    </Button>
                  </motion.div>
                ) : null}

                {resultMode === "single" && variants.length === 3 && !resultsModalOpen ? (
                  <div className={cn(laneDividerClass, "space-y-4")}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">検証フィードバック</p>
                        <p className="mt-1 text-sm text-muted-foreground">反応を残すと、次回の精度向上に使われます。</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={quickFeedback === "hot" ? "default" : "outline"}
                          size="sm"
                          disabled={!currentId || feedbackSaving}
                          onClick={() => handleQuickFeedback("hot")}
                        >
                          反応あり
                        </Button>
                        <Button
                          type="button"
                          variant={quickFeedback === "cold" ? "default" : "outline"}
                          size="sm"
                          disabled={!currentId || feedbackSaving}
                          onClick={() => handleQuickFeedback("cold")}
                        >
                          刺さらず
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_auto] md:items-end">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold tracking-wide text-muted-foreground">いいね数</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={likesInput}
                          onChange={(event) => setLikesInput(event.target.value)}
                          className="h-10 w-full rounded-xl border-0 bg-muted/40 px-3 text-sm outline-none"
                          placeholder="例: 23"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold tracking-wide text-muted-foreground">検証メモ</span>
                        <Textarea
                          value={memoInput}
                          onChange={(event) => setMemoInput(event.target.value)}
                          className="min-h-10 resize-y border-0 bg-muted/40 shadow-none"
                          placeholder="投稿時間、反応の質、次に変えたい点など"
                        />
                      </label>
                      <Button type="button" variant="outline" disabled={!currentId || feedbackSaving} onClick={handleSaveValidationMemo}>
                        {feedbackSaving ? "保存中…" : "保存する"}
                      </Button>
                    </div>
                  </div>
                ) : null}
                </div>

                <div className="shrink-0 space-y-3 border-t border-border/15 bg-linear-to-t from-background/95 to-background/70 px-4 py-3 dark:from-background/90 dark:to-background/55">
                  {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/70">DEPLOY</p>
                      <p className="mt-1 text-sm font-medium leading-snug">{deployTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{deployHint}</p>
                      <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
                        <li>
                          <span className="font-semibold text-foreground/80">コア・コンセプト: </span>
                          {deployOutputComposition.coreConcept}
                        </li>
                        <li>
                          <span className="font-semibold text-foreground/80">思考の深さ: </span>
                          {deployOutputComposition.thinkingDepth}
                        </li>
                        <li>
                          <span className="font-semibold text-foreground/80">次のアクション: </span>
                          {deployOutputComposition.nextAction}
                        </li>
                      </ul>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canDeploy}
                      onClick={() => {
                        void runGenerate({ modeOverride: generationMode });
                      }}
                      className={cn(
                        "w-full min-w-0 shrink-0 bg-linear-to-r from-fuchsia-600 via-violet-600 to-purple-600 text-white hover:from-fuchsia-500 hover:via-violet-500 hover:to-purple-500 md:w-auto md:min-w-[184px]",
                        "shadow-[0_0_44px_-8px_rgba(192,38,211,0.95)] ring-1 ring-fuchsia-300/45",
                      )}
                    >
                      {loading ? "生成中…" : "生成する"}
                    </Button>
                  </div>
                </div>
                </div>
              </section>
          </div>
        </div>
      </div>

      {resultsModalOpen && hasLiveOutput ? (
        <div className="fixed inset-0 z-120 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px] dark:bg-black/65"
            aria-label="レポートを閉じる"
            onClick={() => setResultsModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lab-results-modal-title"
            className="relative z-1 flex max-h-[min(92dvh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-border/25 bg-background shadow-[0_-32px_90px_-40px_rgba(0,0,0,0.45)] sm:rounded-[28px] sm:shadow-[0_40px_120px_-48px_rgba(0,0,0,0.55)]"
          >
            <div className="shrink-0 border-b border-border/15 bg-linear-to-r from-violet-50/90 via-background to-fuchsia-50/35 px-5 pb-4 pt-5 dark:from-violet-950/35 dark:via-background dark:to-fuchsia-950/15">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-background/90 text-violet-700 shadow-sm ring-1 ring-border/35 dark:text-violet-200">
                    {resultMode === "series" ? (
                      <BookOpen className="size-5" />
                    ) : activeTemplateId ? (
                      <span className="grid place-items-center [&_svg]:size-5">{STRATEGY_TILE_META[activeTemplateId].icon}</span>
                    ) : (
                      <Flame className="size-5 text-orange-500" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2 id="lab-results-modal-title" className="text-lg font-semibold tracking-tight text-foreground">
                      検証レポート
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground/90">活用: {activePurpose.label}</span>
                      <span className="text-muted-foreground/80"> · </span>
                      <span className="font-medium text-foreground/90">
                        武器: {resultMode === "series" ? "30日プラン" : activeTemplate?.label ?? "単発検証"}
                      </span>
                      {seedReportFragment ? (
                        <>
                          {" "}
                          <span className="text-muted-foreground/90">·</span> {seedReportFragment}
                        </>
                      ) : null}
                    </p>
                    <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
                      <li>
                        <span className="font-semibold text-foreground/85">コア・コンセプト: </span>
                        {deployOutputComposition.coreConcept}
                      </li>
                      <li>
                        <span className="font-semibold text-foreground/85">思考の深さ: </span>
                        {deployOutputComposition.thinkingDepth}
                      </li>
                      <li>
                        <span className="font-semibold text-foreground/85">次のアクション: </span>
                        {deployOutputComposition.nextAction}
                      </li>
                    </ul>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-full"
                  onClick={() => setResultsModalOpen(false)}
                  aria-label="閉じる"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-background/85 px-4 py-3 ring-1 ring-border/25 dark:bg-background/70">
                <div className="shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Identity 共鳴度</p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight text-violet-700 dark:text-violet-200">
                    {identityResonancePercent}
                    <span className="text-base font-semibold">%</span>
                  </p>
                </div>
                <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                  {dnaAlignmentReason ?? "SEED と Identity DNA の距離感から推定しています。"}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 [scrollbar-gutter:stable]">
              {ghostWhisper ? (
                <div className="border-l-2 border-violet-200/70 pl-3 text-sm text-violet-950 dark:border-violet-800/60 dark:text-violet-100">
                  <p className="text-xs font-semibold uppercase tracking-wide">Identity DNA からの示唆</p>
                  <p className="mt-1 leading-relaxed">{ghostWhisper}</p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/15 bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">ハット視点レポート</p>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {activePurpose.label}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {activeProtocol.modalLines.map((entry) => {
                    const meta = HAT_META[entry.hat];
                    return (
                      <div key={`${entry.hat}-${entry.line}`} className="rounded-xl border border-border/20 bg-background/70 px-3 py-2">
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={cn("inline-flex size-4 items-center justify-center rounded-full text-[9px] font-semibold", meta.dot)}>
                            {meta.label}
                          </span>
                          <span className="font-semibold text-muted-foreground">{meta.short}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground/90">{entry.line}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-xl border border-dashed border-border/35 bg-background/70 px-3 py-2.5">
                  <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">アクションツリー（逆算）</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">最初のアクション:</span> {activeProtocol.firstAction}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">最終目標:</span> {activeProtocol.finalGoal}
                  </p>
                </div>
              </div>

              {resultMode === "series" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-muted/25 p-4">
                    <p className="text-sm font-medium text-muted-foreground">30日プラン名</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{seriesTitle}</p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">30日の流れ</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {sprintTimelinePhases.map((phase, index) => {
                        const item = seriesItems[index];
                        return (
                          <div key={phase.rangeLabel} className={cn("rounded-2xl p-4", phase.style.glow)}>
                            <div className="flex items-center justify-between gap-2">
                              <Badge className={cn("rounded-full", phase.style.tone)}>{phase.slot?.title ?? phase.focus}</Badge>
                              <span className="text-[10px] font-semibold text-muted-foreground">{phase.rangeLabel}</span>
                            </div>
                            <p className="mt-3 text-sm font-medium">{phase.goal}</p>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item?.body ?? phase.detail}</p>
                            {item?.validationMetric ? (
                              <div className="mt-3 border-l-2 border-dashed border-border/50 pl-3">
                                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">成功指標</p>
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
                <div className="grid gap-3">
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
                          "rounded-2xl border border-border/20 bg-muted/10 p-4 text-left transition-all hover:bg-muted/20",
                          picked && cn("bg-background shadow-md ring-2 ring-offset-2 ring-offset-background", chameleon.ring),
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{label}</Badge>
                          {picked ? <Check className="size-4 text-green-600" /> : null}
                        </div>
                        <p className="mt-2 inline-flex rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
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
                  メモ: {adviceHint}
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

              {resultMode === "single" && variants.length === 3 ? (
                <div className="space-y-4 rounded-2xl border border-border/15 bg-muted/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">検証フィードバック</p>
                      <p className="mt-1 text-sm text-muted-foreground">反応を残すと、次回の精度向上に使われます。</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={quickFeedback === "hot" ? "default" : "outline"}
                        size="sm"
                        disabled={!currentId || feedbackSaving}
                        onClick={() => handleQuickFeedback("hot")}
                      >
                        反応あり
                      </Button>
                      <Button
                        type="button"
                        variant={quickFeedback === "cold" ? "default" : "outline"}
                        size="sm"
                        disabled={!currentId || feedbackSaving}
                        onClick={() => handleQuickFeedback("cold")}
                      >
                        刺さらず
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_auto] md:items-end">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground">いいね数</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={likesInput}
                        onChange={(event) => setLikesInput(event.target.value)}
                        className="h-10 w-full rounded-xl border-0 bg-muted/40 px-3 text-sm outline-none"
                        placeholder="例: 23"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground">検証メモ</span>
                      <Textarea
                        value={memoInput}
                        onChange={(event) => setMemoInput(event.target.value)}
                        className="min-h-10 resize-y border-0 bg-muted/40 shadow-none"
                        placeholder="投稿時間、反応の質、次に変えたい点など"
                      />
                    </label>
                    <Button type="button" variant="outline" disabled={!currentId || feedbackSaving} onClick={handleSaveValidationMemo}>
                      {feedbackSaving ? "保存中…" : "保存する"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 space-y-4 border-t border-border/15 bg-muted/15 px-5 py-4">
              <div className="rounded-xl bg-background/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground ring-1 ring-border/20">
                <span className="font-medium text-foreground">生存シミュレーション（参照）</span>
                ：このセットでデプロイした場合の検証レンジ目安として、次の観測スロットに余裕が生まれる想定を{" "}
                <span className="font-semibold tabular-nums text-foreground">+約{survivalBoostDays}日</span> と仮定しています（演出用の簡易モデルです）。
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setResultsModalOpen(false)}>
                  閉じて戦略を練り直す
                </Button>
                <Link
                  href="/vault"
                  onClick={() => setResultsModalOpen(false)}
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "inline-flex h-8 w-full items-center justify-center rounded-lg sm:w-auto",
                    "bg-linear-to-r from-fuchsia-600 via-violet-600 to-purple-600 text-white hover:from-fuchsia-500 hover:via-violet-500 hover:to-purple-500",
                  )}
                >
                  Vault で確認する
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
