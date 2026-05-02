"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Box, Compass, Filter, Heart, Megaphone, PenLine, Swords, X } from "lucide-react";

import { GenerationSkeleton } from "@/components/generation-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeHypothesisCanvas,
  DATA_SYNC_EVENT,
  ensureDemoWorkspace,
  fetchArchiveInsights,
  fetchCreditSummary,
  fetchGhostSettings,
  fetchUserProfile,
  generateTriple,
  saveGenerationRecord,
  type GenerateSeriesItem,
  type GenerateSeriesResponse,
  type StrategyGoal,
  type UsagePurpose,
} from "@/lib/api-client";
import { STRATEGY_GOAL_UI_LABELS } from "@/lib/strategy-goal";
import type { GenerationSeriesRecord } from "@/lib/types";
import { EMOTION_LABELS, type EmotionTone } from "@/lib/emotions";
import { parseEmotionFromQuery, readAndClearReuseSession } from "@/lib/reuse-session";
import {
  mergeStoredPlanBodyForStorage,
  readRoadmapDeployContext,
  writeRoadmapDeployContext,
  type RoadmapDeployContextV1,
} from "@/lib/roadmap-deploy";
import { SERIES_SLOT_CONFIG } from "@/lib/series";
import { getUsagePurposeStepRoleLines, type UsagePurposeKey } from "@/lib/usage-purpose-step-plan";
import { playSwitchClick } from "@/lib/switch-sound";
import { cn } from "@/lib/utils";

const CANVAS_PLACEHOLDER =
  "整理せず、そのままの言葉で教えてください";

/** Identity OFF 時に見せる「Vanilla」一般論のイメージ（同一 SEED の再生成ではない比較用コピー） */
const VANILLA_COMPARISON_ACTION_PLAN: readonly string[] = [
  "STEP 1では課題仮説を一言にし、最小の投稿または広告枠で初速の反応だけを取りにいきます。",
  "STEP 2では反応ログを眺め、問いと訴求を1点だけ修正して同じチャネルで再テストします。",
  "STEP 3では得られた学びを短く言語化し、次の投資判断に回すメモを1枚残します。",
];

const ENERGY_RGB_BY_EMOTION: Record<EmotionTone, string> = {
  empathy: "236, 72, 153",
  toxic: "220, 38, 38",
  mood: "124, 58, 237",
  useful: "8, 145, 178",
  minimal: "82, 82, 91",
};

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
    strategyGoal: "empathy",
  },
  {
    id: "pain-signal",
    label: "課題を武器にする検証",
    summary: "課題の強さを前面に出し、市場の違和感をあぶり出す",
    emotion: "toxic",
    intensity: 90,
    strategyGoal: "pain_point",
  },
  {
    id: "authority-proof",
    label: "論理を武器にする検証",
    summary: "論点を整理し、筋の良さで納得と反応を取る",
    emotion: "useful",
    intensity: 55,
    strategyGoal: "logic",
  },
];

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

/** 活用方法ごとのページ／カードのアクセント（枠・ヘッダー・環境光） */
const PURPOSE_SURFACE: Record<
  UsagePurpose,
  {
    topWash: string;
    purposeRadialRgb: string;
    cardBorder: string;
    headerWash: string;
    modalChrome: string;
    modalHeaderBar: string;
  }
> = {
  discovery: {
    topWash:
      "from-emerald-100/30 via-emerald-50/10 to-transparent dark:from-emerald-950/32 dark:via-emerald-950/12 dark:to-transparent",
    purposeRadialRgb: "52, 211, 153",
    cardBorder: "border-emerald-200/45 transition-[border-color] duration-500 ease-out dark:border-emerald-800/32",
    headerWash:
      "from-emerald-50/50 via-muted/28 to-teal-50/14 dark:from-emerald-950/24 dark:via-background/50 dark:to-teal-950/10",
    modalChrome:
      "border-emerald-200/55 ring-2 ring-emerald-400/18 ring-offset-2 ring-offset-background transition-[border-color,box-shadow] duration-500 dark:border-emerald-700/38 dark:ring-emerald-500/15 dark:ring-offset-background",
    modalHeaderBar:
      "from-emerald-50/90 via-background to-teal-50/32 dark:from-emerald-950/38 dark:via-background dark:to-teal-950/14",
  },
  blueprint: {
    topWash:
      "from-sky-100/28 via-sky-50/10 to-transparent dark:from-sky-950/30 dark:via-sky-950/12 dark:to-transparent",
    purposeRadialRgb: "56, 189, 248",
    cardBorder: "border-sky-200/45 transition-[border-color] duration-500 ease-out dark:border-sky-700/32",
    headerWash:
      "from-sky-50/48 via-muted/28 to-blue-50/14 dark:from-sky-950/24 dark:via-background/50 dark:to-blue-950/10",
    modalChrome:
      "border-sky-200/55 ring-2 ring-sky-400/18 ring-offset-2 ring-offset-background transition-[border-color,box-shadow] duration-500 dark:border-sky-700/38 dark:ring-sky-500/15 dark:ring-offset-background",
    modalHeaderBar:
      "from-sky-50/90 via-background to-blue-50/30 dark:from-sky-950/38 dark:via-background dark:to-blue-950/14",
  },
  refinement: {
    topWash:
      "from-orange-100/26 via-violet-100/14 to-transparent dark:from-orange-950/24 dark:via-violet-950/20 dark:to-transparent",
    purposeRadialRgb: "251, 146, 60",
    cardBorder: "border-orange-200/42 transition-[border-color] duration-500 ease-out dark:border-violet-600/36",
    headerWash:
      "from-orange-50/38 via-violet-50/28 to-fuchsia-50/12 dark:from-orange-950/18 dark:via-violet-950/18 dark:to-fuchsia-950/8",
    modalChrome:
      "border-orange-200/50 ring-2 ring-orange-400/16 ring-offset-2 ring-offset-background transition-[border-color,box-shadow] duration-500 dark:border-violet-600/42 dark:ring-violet-500/18 dark:ring-offset-background",
    modalHeaderBar:
      "from-orange-50/88 via-background to-violet-50/28 dark:from-orange-950/32 dark:via-background dark:to-violet-950/16",
  },
  communication: {
    topWash:
      "from-fuchsia-100/26 via-rose-50/10 to-transparent dark:from-fuchsia-950/28 dark:via-fuchsia-950/12 dark:to-transparent",
    purposeRadialRgb: "244, 114, 182",
    cardBorder: "border-fuchsia-200/42 transition-[border-color] duration-500 ease-out dark:border-fuchsia-800/28",
    headerWash:
      "from-fuchsia-50/42 via-muted/26 to-rose-50/14 dark:from-fuchsia-950/22 dark:via-background/48 dark:to-rose-950/10",
    modalChrome:
      "border-fuchsia-200/52 ring-2 ring-fuchsia-400/18 ring-offset-2 ring-offset-background transition-[border-color,box-shadow] duration-500 dark:border-fuchsia-700/35 dark:ring-fuchsia-500/15 dark:ring-offset-background",
    modalHeaderBar:
      "from-fuchsia-50/90 via-background to-rose-50/30 dark:from-fuchsia-950/36 dark:via-background dark:to-rose-950/14",
  },
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
  if (emotion === "useful") return "logic";
  if (emotion === "mood") return "pain_point";
  return "empathy";
}

/** 左カラム STEP 3 / 結果モーダル用。API の用途別3ステップ役割と整合 */
function buildPurposeAlignedStepRoadmap(
  purposeKey: UsagePurposeKey,
  weaponAxisLabel: string,
  emotionLabel: string,
) {
  const roles = [...getUsagePurposeStepRoleLines(purposeKey)];
  const goalHints: readonly [string, string, string] = [
    "市場に小さく見せ、初速の反応を取る",
    "観測と学びを、次の打ち手に反映する",
    "成果と反応を言語化し、次の検証ループへ繋げる",
  ];
  return roles.map((role, index) => ({
    rangeLabel: `STEP ${index + 1}`,
    role,
    focus: weaponAxisLabel,
    goal: goalHints[index]!,
    objective: `トーン: ${emotionLabel}`,
    detail: `API と同じ役割「${role}」の一歩を、生成の本文・すぐやることで具体化します。`,
  }));
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

type SeriesResult = GenerateSeriesResponse;

export function MainLabWorkspace() {
  const router = useRouter();
  const hasAppliedInitialOverridesRef = useRef(false);
  const prevHasLiveOutputRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [refinementAnswer, setRefinementAnswer] = useState("");
  const [strategyGoal, setStrategyGoal] = useState<StrategyGoal>("empathy");
  const [emotion, setEmotion] = useState<EmotionTone>("empathy");
  const [intensity, setIntensity] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesItems, setSeriesItems] = useState<GenerateSeriesItem[]>([]);
  const [adviceHint, setAdviceHint] = useState<string | null>(null);
  const [ghostWhisper, setGhostWhisper] = useState<string | null>(null);
  const [memoryTags, setMemoryTags] = useState<string[]>([]);
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
  const [identityFilterOn, setIdentityFilterOn] = useState(true);
  const [lastGenerationIdentityMode, setLastGenerationIdentityMode] = useState<"rich" | "vanilla">("rich");
  const [lastSavedSeries, setLastSavedSeries] = useState<GenerationSeriesRecord | null>(null);
  const [roadmapDeploySnap, setRoadmapDeploySnap] = useState<{ seriesId: string; planTitle: string } | null>(null);

  const energyGlow = ENERGY_RGB_BY_EMOTION[emotion];
  const currentGoalLabel = STRATEGY_GOAL_UI_LABELS[strategyGoal];
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
  const stepActionPreview = useMemo(
    () => [...getUsagePurposeStepRoleLines(usagePurposeId as UsagePurposeKey)],
    [usagePurposeId],
  );
  const activePurpose = USAGE_PURPOSE_TILES.find((tile) => tile.id === usagePurposeId) ?? USAGE_PURPOSE_TILES[0];
  const activeProtocol = PURPOSE_PROTOCOL[usagePurposeId];
  const purposeSurface = PURPOSE_SURFACE[usagePurposeId];
  const seriesRoadmap = useMemo(
    () =>
      buildPurposeAlignedStepRoadmap(
        usagePurposeId as UsagePurposeKey,
        currentGoalLabel,
        EMOTION_LABELS[emotion],
      ),
    [usagePurposeId, currentGoalLabel, emotion],
  );
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
        const baseSlot = SERIES_SLOT_CONFIG[index];
        const generated = seriesItems[index];

        return {
          ...phase,
          slot: baseSlot
            ? { ...baseSlot, title: phase.role, subtitle: `${phase.focus}・${phase.objective}` }
            : undefined,
          body: generated?.body ?? phase.detail,
          immediateAction: generated?.immediateAction ?? null,
          validationMetric: generated?.validationMetric ?? null,
          hashtags: generated?.hashtags ?? [],
          style: SPRINT_PHASE_STYLES[index] ?? SPRINT_PHASE_STYLES[0],
        };
      }),
    [seriesItems, seriesRoadmap],
  );
  const deployTitle = activeTemplate
    ? `${activeTemplate.label}でアクションプランを生成`
    : "武器（検証の型）を選んでから生成";
  const deployHint = activeTemplate
    ? `「${activePurpose.label}」×「${activeTemplate.label}」で、3ステップの行動計画を出します。`
    : `まず「${activePurpose.label}」の用途を確認し、武器（戦略）を選んでください。`;
  const deployOutputComposition = useMemo(() => {
    const purpose = activePurpose.label;
    const weapon = activeTemplate?.label;
    const nextActionCopy = "各ステップに「すぐやること」を必ず添えて提示";
    const depthCopy = weapon
      ? `「${purpose}」の3ステップ役割と「${weapon}」を軸に、アクションプラン（JSON）を生成`
      : `「${purpose}」の3ステップ役割でアクションプランを生成（武器を選ぶと切り口がより明確になります）`;
    return {
      coreConcept: weapon
        ? `「${weapon}」を軸に据えた「${purpose}」のアクションプラン`
        : `武器（検証の型）を軸に据えた「${purpose}」のアクションプラン`,
      thinkingDepth: depthCopy,
      nextAction: nextActionCopy,
    };
  }, [activePurpose.label, activeTemplate?.label]);
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

  const runGenerate = useCallback(async (options?: { intensityOverride?: number }) => {
    const requestedIntensity = options?.intensityOverride ?? intensity;
    const requestedSpeedMode = "flash";
    if (!storedSeed.trim()) return;
    setError(null);
    setLoading(true);
    setSeriesTitle("");
    setSeriesItems([]);
    setAdviceHint(null);
    setGhostWhisper(null);
    setMemoryTags([]);
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
        strategyGoal,
        usagePurpose: usagePurposeId,
        emotion,
        speedMode: requestedSpeedMode,
        intensity: requestedIntensity,
        identityMode: identityFilterOn ? "rich" : "vanilla",
        ngWords: ghost.ngWords,
        stylePrompt: ghost.stylePrompt.trim(),
        personaKeywords,
        personaSummary,
        whyMe: [
          refinementAnswer.trim(),
          `活用目的: ${activePurpose.label}（${activePurpose.phase}）。${activePurpose.summary}`,
          "3ステップのアクションプラン（行動計画）として設計したい",
          activeTemplate
            ? `優先したい切り口: ${STRATEGY_GOAL_UI_LABELS[activeTemplate.strategyGoal]}（${activeTemplate.label}）`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });

      const seriesData = data as SeriesResult;
      setSeriesTitle(seriesData.seriesTitle);
      setSeriesItems(seriesData.items);
      setAdviceHint(seriesData.adviceHint ?? null);
      setGhostWhisper(seriesData.ghostWhisper ?? null);
      setMemoryTags(seriesData.memoryTags ?? []);

      const row = await saveGenerationRecord({
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
          body: mergeStoredPlanBodyForStorage(item.body, item.immediateAction ?? ""),
          hashtags: item.hashtags,
        })),
      });
      if ("items" in row && row.generationMode === "series") {
        setLastSavedSeries(row);
      } else {
        setLastSavedSeries(null);
      }
      setLastGenerationIdentityMode(identityFilterOn ? "rich" : "vanilla");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, [
    emotion,
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
    identityFilterOn,
  ]);

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

  const handleDiscardGeneratedPlan = useCallback(() => {
    setResultsModalOpen(false);
    setSeriesItems([]);
    setSeriesTitle("");
    setAdviceHint(null);
    setGhostWhisper(null);
    setMemoryTags([]);
    setLastSavedSeries(null);
    setError(null);
    playSwitchClick();
  }, []);

  const columnCardClass =
    "flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border bg-white/95 shadow-[0_20px_55px_-44px_rgba(15,23,42,0.18)] dark:bg-background/94";
  const columnHeaderBase =
    "shrink-0 border-b border-border/20 bg-linear-to-r px-4 py-3 transition-[background-image] duration-500 ease-out";
  const columnBodyClass =
    "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 [scrollbar-gutter:stable]";
  const outputBodyClass =
    "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 [scrollbar-gutter:stable]";
  const laneDividerClass = "border-t border-border/15 pt-4";
  const hasLiveOutput = seriesItems.length === 3;
  const alignmentPercent =
    dnaAlignment == null ? null : Math.min(100, Math.max(0, Math.round(dnaAlignment)));
  const canDeploy = Boolean(storedSeed.trim()) && !uploading && !loading && activeTemplate != null;

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

  const handleDeployToRoadmap = useCallback(() => {
    if (!lastSavedSeries) return;
    const payload: RoadmapDeployContextV1 = {
      v: 1,
      seriesId: lastSavedSeries.id,
      planTitle: lastSavedSeries.title,
      usagePurposeLabel: activePurpose.label,
      usagePurposePhase: activePurpose.phase,
      weaponLabel: activeTemplate?.label ?? "",
      firstAction: activeProtocol.firstAction,
      finalGoal: activeProtocol.finalGoal,
      protocolLines: activeProtocol.modalLines.map((entry) => ({
        hat: entry.hat,
        short: HAT_META[entry.hat].short,
        line: entry.line,
      })),
      dnaAlignmentReason,
      identityResonancePercent,
      deployedAt: new Date().toISOString(),
    };
    writeRoadmapDeployContext(payload);
    setRoadmapDeploySnap({ seriesId: lastSavedSeries.id, planTitle: lastSavedSeries.title });
    setResultsModalOpen(false);
    router.push(`/roadmap?series=${lastSavedSeries.id}`);
  }, [
    activePurpose.label,
    activePurpose.phase,
    activeProtocol,
    activeTemplate?.label,
    dnaAlignmentReason,
    identityResonancePercent,
    lastSavedSeries,
    router,
  ]);

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

  useEffect(() => {
    const syncRoadmapSnap = () => {
      const ctx = readRoadmapDeployContext();
      setRoadmapDeploySnap(ctx ? { seriesId: ctx.seriesId, planTitle: ctx.planTitle } : null);
    };
    syncRoadmapSnap();
    window.addEventListener(DATA_SYNC_EVENT, syncRoadmapSnap);
    return () => window.removeEventListener(DATA_SYNC_EVENT, syncRoadmapSnap);
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-zinc-50 transition-colors duration-500 ease-out dark:bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-32 bg-linear-to-b to-transparent transition-all duration-500 ease-out",
            purposeSurface.topWash,
          )}
        />
        <div
          className="absolute inset-0 opacity-[0.13] transition-opacity duration-500 ease-out dark:opacity-[0.11]"
          style={{
            background: `radial-gradient(ellipse 88% 44% at 50% -10%, rgba(${purposeSurface.purposeRadialRgb}, 0.32), transparent 56%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12] transition-opacity duration-500 dark:opacity-[0.1]"
          style={{
            background: `radial-gradient(ellipse 90% 45% at 50% -10%, rgba(${energyGlow}, 0.35), transparent 55%)`,
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 pb-4 pt-5 md:px-6 md:pt-8 xl:px-8 2xl:px-10 lg:h-[calc(100vh-4rem)]">
        <div className="flex flex-1 min-h-0 flex-col gap-4">
          <div className="grid flex-1 min-h-0 gap-5 lg:h-full lg:grid-cols-[minmax(280px,1fr)_minmax(440px,1.65fr)_minmax(320px,1.2fr)] lg:items-start xl:gap-6 xl:grid-cols-[minmax(300px,1fr)_minmax(520px,1.65fr)_minmax(340px,1.2fr)] 2xl:grid-cols-[minmax(320px,1fr)_minmax(580px,1.65fr)_minmax(360px,1.2fr)]">
              <section className={cn(columnCardClass, purposeSurface.cardBorder)}>
                <div className={cn(columnHeaderBase, purposeSurface.headerWash)}>
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

              <section className={cn(columnCardClass, purposeSurface.cardBorder, "flex min-h-0 flex-col")}>
                <div className={cn(columnHeaderBase, purposeSurface.headerWash)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold tracking-tight text-foreground">STRATEGY</p>
                      <p className="text-xs text-muted-foreground">目的 → 武器（戦略）→ アクションプラン</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {loading ? (
                        <Badge className="animate-pulse rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] text-white">検証中</Badge>
                      ) : null}
                      <Badge variant="outline" className="rounded-full border-amber-200/60 bg-amber-50/80 text-[10px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
                        {activePurpose.label}
                      </Badge>
                      {activeTemplate ? (
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {activeTemplate.label}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          アクションプラン
                        </Badge>
                      )}
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

                {canChooseSprint ? (
                  <div className={laneDividerClass}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground">STEP 3</p>
                        <p className="text-sm font-medium">3ステップの実行の流れ</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">生成で肉付け</p>
                    </div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-3">
                      {sprintTimelinePhases.map((phase) => (
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
                          {archiveRecommendation.emotion || archiveRecommendation.intensity != null ? (
                            <Button type="button" variant="ghost" size="sm" onClick={applyArchiveRecommendationPreset} className="h-7 px-2 text-xs">
                              保存する
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                </div>
              </section>

              <section className={cn(columnCardClass, purposeSurface.cardBorder, "flex flex-col")}>
                <div className={cn(columnHeaderBase, purposeSurface.headerWash)}>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tracking-tight text-foreground">LIVE OUTPUT</p>
                        <p className="text-sm text-muted-foreground">
                          Lab は作戦の錬成、Roadmap は実行と検証記録。生成後はモーダルで「作戦の契約書」を確認します。
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div
                          className="inline-flex items-center gap-1 rounded-full border border-border/35 bg-background/70 p-0.5 shadow-sm"
                          title="OFF ではペルソナ・DNA・成功メモを外し、比較用の浅い一般論寄りの出力になります。"
                        >
                          <Filter className="ml-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">Filter</span>
                          <button
                            type="button"
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                              identityFilterOn
                                ? "bg-violet-600 text-white shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            aria-pressed={identityFilterOn}
                            onClick={() => {
                              playSwitchClick();
                              setIdentityFilterOn(true);
                            }}
                          >
                            ON
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "mr-0.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                              !identityFilterOn
                                ? "bg-zinc-600 text-white shadow-sm dark:bg-zinc-500"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            aria-pressed={!identityFilterOn}
                            onClick={() => {
                              playSwitchClick();
                              setIdentityFilterOn(false);
                            }}
                          >
                            OFF
                          </button>
                        </div>
                        <Badge variant="outline" className="shrink-0 rounded-full border-border/35 text-[10px] text-muted-foreground">
                          アクション
                        </Badge>
                      </div>
                    </div>
                    {!identityFilterOn ? (
                      <p className="text-[10px] leading-relaxed text-amber-800/90 dark:text-amber-200/85">
                        Identity Filter OFF：次の「生成する」は比較用（Vanilla）。レポートは浅い一般論寄りになります。
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                <div className={cn(outputBodyClass, "space-y-4")}>
                  <div className="space-y-4">
                    {!loading && roadmapDeploySnap ? (
                      <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-emerald-900/45 dark:bg-emerald-950/20">
                        <p className="text-[11px] font-semibold tracking-wide text-emerald-900 dark:text-emerald-100">
                          Roadmap ステータス
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">
                          現在、Roadmap にて作戦
                          <span className="mx-1 font-semibold text-violet-700 dark:text-violet-200">
                            「{roadmapDeploySnap.planTitle}」
                          </span>
                          を実行中です。検証フィードバックは Roadmap で入力してください。
                        </p>
                        {hasLiveOutput && lastSavedSeries?.id !== roadmapDeploySnap.seriesId ? (
                          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                            ※ Lab に別の生成結果が表示されています。Roadmap のアクティブを切り替えるには、モーダルで新しい作戦をデプロイしてください。
                          </p>
                        ) : null}
                        <Link
                          href={`/roadmap?series=${roadmapDeploySnap.seriesId}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "mt-3 inline-flex",
                          )}
                        >
                          Roadmap を開く
                        </Link>
                      </div>
                    ) : null}

                    {!loading && hasLiveOutput && !roadmapDeploySnap ? (
                      <div className="rounded-2xl border border-amber-200/55 bg-amber-50/30 p-4 dark:border-amber-800/40 dark:bg-amber-950/15">
                        <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-100">作戦は未デプロイ</p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">
                          モーダルで「作戦の契約書」を確認し、Roadmap へ送るか破棄するかを決めてください。
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => setResultsModalOpen(true)}
                        >
                          作戦の契約書を開く
                        </Button>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-border/15 bg-background/50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                          AI Analysis Protocol（3ステップの役割）
                        </p>
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          {activePurpose.phase}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        「{activePurpose.label}」では、次の3ステップでアクションプランを出力します（API の指示と同じ役割です）。
                      </p>
                      <div className="mt-3 grid gap-2">
                        {stepActionPreview.map((role, index) => (
                          <div
                            key={`${usagePurposeId}-${index}`}
                            className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-muted/12 px-3 py-2.5"
                          >
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                              {index + 1}
                            </span>
                            <span className="text-xs font-medium text-foreground/90">STEP {index + 1}: {role}</span>
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

                    {!identityFilterOn ? (
                      <div className="rounded-2xl border border-dashed border-border/40 bg-muted/10 p-4">
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">Vanilla 比較（イメージ）</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                          Identity を外したときに寄りやすい「どこにでも置ける」抽象案の雰囲気です（下の例は現在の種とは未連動の定型）。OFF
                          のまま生成すると、API が同じ方針で実データを返します。
                        </p>
                        <ul className="mt-3 space-y-2">
                          {VANILLA_COMPARISON_ACTION_PLAN.map((line, i) => (
                            <li
                              key={i}
                              className="text-xs leading-relaxed text-muted-foreground/70 text-pretty dark:text-muted-foreground/65"
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {!loading && hasLiveOutput && identityFilterOn && !resultsModalOpen ? (
                      <div className="rounded-2xl border border-dashed border-amber-200/55 bg-amber-50/25 p-4 dark:border-amber-800/40 dark:bg-amber-950/15">
                        <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-100">Vanilla 比較メモ</p>
                        {lastGenerationIdentityMode === "vanilla" ? (
                          <p className="mt-1 text-xs leading-relaxed text-amber-950/85 dark:text-amber-100/85">
                            直近の生成は Identity Filter OFF です。モーダル内が「浅い一般論寄り」の比較出力になっています。
                          </p>
                        ) : (
                          <p className="mt-1 text-xs leading-relaxed text-amber-950/85 dark:text-amber-100/85">
                            直近のレポートは Identity ON で生成されています。OFF
                            の出力と並べて比較するには、OFF に切り替えてからもう一度「生成する」を押してください。
                          </p>
                        )}
                        <ul className="mt-3 space-y-1.5 opacity-60">
                          {VANILLA_COMPARISON_ACTION_PLAN.map((line, i) => (
                            <li key={i} className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <GenerationSkeleton />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
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
                        void runGenerate();
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
            className={cn(
              "relative z-1 flex max-h-[min(92dvh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border bg-background shadow-[0_-32px_90px_-40px_rgba(0,0,0,0.45)] sm:rounded-[28px] sm:shadow-[0_40px_120px_-48px_rgba(0,0,0,0.55)]",
              purposeSurface.modalChrome,
            )}
          >
            <div
              className={cn(
                "shrink-0 border-b border-border/15 bg-linear-to-r px-5 pb-4 pt-5 transition-[background-image] duration-500",
                purposeSurface.modalHeaderBar,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-background/90 text-violet-700 shadow-sm ring-1 ring-border/35 dark:text-violet-200">
                    {activeTemplateId ? (
                      <span className="grid place-items-center [&_svg]:size-5">{STRATEGY_TILE_META[activeTemplateId].icon}</span>
                    ) : (
                      <BookOpen className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2 id="lab-results-modal-title" className="text-lg font-semibold tracking-tight text-foreground">
                      作戦の契約書
                    </h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      この作戦で本当に Roadmap（戦地）へ赴くか、ここでジャッジしてください。
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground/90">活用: {activePurpose.label}</span>
                      <span className="text-muted-foreground/80"> · </span>
                      <span className="font-medium text-foreground/90">
                        武器: {activeTemplate?.label ?? "検証の型"}
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
                    {lastGenerationIdentityMode === "vanilla" ? (
                      <p className="mt-2 rounded-lg border border-amber-200/70 bg-amber-50/90 px-3 py-2 text-[10px] leading-relaxed text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
                        この生成は <span className="font-semibold">Identity Filter OFF（Vanilla 比較）</span>
                        です。本文はペルソナ・DNA・成功メモを外した浅い一般論寄りの出力です。磨き込むには{" "}
                        <Link href="/identity" className="font-semibold underline underline-offset-2">
                          Identity
                        </Link>{" "}
                        で DNA を整え、Filter を ON にして再生成してください。
                      </p>
                    ) : null}
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
              {lastGenerationIdentityMode === "vanilla" ? (
                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/90 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
                  <p className="text-[11px] font-semibold tracking-wide text-amber-900 dark:text-amber-100">Vanilla 比較メモ</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-950/90 dark:text-amber-100/90">
                    この生成は <span className="font-semibold">Identity Filter OFF（Vanilla 比較）</span>
                    です。本文はペルソナ・DNA・成功メモを外した浅い一般論寄りの出力です。磨き込むには{" "}
                    <Link href="/identity" className="font-semibold underline underline-offset-2">
                      Identity
                    </Link>{" "}
                    で DNA を整え、Filter を ON にして再生成してください。
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/15 bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">ハット視点レポート</p>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {activePurpose.label}
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  下の「3ステップの行動計画」が API の本体です。ハットは読み解き用の補助イメージです。
                </p>
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

              <div className="space-y-4">
                <div className="rounded-2xl bg-muted/25 p-4">
                  <p className="text-sm font-medium text-muted-foreground">プラン名</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{seriesTitle}</p>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">3ステップの行動計画</p>
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
                          {phase.immediateAction ? (
                            <div className="mt-3 border-l-2 border-violet-300/60 pl-3 dark:border-violet-700/50">
                              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">すぐやること</p>
                              <p className="mt-1 text-xs font-medium text-foreground">{phase.immediateAction}</p>
                            </div>
                          ) : null}
                          {item?.validationMetric ? (
                            <div className="mt-3 border-l-2 border-dashed border-border/50 pl-3">
                              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">成功指標</p>
                              <p className="mt-1 text-xs text-muted-foreground">{item.validationMetric}</p>
                            </div>
                          ) : null}
                          {item?.hashtags && item.hashtags.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {item.hashtags.map((tag) => (
                                <Badge key={tag} variant="outline" className="rounded-full text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

            <div className="shrink-0 border-t border-border/15 bg-muted/15 px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={handleDiscardGeneratedPlan}>
                  この作戦を破棄する（戦略を練り直す）
                </Button>
                <Button
                  type="button"
                  disabled={!lastSavedSeries}
                  onClick={() => handleDeployToRoadmap()}
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "h-8 w-full sm:w-auto",
                    "bg-linear-to-r from-fuchsia-600 via-violet-600 to-purple-600 text-white hover:from-fuchsia-500 hover:via-violet-500 hover:to-purple-500",
                  )}
                >
                  Roadmap にデプロイする
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
