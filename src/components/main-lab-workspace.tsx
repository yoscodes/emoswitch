"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Box,
  CircleHelp,
  Compass,
  Heart,
  Loader2,
  Megaphone,
  Mic,
  PenLine,
  MoveRight,
  Save,
  Swords,
  X,
} from "lucide-react";

import { GenerationSkeleton } from "@/components/generation-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeHypothesisCanvas,
  ensureDemoWorkspace,
  fetchCreditSummary,
  fetchGhostSettings,
  fetchUserProfile,
  generateTriple,
  organizeScrapDraft,
  patchSeriesConceptBrief,
  saveGenerationRecord,
  transcribeAudioFile,
  type GenerateSeriesItem,
  type GenerateSeriesResponse,
  type StrategyGoal,
  type UsagePurpose,
} from "@/lib/api-client";
import { STRATEGY_GOAL_UI_LABELS } from "@/lib/strategy-goal";
import type { ConceptBrief, GenerationSeriesRecord } from "@/lib/types";
import { EMOTION_LABELS, type EmotionTone } from "@/lib/emotions";
import { DATA_SYNC_EVENT } from "@/lib/data-sync";
import {
  parseEmotionFromQuery,
  readAndClearReuseSession,
} from "@/lib/reuse-session";
import {
  formatIdentityFieldBufferForLabScrap,
  mergeStoredPlanBodyForStorage,
  readIdentityFieldLog,
  writeRoadmapDeployContext,
  type RoadmapDeployContextV1,
} from "@/lib/roadmap-deploy";
import { SERIES_SLOT_CONFIG, sortSeriesLikeItemsBySlotOrder } from "@/lib/series";
import {
  getUsagePurposePreviewGoalByStep,
  getUsagePurposeStepRoleLines,
  USAGE_PURPOSE_PHASE_PLAN,
  type UsagePurposeKey,
} from "@/lib/usage-purpose-step-plan";
import {
  getStructuredSheetHints,
  STRUCTURED_SHEET_LABELS,
} from "@/lib/structured-sheet-hints";
import { playSwitchClick } from "@/lib/switch-sound";
import { cn } from "@/lib/utils";

const CANVAS_PLACEHOLDER =
  "整理せず、そのままの言葉で。解像度シートであとから磨けます";

/** scrap-organize API と揃える（これ未満ではゴースト抽出を呼ばない） */
const SCRAP_GHOST_MIN_CHARS = 80;
const SCRAP_GHOST_DEBOUNCE_MS = 900;

/** シート各欄: 長い「例」とプレースホルダが二重にならないよう短い固定文言にする */
const SHEET_TEXTAREA_PLACEHOLDER =
  "手入力するか、上の「AI 提案」をタップして確定";

/** 「?」クリックで body に固定配置のヒント（オーバーフロークリップ回避）。ホバーは title で短文プレビュー */
function LabSheetHintButton({
  label,
  hint,
  example,
}: {
  label: string;
  hint: string;
  example?: string;
}) {
  const popoverId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, width: 288, flipUp: false });

  const previewTitle =
    `${hint}${example ? `\n例：${example}` : ""}`.slice(0, 280) +
    (hint.length + (example?.length ?? 0) > 280 ? "…" : "");

  const updatePosition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(288, Math.max(220, window.innerWidth - 24));
    let left = r.left;
    if (left + w > window.innerWidth - 12) left = Math.max(12, window.innerWidth - 12 - w);
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const flipUp = spaceBelow < 120 && r.top > 140;
    const top = flipUp ? r.top - 6 : r.bottom + 6;
    setBox({ top, left, width: w, flipUp });
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(updatePosition);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onScroll, true);
    const onResize = () => updatePosition();
    window.addEventListener("resize", onResize);
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocMouseDown);
    }, 0);
    function onDocMouseDown(e: MouseEvent) {
      const node = e.target as Node;
      if (btnRef.current?.contains(node)) return;
      if (panelRef.current?.contains(node)) return;
      setOpen(false);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-expanded={open}
        aria-controls={popoverId}
        title={previewTitle}
        aria-label={`${label}（ヒントを開く）`}
        onClick={() => {
          if (open) setOpen(false);
          else {
            updatePosition();
            setOpen(true);
          }
        }}
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={popoverId}
              role="tooltip"
              className="fixed z-[300] max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-background/98 px-3 py-2 text-[10px] leading-relaxed shadow-xl backdrop-blur-sm dark:bg-background/95"
              style={{
                top: box.top,
                left: box.left,
                width: box.width,
                transform: box.flipUp ? "translateY(-100%)" : undefined,
              }}
            >
              <p className="font-medium text-foreground/90">{label}</p>
              <p className="mt-1 text-muted-foreground">{hint}</p>
              {example ? (
                <p className="mt-1.5 border-t border-border/25 pt-1.5 text-muted-foreground/95">
                  例：{example}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const ENERGY_RGB_BY_EMOTION: Record<EmotionTone, string> = {
  empathy: "236, 72, 153",
  toxic: "220, 38, 38",
  mood: "124, 58, 237",
  useful: "8, 145, 178",
  minimal: "82, 82, 91",
};

type StrategyTemplateId = "validation" | "pain-signal" | "authority-proof";

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

/** 武器選択時に Protocol で見せる 3STEP の短い見出し（PHASE 由来の役割行と併用） */
const WEAPON_PROTOCOL_STEP_LABELS: Record<
  StrategyTemplateId,
  readonly [string, string, string]
> = {
  validation: [
    "共鳴の仮説を一言に",
    "小さな打ち手で反応を見る",
    "次の声掛けに反映",
  ],
  "pain-signal": [
    "痛みの芯を言語化",
    "違和のシグナルを取る",
    "刺さりの改善を一歩",
  ],
  "authority-proof": [
    "論点と根拠の並べ方",
    "納得の階段を積む",
    "次の説得アクション",
  ],
};

/** DEPLOY 1行サマリ用の武器の短称（ヘッダーバッジと対応） */
const WEAPON_DEPLOY_SHORT: Record<StrategyTemplateId, string> = {
  validation: "共感",
  "pain-signal": "課題",
  "authority-proof": "論理",
};

const USAGE_PURPOSE_TILES: Array<{
  id: UsagePurpose;
  label: string;
  phase: string;
  summary: string;
}> = (["discovery", "blueprint", "refinement", "communication"] as const satisfies readonly UsagePurpose[]).map(
  (id) => {
    const p = USAGE_PURPOSE_PHASE_PLAN[id];
    return { id, label: p.tileLabel, phase: p.tilePhase, summary: p.tileSummary };
  },
);

const USAGE_PURPOSE_TILE_META: Record<
  UsagePurpose,
  { icon: React.ReactElement }
> = {
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
    cardBorder:
      "border-emerald-200/45 transition-[border-color] duration-500 ease-out dark:border-emerald-800/32",
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
    cardBorder:
      "border-sky-200/45 transition-[border-color] duration-500 ease-out dark:border-sky-700/32",
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
    cardBorder:
      "border-orange-200/42 transition-[border-color] duration-500 ease-out dark:border-violet-600/36",
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
    cardBorder:
      "border-fuchsia-200/42 transition-[border-color] duration-500 ease-out dark:border-fuchsia-800/28",
    headerWash:
      "from-fuchsia-50/42 via-muted/26 to-rose-50/14 dark:from-fuchsia-950/22 dark:via-background/48 dark:to-rose-950/10",
    modalChrome:
      "border-fuchsia-200/52 ring-2 ring-fuchsia-400/18 ring-offset-2 ring-offset-background transition-[border-color,box-shadow] duration-500 dark:border-fuchsia-700/35 dark:ring-fuchsia-500/15 dark:ring-offset-background",
    modalHeaderBar:
      "from-fuchsia-50/90 via-background to-rose-50/30 dark:from-fuchsia-950/36 dark:via-background dark:to-rose-950/14",
  },
};

type HatTone = "white" | "red" | "black" | "yellow" | "green" | "purple";

const HAT_META: Record<HatTone, { label: string; short: string; dot: string }> =
  {
    white: {
      label: "白",
      short: "事実",
      dot: "bg-zinc-100 border border-zinc-300 text-zinc-700",
    },
    red: { label: "赤", short: "感情", dot: "bg-rose-500/90 text-white" },
    black: { label: "黒", short: "リスク", dot: "bg-zinc-900 text-white" },
    yellow: { label: "黄", short: "機会", dot: "bg-amber-400 text-amber-950" },
    green: { label: "緑", short: "創造", dot: "bg-emerald-500/90 text-white" },
    purple: {
      label: "紫",
      short: "常識破壊",
      dot: "bg-violet-500/90 text-white",
    },
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
    ...USAGE_PURPOSE_PHASE_PLAN.discovery.protocol,
    hats: ["white", "red", "black", "yellow", "green", "purple"],
    modalLines: [
      {
        hat: "black",
        line: "この仮説は導入障壁が高く、初回接点で離脱するリスクがあります。",
      },
      {
        hat: "yellow",
        line: "痛みの共感導線が強いため、刺さる層では高い反応率が期待できます。",
      },
      {
        hat: "green",
        line: "既存の比較軸をずらし、別の価値基準で語ると独自性が立ちます。",
      },
    ],
  },
  blueprint: {
    ...USAGE_PURPOSE_PHASE_PLAN.blueprint.protocol,
    hats: ["white", "black", "yellow", "green", "purple", "red"],
    modalLines: [
      {
        hat: "black",
        line: "提供価値の境界が曖昧だと、既存サービスとの差別化が埋もれます。",
      },
      {
        hat: "yellow",
        line: "利用後の未来像が明確なので、コンセプトの納得が取りやすいです。",
      },
      {
        hat: "green",
        line: "提供順序を再設計すると、最小構成でも強い体験を作れます。",
      },
    ],
  },
  refinement: {
    ...USAGE_PURPOSE_PHASE_PLAN.refinement.protocol,
    hats: ["black", "white", "red", "yellow", "green", "purple"],
    modalLines: [
      {
        hat: "black",
        line: "顧客像が広すぎるため、誰に刺さる仮説かの輪郭が薄くなっています。",
      },
      {
        hat: "yellow",
        line: "対象を絞れば、検証コストを抑えつつ反応の質を上げられます。",
      },
      {
        hat: "green",
        line: "失敗シナリオを先に公開する構成にすると、信頼と反応を同時に取れます。",
      },
    ],
  },
  communication: {
    ...USAGE_PURPOSE_PHASE_PLAN.communication.protocol,
    hats: ["red", "white", "yellow", "black", "green", "purple"],
    modalLines: [
      {
        hat: "black",
        line: "言い回しが抽象寄りで、行動に落ちる一歩が見えにくいです。",
      },
      {
        hat: "yellow",
        line: "ベネフィットの即時性が高く、初見でも価値が伝わりやすいです。",
      },
      {
        hat: "green",
        line: "比喩を1つ加えると記憶に残り、シェアされる確率が上がります。",
      },
    ],
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
  const goalHints = getUsagePurposePreviewGoalByStep(purposeKey);
  return roles.map((role, index) => ({
    rangeLabel: `STEP ${index + 1}`,
    role,
    focus: weaponAxisLabel,
    goal: goalHints[index]!,
    objective: `トーン: ${emotionLabel}`,
    detail: `API と同じ役割「${role}」の一歩を、生成の本文・すぐやることで具体化します。`,
  }));
}

const STRATEGY_TILE_META: Record<
  StrategyTemplateId,
  { icon: React.ReactElement }
> = {
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
  firstExperiment: string;
  whyNow: string;
  whyMe: string;
}) {
  const sections = [
    params.draft.trim() ? `下書き（Scrap）:\n${params.draft.trim()}` : null,
    params.audience.trim()
      ? `誰に？（行動ベースで絞る）:\n${params.audience.trim()}`
      : null,
    params.pain.trim()
      ? `どんな悩み？（すでに解決行動してるかまで）:\n${params.pain.trim()}`
      : null,
    params.firstExperiment.trim()
      ? `どんな価値をどうやって手動で届ける？（48時間以内）:\n${params.firstExperiment.trim()}`
      : null,
    params.whyNow.trim()
      ? `なぜ今やるのか？（緊急性）:\n${params.whyNow.trim()}`
      : null,
    params.whyMe.trim() ? `AIへの追加回答:\n${params.whyMe.trim()}` : null,
  ].filter(Boolean);

  return sections.join("\n\n");
}

type SeriesResult = GenerateSeriesResponse;

type ConceptBriefTransformKey = "customer" | "investor" | "cofounder" | "lp";

const CONCEPT_BRIEF_TRANSFORM_LABELS: Record<ConceptBriefTransformKey, string> = {
  customer: "顧客向け説明",
  investor: "投資家向け説明",
  cofounder: "共同創業者向け説明",
  lp: "LP見出し",
};

function buildConceptBriefTransform(brief: ConceptBrief, key: ConceptBriefTransformKey): string {
  if (key === "customer") {
    return `${brief.audience} の「${brief.pain}」を、${brief.valueProposition} で解決します。まずは ${brief.mvp} から体験できます。`;
  }
  if (key === "investor") {
    return `${brief.oneLiner}。対象は ${brief.audience}。未充足は ${brief.pain} で、初期MVPは ${brief.mvp}。代替手段との差分は ${brief.differentiator}。今取り組む理由は ${brief.whyNow} です。`;
  }
  if (key === "cofounder") {
    return `${brief.whyMe} という必然性を起点に、${brief.audience} の課題を一緒に形にしたいです。まず ${brief.mvp} で価値の核を確かめます。`;
  }
  return `${brief.oneLiner}\n${brief.valueProposition}\n${brief.differentiator}`;
}

type SeedGhostSlots = {
  audience: string;
  pain: string;
  firstExperiment: string;
  whyNow: string;
};

const EMPTY_SEED_GHOST: SeedGhostSlots = {
  audience: "",
  pain: "",
  firstExperiment: "",
  whyNow: "",
};

function SeedGhostPick({
  ghostText,
  fieldEmpty,
  disabled,
  onPick,
}: {
  ghostText: string;
  fieldEmpty: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  if (!fieldEmpty || !ghostText.trim()) return null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="group w-full rounded-xl border border-dashed border-violet-300/35 bg-violet-500/[0.04] px-3 py-2.5 text-left transition-colors hover:border-violet-400/50 hover:bg-violet-500/[0.07] disabled:pointer-events-none disabled:opacity-50 dark:border-violet-500/25 dark:bg-violet-950/25 dark:hover:border-violet-400/40"
    >
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground/80">
        Scrap からの AI 提案（クリックでこの欄に確定）
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground/50 group-hover:text-muted-foreground/65">
        {ghostText}
      </p>
    </button>
  );
}

export function MainLabWorkspace() {
  const router = useRouter();
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const hasAppliedInitialOverridesRef = useRef(false);
  const prevHasLiveOutputRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [seedAudience, setSeedAudience] = useState("");
  const [seedPain, setSeedPain] = useState("");
  const [seedFirstExperiment, setSeedFirstExperiment] = useState("");
  const [seedWhyNow, setSeedWhyNow] = useState("");
  /** 客観シート外の「ワガママ」指示。generate / 仮説キャンバスへ whyMe 系として渡す */
  const [refinementAnswer, setRefinementAnswer] = useState("");
  const [strategyGoal, setStrategyGoal] = useState<StrategyGoal>("empathy");
  const [emotion, setEmotion] = useState<EmotionTone>("empathy");
  const [intensity, setIntensity] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesItems, setSeriesItems] = useState<GenerateSeriesItem[]>([]);
  const [conceptBrief, setConceptBrief] = useState<ConceptBrief | null>(null);
  const [briefDraft, setBriefDraft] = useState<ConceptBrief | null>(null);
  const [briefSaving, setBriefSaving] = useState(false);
  const [audioTranscribing, setAudioTranscribing] = useState(false);
  const [personaKeywords, setPersonaKeywords] = useState<string[]>([]);
  const [personaSummary, setPersonaSummary] = useState("");
  const [personaStatus, setPersonaStatus] = useState<
    "empty" | "draft" | "approved"
  >("empty");
  const [manualPosts, setManualPosts] = useState<string[]>([]);
  const [activeTemplateId, setActiveTemplateId] =
    useState<StrategyTemplateId | null>(null);
  const [usagePurposeId, setUsagePurposeId] =
    useState<UsagePurpose>("discovery");
  const [dnaAlignment, setDnaAlignment] = useState<number | null>(null);
  const [dnaAlignmentReason, setDnaAlignmentReason] = useState<string | null>(
    null,
  );
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [lastSavedSeries, setLastSavedSeries] =
    useState<GenerationSeriesRecord | null>(null);
  const [seedGhost, setSeedGhost] = useState<SeedGhostSlots>(EMPTY_SEED_GHOST);
  const [scrapGhostLoading, setScrapGhostLoading] = useState(false);
  const scrapGhostRunRef = useRef(0);
  const [roadmapBufferCount, setRoadmapBufferCount] = useState(0);
  const [aiSheetProvisional, setAiSheetProvisional] = useState<{
    audience: boolean;
    pain: boolean;
    firstExperiment: boolean;
    whyNow: boolean;
  }>({
    audience: false,
    pain: false,
    firstExperiment: false,
    whyNow: false,
  });

  const energyGlow = ENERGY_RGB_BY_EMOTION[emotion];
  const currentGoalLabel = STRATEGY_GOAL_UI_LABELS[strategyGoal];
  const trimmedDraft = draft.trim();
  const storedSeed = useMemo(
    () =>
      buildOpportunitySeed({
        draft,
        audience: seedAudience,
        pain: seedPain,
        firstExperiment: seedFirstExperiment,
        whyNow: seedWhyNow,
        whyMe: refinementAnswer,
      }),
    [
      draft,
      seedAudience,
      seedPain,
      seedFirstExperiment,
      seedWhyNow,
      refinementAnswer,
    ],
  );
  const seedSlotFillCount = useMemo(
    () =>
      [
        draft,
        seedAudience,
        seedPain,
        seedFirstExperiment,
        seedWhyNow,
        refinementAnswer,
      ].filter((s) => s.trim()).length,
    [
      draft,
      seedAudience,
      seedPain,
      seedFirstExperiment,
      seedWhyNow,
      refinementAnswer,
    ],
  );
  const seedSlotFillTotal = 6;
  const inputCompletionCount = seedSlotFillCount;
  const inputCompletionTotal = seedSlotFillTotal;
  const seedReadinessPercent = Math.min(
    100,
    Math.round((inputCompletionCount / inputCompletionTotal) * 100),
  );
  const strategyMatrixTiles = STRATEGY_TEMPLATES;
  const activeTemplate =
    STRATEGY_TEMPLATES.find((template) => template.id === activeTemplateId) ??
    null;
  const vaultReactionSlots = PURPOSE_VAULT_SLOTS[usagePurposeId];
  const stepActionPreview = useMemo(
    () => [...getUsagePurposeStepRoleLines(usagePurposeId as UsagePurposeKey)],
    [usagePurposeId],
  );
  const protocolStepRows = useMemo(() => {
    if (activeTemplateId) {
      const labels = WEAPON_PROTOCOL_STEP_LABELS[activeTemplateId];
      return labels.map((primary, index) => ({
        primary,
        sub: stepActionPreview[index] ?? "",
      }));
    }
    return stepActionPreview.map((role) => ({
      primary: role,
      sub: "" as string,
    }));
  }, [activeTemplateId, stepActionPreview]);
  const activePurpose =
    USAGE_PURPOSE_TILES.find((tile) => tile.id === usagePurposeId) ??
    USAGE_PURPOSE_TILES[0];
  const structuredSheetHints = useMemo(
    () => getStructuredSheetHints(usagePurposeId),
    [usagePurposeId],
  );
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
  const identityExtractionPercent = useMemo(() => {
    const kw = personaKeywords?.length ?? 0;
    const sum = personaSummary?.trim() ? 1 : 0;
    const choiceLines = manualPosts.filter((line) =>
      line.startsWith("dna_choice|"),
    ).length;
    let p =
      Math.min(36, kw * 5) + (sum ? 14 : 0) + Math.min(32, choiceLines * 7);
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
            ? {
                ...baseSlot,
                title: phase.role,
                subtitle: `${phase.focus}・${phase.objective}`,
              }
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
  const deployIntentSummary = useMemo(() => {
    if (activeTemplateId && activeTemplate) {
      const w = WEAPON_DEPLOY_SHORT[activeTemplateId];
      return `「${activePurpose.label}」フェーズを「${w}」で攻める 3ステップの作戦を生成します。`;
    }
    return `「${activePurpose.label}」の 3ステップ作戦を生成します（左で WEAPON を選ぶと攻め方が確定します）。`;
  }, [activePurpose.label, activeTemplate, activeTemplateId]);
  const applyTonePreset = useCallback(
    (nextEmotion: EmotionTone, nextIntensity?: number) => {
      setEmotion(nextEmotion);
      if (typeof nextIntensity === "number") {
        setIntensity(nextIntensity);
      }
    },
    [],
  );
  const importRoadmapVerificationToScrap = useCallback(() => {
    const entries = readIdentityFieldLog();
    if (entries.length === 0) return;
    const block = formatIdentityFieldBufferForLabScrap(entries);
    const sep = "\n\n---\n\n";
    setDraft((prev) => {
      const t = prev.trim();
      if (!t) return block;
      return `${block}${sep}${t}`;
    });
    playSwitchClick();
  }, []);

  useEffect(() => {
    const sync = () => setRoadmapBufferCount(readIdentityFieldLog().length);
    sync();
    if (typeof window === "undefined") return;
    window.addEventListener(DATA_SYNC_EVENT, sync);
    return () => window.removeEventListener(DATA_SYNC_EVENT, sync);
  }, []);

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

  /** 旧バージョンの SEED 永続化キーを掃除（入力の継続復元はしない方針） */
  useEffect(() => {
    try {
      localStorage.removeItem("emoswitch_lab_seed_v1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (trimmedDraft.length < SCRAP_GHOST_MIN_CHARS) {
      scrapGhostRunRef.current += 1;
      setSeedGhost(EMPTY_SEED_GHOST);
      setScrapGhostLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      const runId = (scrapGhostRunRef.current += 1);
      setScrapGhostLoading(true);
      void ensureDemoWorkspace()
        .then(() => organizeScrapDraft(trimmedDraft))
        .then((out) => {
          if (cancelled || runId !== scrapGhostRunRef.current) return;
          setSeedGhost({
            audience: out.audience,
            pain: out.pain,
            firstExperiment: out.firstExperiment,
            whyNow: out.whyNow,
          });
        })
        .catch(() => {
          if (cancelled || runId !== scrapGhostRunRef.current) return;
          setSeedGhost(EMPTY_SEED_GHOST);
        })
        .finally(() => {
          if (!cancelled && runId === scrapGhostRunRef.current)
            setScrapGhostLoading(false);
        });
    }, SCRAP_GHOST_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedDraft]);

  useEffect(() => {
    let active = true;

    void ensureDemoWorkspace()
      .then(() => fetchGhostSettings())
      .then((ghost) => {
        if (!active) return;
        setPersonaKeywords(ghost.personaKeywords);
        setPersonaSummary(ghost.personaSummary);
        setPersonaStatus(ghost.personaStatus);
        setManualPosts(ghost.manualPosts ?? []);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!storedSeed.trim()) {
      setDnaAlignment(null);
      setDnaAlignmentReason(null);
      setAiQuestion(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void analyzeHypothesisCanvas({
        draft: storedSeed,
        refinementAnswer: refinementAnswer.trim(),
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
          setAiQuestion(res.question.trim() || null);
        })
        .catch(() => {
          if (cancelled) return;
          setDnaAlignment(null);
          setDnaAlignmentReason(null);
          setAiQuestion(null);
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
    seedReadinessPercent,
    usagePurposeId,
  ]);

  const runGenerate = useCallback(
    async (options?: { intensityOverride?: number }) => {
      const requestedIntensity = options?.intensityOverride ?? intensity;
      const requestedSpeedMode = "flash";
      if (!storedSeed.trim()) return;
      setError(null);
      setLoading(true);
      setSeriesTitle("");
      setSeriesItems([]);
      setConceptBrief(null);
      setBriefDraft(null);
      setResultsModalOpen(false);
      playSwitchClick();

      try {
        await ensureDemoWorkspace();
        const [ghost, credit] = await Promise.all([
          fetchGhostSettings(),
          fetchCreditSummary(),
        ]);
        if (
          !credit.isUnlimited &&
          credit.dailyLimit != null &&
          credit.dailyUsed >= credit.dailyLimit
        ) {
          throw new Error("無料プランの本日の生成上限（3回）に達しました。");
        }
        if (!credit.isUnlimited && credit.remaining <= 0) {
          throw new Error(
            "クレジットが残っていません。プランをアップグレードしてください。",
          );
        }
        setManualPosts(ghost.manualPosts ?? []);

        const data = await generateTriple({
          draft: storedSeed,
          audience: seedAudience.trim(),
          pain: seedPain.trim(),
          firstExperiment: seedFirstExperiment.trim(),
          whyNow: seedWhyNow.trim(),
          strategyGoal,
          usagePurpose: usagePurposeId,
          emotion,
          speedMode: requestedSpeedMode,
          intensity: requestedIntensity,
          identityMode: "rich",
          ngWords: ghost.ngWords,
          stylePrompt: ghost.stylePrompt.trim(),
          personaKeywords,
          personaSummary,
          whyMe: [
            refinementAnswer.trim() || null,
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
        setConceptBrief(seriesData.conceptBrief);
        setBriefDraft(seriesData.conceptBrief);
        setSeriesItems(sortSeriesLikeItemsBySlotOrder(seriesData.items));

        const row = await saveGenerationRecord({
          generationMode: "series",
          title: seriesData.seriesTitle,
          draft: storedSeed,
          emotion,
          intensity: requestedIntensity,
          speedMode: requestedSpeedMode,
          adviceHint: seriesData.adviceHint ?? null,
          ghostWhisper: seriesData.ghostWhisper ?? null,
          conceptBrief: seriesData.conceptBrief,
          quickFeedback: null,
          memoryTags: seriesData.memoryTags ?? [],
          items: seriesData.items.map((item) => ({
            slotKey: item.slotKey,
            slotLabel: item.slotLabel,
            body: mergeStoredPlanBodyForStorage(
              item.body,
              item.immediateAction ?? "",
            ),
            hashtags: item.hashtags,
          })),
        });
        if ("items" in row && row.generationMode === "series") {
          setLastSavedSeries(row);
        } else {
          setLastSavedSeries(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラー");
      } finally {
        setLoading(false);
      }
    },
    [
      emotion,
      intensity,
      personaKeywords,
      personaSummary,
      activePurpose.phase,
      activePurpose.label,
      activePurpose.summary,
      activeTemplate,
      storedSeed,
      seedAudience,
      seedPain,
      seedFirstExperiment,
      seedWhyNow,
      refinementAnswer,
      strategyGoal,
      usagePurposeId,
    ],
  );

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
    setConceptBrief(null);
    setBriefDraft(null);
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
  const hasLiveOutput = seriesItems.length === 3;
  const activeConceptBrief = lastSavedSeries?.conceptBrief ?? conceptBrief;
  const visibleConceptBrief = briefDraft ?? activeConceptBrief;
  const briefHasEdits =
    Boolean(activeConceptBrief && briefDraft) &&
    JSON.stringify(activeConceptBrief) !== JSON.stringify(briefDraft);
  const alignmentPercent =
    dnaAlignment == null
      ? null
      : Math.min(100, Math.max(0, Math.round(dnaAlignment)));
  const canDeploy =
    Boolean(storedSeed.trim()) && !loading && activeTemplate != null;

  const deployGateHints = useMemo(() => {
    const hints: string[] = [];
    if (!storedSeed.trim()) hints.push("SEED（中央）に種を入れる");
    if (activeTemplate == null) hints.push("左の WEAPON（検証の型）を選ぶ");
    return hints;
  }, [storedSeed, activeTemplate]);

  const identityResonancePercent = useMemo(() => {
    if (alignmentPercent != null) {
      return Math.round(
        Math.min(
          100,
          Math.max(
            0,
            (alignmentPercent +
              identityExtractionPercent +
              seedReadinessPercent) /
              3,
          ),
        ),
      );
    }
    return Math.round(
      Math.min(
        100,
        Math.max(0, (identityExtractionPercent + seedReadinessPercent) / 2),
      ),
    );
  }, [alignmentPercent, identityExtractionPercent, seedReadinessPercent]);

  const handleDeployToRoadmap = useCallback(() => {
    if (!lastSavedSeries) return;
    const brief = lastSavedSeries.conceptBrief ?? conceptBrief;
    const firstGeneratedAction = seriesItems[0]?.immediateAction?.trim();
    const payload: RoadmapDeployContextV1 = {
      v: 1,
      seriesId: lastSavedSeries.id,
      planTitle: lastSavedSeries.title,
      usagePurposeLabel: activePurpose.label,
      usagePurposePhase: activePurpose.phase,
      weaponLabel: activeTemplate?.label ?? "",
      firstAction: firstGeneratedAction || activeProtocol.firstAction,
      finalGoal: brief?.oneLiner ?? activeProtocol.finalGoal,
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
    setResultsModalOpen(false);
    router.push(`/roadmap?series=${lastSavedSeries.id}`);
  }, [
    activePurpose.label,
    activePurpose.phase,
    activeProtocol,
    activeTemplate?.label,
    conceptBrief,
    dnaAlignmentReason,
    identityResonancePercent,
    lastSavedSeries,
    router,
    seriesItems,
  ]);

  useEffect(() => {
    setBriefDraft(activeConceptBrief ?? null);
  }, [activeConceptBrief]);

  const updateBriefDraftField = useCallback(
    (key: keyof ConceptBrief, value: string) => {
      setBriefDraft((prev) => {
        const base = prev ?? activeConceptBrief;
        if (!base) return prev;
        return { ...base, [key]: value };
      });
    },
    [activeConceptBrief],
  );

  const handleSaveBriefDraft = useCallback(async () => {
    if (!lastSavedSeries || !briefDraft) return;
    setBriefSaving(true);
    try {
      const row = await patchSeriesConceptBrief(lastSavedSeries.id, briefDraft);
      setLastSavedSeries(row);
      setConceptBrief(row.conceptBrief ?? briefDraft);
      setBriefDraft(row.conceptBrief ?? briefDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Concept Brief の保存に失敗しました");
    } finally {
      setBriefSaving(false);
    }
  }, [briefDraft, lastSavedSeries]);

  const handleAudioInputChange = useCallback(async (file: File | null) => {
    if (!file) return;
    setAudioTranscribing(true);
    setError(null);
    try {
      const { text } = await transcribeAudioFile(file);
      const trimmed = text.trim();
      if (trimmed) {
        setDraft((prev) => {
          const current = prev.trim();
          return current ? `${current}\n\n${trimmed}` : trimmed;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "音声入力に失敗しました");
    } finally {
      setAudioTranscribing(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  }, []);

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
          <div className="grid flex-1 min-h-0 gap-4 lg:h-full lg:grid-cols-[minmax(280px,1fr)_minmax(440px,1.65fr)_minmax(320px,1.2fr)] lg:items-stretch lg:gap-5 xl:gap-5 xl:grid-cols-[minmax(300px,1fr)_minmax(520px,1.65fr)_minmax(340px,1.2fr)] 2xl:grid-cols-[minmax(320px,1fr)_minmax(580px,1.65fr)_minmax(360px,1.2fr)]">
            <section
              className={cn(
                columnCardClass,
                purposeSurface.cardBorder,
                "relative flex min-h-0 flex-col overflow-hidden lg:overflow-visible",
              )}
            >
              <div
                className="pointer-events-none absolute -right-2 top-[4.5rem] bottom-24 z-10 hidden w-5 lg:block"
                aria-hidden
              >
                <div className="flex h-full flex-col items-center gap-1 pt-2">
                  <div
                    className="w-px flex-1 max-h-40 bg-gradient-to-b from-transparent via-violet-400/55 to-transparent dark:via-violet-500/45"
                    style={{
                      opacity: 0.35 + (usagePurposeId ? 0.45 : 0),
                      boxShadow: usagePurposeId
                        ? "0 0 12px 1px rgba(124,58,237,0.25)"
                        : undefined,
                    }}
                  />
                  <MoveRight className="size-4 shrink-0 text-violet-500/70 dark:text-violet-400/80" />
                </div>
              </div>
              <div className={cn(columnHeaderBase, purposeSurface.headerWash)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="text-xl leading-none" aria-hidden>
                      ◎
                    </span>
                    <div>
                      <p className="text-sm font-semibold tracking-tight text-foreground">
                        PHASE
                      </p>
                      <p className="text-xs text-muted-foreground">
                        作戦の目的（活用方法）
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {activePurpose.phase}
                  </Badge>
                </div>
              </div>

              <div
                className={cn(
                  columnBodyClass,
                  "flex flex-1 flex-col gap-3 overflow-y-auto pb-4",
                )}
              >
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  PHASE → WEAPON の順。中央の SEED・右の Protocol と連動します。
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {USAGE_PURPOSE_TILES.map((tile) => {
                    const active = tile.id === usagePurposeId;
                    const meta = USAGE_PURPOSE_TILE_META[tile.id];
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => applyUsagePurpose(tile.id)}
                        className={cn(
                          "flex min-h-[2.75rem] items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors",
                          active
                            ? "border-2 border-violet-500/70 bg-violet-50/90 shadow-sm dark:border-violet-400/60 dark:bg-violet-950/40"
                            : "border border-border/35 bg-muted/5 hover:bg-muted/20 dark:bg-muted/10",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-background/90 text-muted-foreground [&_svg]:size-3.5",
                            active && "text-violet-700 dark:text-violet-200",
                          )}
                          aria-hidden
                        >
                          {meta.icon}
                        </span>
                        <span className="min-w-0 text-[13px] font-semibold leading-tight text-foreground">
                          {tile.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div
                  className="rounded-lg border border-border/20 bg-muted/20 px-2.5 py-2 dark:bg-muted/15"
                  aria-live="polite"
                >
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    <span className="font-semibold text-foreground/80">狙い · </span>
                    {USAGE_PURPOSE_PHASE_PLAN[usagePurposeId as UsagePurposeKey].protocol.logicSummary}
                  </p>
                </div>

                <div className="border-t border-border/20 pt-3">
                  <div className="mb-2">
                    <p className="text-sm font-semibold tracking-tight text-foreground">WEAPON</p>
                    <p className="text-[10px] text-muted-foreground">検証の型（横のチップから1つ）</p>
                  </div>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="検証の型">
                    {strategyMatrixTiles.map((template) => {
                      const active = template.id === activeTemplateId;
                      const chip = STRATEGY_GOAL_UI_LABELS[template.strategyGoal];
                      return (
                        <button
                          key={template.id}
                          type="button"
                          title={template.label}
                          onClick={() => applyStrategyTemplate(template.id)}
                          className={cn(
                            "min-w-0 shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold tabular-nums transition-all",
                            active
                              ? "border-violet-500/75 bg-violet-600 text-white shadow-sm dark:border-violet-400/70 dark:bg-violet-600"
                              : "border-border/45 bg-background/80 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground",
                          )}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section
              className={cn(
                columnCardClass,
                purposeSurface.cardBorder,
                "relative",
              )}
            >
              <div className={cn(columnHeaderBase, purposeSurface.headerWash)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="text-xl leading-none" aria-hidden>
                      🌱
                    </span>
                    <div>
                      <p className="text-sm font-semibold tracking-tight text-foreground">
                        SEED
                      </p>
                      <p className="text-xs text-muted-foreground">
                        自由メモと解像度シートを一画面で段階的に洗練
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge
                      variant="secondary"
                      className="rounded-full text-[10px]"
                    >
                      入力 {inputCompletionCount}/{inputCompletionTotal}
                    </Badge>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  columnBodyClass,
                  "flex min-h-0 flex-1 flex-col gap-3 py-3 pb-20 sm:px-4",
                )}
              >
                <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
                  <div className="relative z-20 isolate order-2 flex shrink-0 flex-col gap-2">
                    <div className="shrink-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold tracking-tight text-foreground">
                            自由メモ（Scrap）
                          </p>
                          <span className="shrink-0 rounded-full border border-border/40 bg-muted/40 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                            自由入力
                          </span>
                        </div>
                        {trimmedDraft.length > 0 ? (
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {trimmedDraft.length} 文字
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] leading-snug text-muted-foreground sm:text-[11px] sm:leading-relaxed">
                        {SCRAP_GHOST_MIN_CHARS} 文字以上で Scrap から AI
                        が解像度シートの各欄へ提案を出します。紫枠をタップすると確定（Scrap
                        は消えません）。
                      </p>
                    </div>
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(event) => {
                        void handleAudioInputChange(event.currentTarget.files?.[0] ?? null);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto w-full justify-center gap-2 py-2 text-xs"
                      disabled={audioTranscribing}
                      onClick={() => audioInputRef.current?.click()}
                    >
                      {audioTranscribing ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Mic className="size-3.5" aria-hidden />
                      )}
                      {audioTranscribing ? "音声を文字起こし中..." : "音声ファイルからScrapへ追加"}
                    </Button>
                    {roadmapBufferCount > 0 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-auto w-full gap-2 border border-violet-200/70 bg-violet-50/90 py-2.5 text-xs font-medium leading-snug text-violet-950 shadow-sm hover:bg-violet-100/95 dark:border-violet-800/55 dark:bg-violet-950/40 dark:text-violet-50 dark:hover:bg-violet-950/60"
                        onClick={importRoadmapVerificationToScrap}
                      >
                        <span
                          aria-hidden
                          className="select-none text-base leading-none"
                        >
                          🔄
                        </span>
                        前回の検証からの学び（{roadmapBufferCount}
                        件）を作戦に含める
                      </Button>
                    ) : null}
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={CANVAS_PLACEHOLDER}
                      rows={5}
                      className="max-h-[200px] min-h-[100px] w-full resize-none overflow-y-auto rounded-2xl border border-border/30 bg-muted/15 px-3 py-2.5 text-sm leading-relaxed shadow-sm ring-1 ring-border/20 [field-sizing:fixed] placeholder:text-muted-foreground/45 focus-visible:border-violet-400/40 focus-visible:ring-violet-400/25 md:text-[15px] md:leading-7"
                      aria-label="自由メモ（Scrap）"
                    />
                  </div>

                  <div className="relative z-10 order-1 shrink-0 space-y-3 border-b border-border/25 pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-border/40 bg-muted/15 px-3 py-2.5">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <p className="text-xs font-semibold text-foreground">
                            解像度シート（{activePurpose.label}）
                          </p>
                          <LabSheetHintButton
                            label={`この用途の読み方（${activePurpose.label}）`}
                            hint={structuredSheetHints.sheetIntro}
                          />
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          ①〜④は任意の組み合わせ。空欄のときだけ、Scrap
                          由来の提案が出たらタップで確定できます。
                        </p>
                      </div>
                      {scrapGhostLoading ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-300/40 bg-violet-500/8 px-2 py-1 text-[9px] font-medium text-violet-800 dark:border-violet-500/35 dark:bg-violet-950/40 dark:text-violet-100">
                          <Loader2
                            className="size-3 animate-spin"
                            aria-hidden
                          />
                          抽出中
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                      <div className="flex min-h-0 min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-0.5">
                          <label
                            htmlFor="lab-seed-audience"
                            className="min-w-0 max-w-full flex-1 text-[11px] font-semibold leading-tight text-foreground"
                          >
                            {STRUCTURED_SHEET_LABELS.audienceLabel}
                          </label>
                          <LabSheetHintButton
                            label={STRUCTURED_SHEET_LABELS.audienceLabel}
                            hint={
                              structuredSheetHints.audienceSubline
                                ? `${structuredSheetHints.audienceSubline} ${structuredSheetHints.audience.hint}`
                                : structuredSheetHints.audience.hint
                            }
                            example={structuredSheetHints.audience.example}
                          />
                          {aiSheetProvisional.audience ? (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-semibold text-amber-950 dark:bg-amber-900/55 dark:text-amber-50">
                              AI仮
                            </span>
                          ) : null}
                        </div>
                        <SeedGhostPick
                          ghostText={seedGhost.audience}
                          fieldEmpty={!seedAudience.trim()}
                          disabled={scrapGhostLoading}
                          onPick={() => {
                            setSeedAudience(seedGhost.audience);
                            setAiSheetProvisional((prev) => ({
                              ...prev,
                              audience: true,
                            }));
                            playSwitchClick();
                          }}
                        />
                        <Textarea
                          id="lab-seed-audience"
                          value={seedAudience}
                          onChange={(e) => {
                            setAiSheetProvisional((prev) => ({
                              ...prev,
                              audience: false,
                            }));
                            setSeedAudience(e.target.value);
                          }}
                          placeholder={SHEET_TEXTAREA_PLACEHOLDER}
                          rows={2}
                          className={cn(
                            "min-h-[3.25rem] resize-none overflow-y-auto rounded-lg border border-border/25 bg-background/90 text-xs leading-snug shadow-sm [field-sizing:fixed] placeholder:text-muted-foreground/50 sm:text-sm sm:leading-relaxed",
                            aiSheetProvisional.audience &&
                              "ring-2 ring-amber-400/45 bg-amber-50/55 dark:bg-amber-950/35 dark:ring-amber-500/45",
                          )}
                        />
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-0.5">
                          <label
                            htmlFor="lab-seed-pain"
                            className="min-w-0 max-w-full flex-1 text-[11px] font-semibold leading-tight text-foreground"
                          >
                            {STRUCTURED_SHEET_LABELS.painLabel}
                          </label>
                          <LabSheetHintButton
                            label={STRUCTURED_SHEET_LABELS.painLabel}
                            hint={structuredSheetHints.pain.hint}
                            example={structuredSheetHints.pain.example}
                          />
                          {aiSheetProvisional.pain ? (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-semibold text-amber-950 dark:bg-amber-900/55 dark:text-amber-50">
                              AI仮
                            </span>
                          ) : null}
                        </div>
                        <SeedGhostPick
                          ghostText={seedGhost.pain}
                          fieldEmpty={!seedPain.trim()}
                          disabled={scrapGhostLoading}
                          onPick={() => {
                            setSeedPain(seedGhost.pain);
                            setAiSheetProvisional((prev) => ({
                              ...prev,
                              pain: true,
                            }));
                            playSwitchClick();
                          }}
                        />
                        <Textarea
                          id="lab-seed-pain"
                          value={seedPain}
                          onChange={(e) => {
                            setAiSheetProvisional((prev) => ({
                              ...prev,
                              pain: false,
                            }));
                            setSeedPain(e.target.value);
                          }}
                          placeholder={SHEET_TEXTAREA_PLACEHOLDER}
                          rows={2}
                          className={cn(
                            "min-h-[3.25rem] resize-none overflow-y-auto rounded-lg border border-border/25 bg-background/90 text-xs leading-snug shadow-sm [field-sizing:fixed] placeholder:text-muted-foreground/50 sm:text-sm sm:leading-relaxed",
                            aiSheetProvisional.pain &&
                              "ring-2 ring-amber-400/45 bg-amber-50/55 dark:bg-amber-950/35 dark:ring-amber-500/45",
                          )}
                        />
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-0.5">
                          <label
                            htmlFor="lab-seed-experiment"
                            className="min-w-0 max-w-full flex-1 text-[11px] font-semibold leading-tight text-foreground"
                          >
                            {STRUCTURED_SHEET_LABELS.experimentLabel}
                          </label>
                          <LabSheetHintButton
                            label={STRUCTURED_SHEET_LABELS.experimentLabel}
                            hint={structuredSheetHints.firstExperiment.hint}
                            example={structuredSheetHints.firstExperiment.example}
                          />
                          {aiSheetProvisional.firstExperiment ? (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-semibold text-amber-950 dark:bg-amber-900/55 dark:text-amber-50">
                              AI仮
                            </span>
                          ) : null}
                        </div>
                        <SeedGhostPick
                          ghostText={seedGhost.firstExperiment}
                          fieldEmpty={!seedFirstExperiment.trim()}
                          disabled={scrapGhostLoading}
                          onPick={() => {
                            setSeedFirstExperiment(seedGhost.firstExperiment);
                            setAiSheetProvisional((prev) => ({
                              ...prev,
                              firstExperiment: true,
                            }));
                            playSwitchClick();
                          }}
                        />
                        <Textarea
                          id="lab-seed-experiment"
                          value={seedFirstExperiment}
                          onChange={(e) => {
                            setAiSheetProvisional((prev) => ({
                              ...prev,
                              firstExperiment: false,
                            }));
                            setSeedFirstExperiment(e.target.value);
                          }}
                          placeholder={SHEET_TEXTAREA_PLACEHOLDER}
                          rows={2}
                          className={cn(
                            "min-h-[3.25rem] resize-none overflow-y-auto rounded-lg border border-border/25 bg-background/90 text-xs leading-snug shadow-sm [field-sizing:fixed] placeholder:text-muted-foreground/50 sm:text-sm sm:leading-relaxed",
                            aiSheetProvisional.firstExperiment &&
                              "ring-2 ring-amber-400/45 bg-amber-50/55 dark:bg-amber-950/35 dark:ring-amber-500/45",
                          )}
                        />
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-0.5">
                          <label
                            htmlFor="lab-seed-whynow"
                            className="min-w-0 max-w-full flex-1 text-[11px] font-semibold leading-tight text-foreground"
                          >
                            {STRUCTURED_SHEET_LABELS.whyNowLabel}
                          </label>
                          <LabSheetHintButton
                            label={STRUCTURED_SHEET_LABELS.whyNowLabel}
                            hint={structuredSheetHints.whyNow.hint}
                            example={structuredSheetHints.whyNow.example}
                          />
                          {aiSheetProvisional.whyNow ? (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-semibold text-amber-950 dark:bg-amber-900/55 dark:text-amber-50">
                              AI仮
                            </span>
                          ) : null}
                        </div>
                        <SeedGhostPick
                          ghostText={seedGhost.whyNow}
                          fieldEmpty={!seedWhyNow.trim()}
                          disabled={scrapGhostLoading}
                          onPick={() => {
                            setSeedWhyNow(seedGhost.whyNow);
                            setAiSheetProvisional((prev) => ({
                              ...prev,
                              whyNow: true,
                            }));
                            playSwitchClick();
                          }}
                        />
                        <Textarea
                          id="lab-seed-whynow"
                          value={seedWhyNow}
                          onChange={(e) => {
                            setAiSheetProvisional((prev) => ({
                              ...prev,
                              whyNow: false,
                            }));
                            setSeedWhyNow(e.target.value);
                          }}
                          placeholder={SHEET_TEXTAREA_PLACEHOLDER}
                          rows={2}
                          className={cn(
                            "min-h-[3.25rem] resize-none overflow-y-auto rounded-lg border border-border/25 bg-background/90 text-xs leading-snug shadow-sm [field-sizing:fixed] placeholder:text-muted-foreground/50 sm:text-sm sm:leading-relaxed",
                            aiSheetProvisional.whyNow &&
                              "ring-2 ring-amber-400/45 bg-amber-50/55 dark:bg-amber-950/35 dark:ring-amber-500/45",
                          )}
                        />
                      </div>
                    </div>

                    <details className="group rounded-xl border border-border/25 bg-muted/8 open:border-border/40 open:bg-muted/12 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium text-foreground marker:content-none">
                        <span className="tabular-nums text-muted-foreground group-open:hidden">
                          [+] 特記事項
                        </span>
                        <span className="hidden tabular-nums text-muted-foreground group-open:inline">
                          [−] 特記事項
                        </span>
                        {refinementAnswer.trim() ? (
                          <Badge variant="secondary" className="max-w-[min(12rem,55%)] truncate rounded-full text-[9px]">
                            入力あり
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">任意</span>
                        )}
                      </summary>
                      <div className="space-y-2 border-t border-border/15 px-3 pb-3 pt-2">
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                          ①〜④の外側で、トーン・論理・ターゲット語感など「譲れないワガママ」を短く。生成 API の{" "}
                          <span className="font-medium text-foreground/85">whyMe</span>{" "}
                          と仮説キャンバスにそのまま渡ります（Scrap 本文にも「AIへの追加回答」として含まれます）。
                        </p>
                        <Textarea
                          id="lab-seed-refinement"
                          value={refinementAnswer}
                          onChange={(e) => setRefinementAnswer(e.target.value)}
                          rows={1}
                          placeholder="例: 論理性より感情全振りで / 40代向けだが言葉はZ世代風に / 裏テーマは〇〇を匂わせて"
                          className="min-h-10 w-full resize-y overflow-y-auto rounded-lg border border-border/30 bg-background/95 px-3 py-2 text-sm leading-relaxed shadow-sm field-sizing-content placeholder:text-muted-foreground/45 focus-visible:border-violet-400/40 focus-visible:ring-1 focus-visible:ring-violet-400/25"
                          aria-label="特記事項（生成への追加指示）"
                        />
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </section>

            <section
              className={cn(
                columnCardClass,
                purposeSurface.cardBorder,
                "flex min-h-0 flex-col max-lg:overflow-visible",
              )}
            >
              <div className={cn(columnHeaderBase, purposeSurface.headerWash)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold tracking-tight text-foreground">
                      PROTOCOL & DEPLOY
                    </p>
                    <p className="text-xs text-muted-foreground">
                      作戦の確認と生成
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {loading ? (
                      <Badge className="animate-pulse rounded-full bg-violet-600 px-2 py-0.5 text-[10px] text-white">
                        検証中
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className="max-w-[7rem] truncate rounded-full border-amber-200/60 bg-amber-50/80 text-[10px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100"
                    >
                      {activePurpose.label}
                    </Badge>
                    <span className="text-[11px] font-medium text-muted-foreground/80">
                      ×
                    </span>
                    {activeTemplate ? (
                      <Badge
                        variant="secondary"
                        className="max-w-[10rem] truncate rounded-full text-[10px]"
                      >
                        {activeTemplate.label}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="rounded-full text-[10px]"
                      >
                        武器未選択
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  className={cn(
                    columnBodyClass,
                    "min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-2 [scrollbar-gutter:stable]",
                  )}
                >
                  <div className="pt-0.5">
                    <div className="rounded-xl border border-border/15 bg-background/50 p-3 sm:p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground sm:text-[11px]">
                          作戦のプレビュー（Protocol）
                        </p>
                        <Badge
                          variant="outline"
                          className="shrink-0 rounded-full text-[9px] sm:text-[10px]"
                        >
                          {activePurpose.phase}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:text-[11px] sm:leading-relaxed">
                        {activeTemplateId
                          ? "左カラムで選んだ武器に沿って 3STEP の見出しが決まります（生成 API と同じ枠）。"
                          : `左の WEAPON を選ぶと見出しが切り替わります（いまは「${activePurpose.label}」の骨格のみ）。`}
                      </p>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={`${usagePurposeId}-${activeTemplateId ?? "none"}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="mt-2 grid gap-1.5"
                        >
                          {protocolStepRows.map((row, index) => (
                            <div
                              key={`${usagePurposeId}-${activeTemplateId ?? "none"}-${index}`}
                              className="rounded-lg border border-border/30 bg-muted/12 px-2.5 py-2"
                            >
                              <div className="flex items-start gap-2">
                                <span className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-violet-100 text-[9px] font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                                  {index + 1}
                                </span>
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <p className="text-[11px] font-semibold leading-snug text-foreground/90 md:text-xs">
                                    STEP {index + 1}: {row.primary}
                                  </p>
                                  {row.sub ? (
                                    <p className="text-[9px] leading-snug text-muted-foreground md:text-[10px]">
                                      {row.sub}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>

                  <details className="group rounded-xl border border-border/20 bg-muted/6 open:border-border/35 open:bg-muted/10">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden sm:px-3 sm:text-xs">
                      <span>補助プレビュー（実行メモ）</span>
                      <span className="text-[10px] font-normal text-muted-foreground group-open:hidden">
                        開く
                      </span>
                      <span className="hidden text-[10px] font-normal text-muted-foreground group-open:inline">
                        閉じる
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-border/15 px-3 pb-3 pt-2">
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                          次に確かめること
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          「{activePurpose.label}」に合わせて Roadmap
                          に残す実行メモの観点
                        </p>
                        <div className="mt-2 grid gap-2">
                          {vaultReactionSlots.map((slot) => (
                            <div
                              key={slot}
                              className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/45 bg-muted/15 px-3 py-2"
                            >
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-violet-400/80"
                                aria-hidden
                              />
                              <span className="text-xs font-medium text-foreground/85">
                                {slot}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>

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
                </div>

                <div
                  className={cn(
                    "z-20 shrink-0 space-y-2 border-t border-border/25 px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:px-3.5",
                    "bg-background/92 backdrop-blur-md shadow-[0_-8px_32px_-18px_rgba(15,23,42,0.14)] dark:bg-background/88 dark:shadow-[0_-10px_40px_-22px_rgba(0,0,0,0.45)]",
                    "max-lg:sticky max-lg:bottom-0",
                  )}
                >
                  {error ? (
                    <p className="text-center text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-3">
                    <div className="min-w-0 flex-1">
                      {!canDeploy && !loading && deployGateHints.length > 0 ? (
                        <p
                          id="lab-deploy-gate-hints"
                          className="text-[11px] font-medium leading-snug text-amber-900 dark:text-amber-100"
                        >
                          あと{deployGateHints.join("・")}が必要です。
                        </p>
                      ) : null}
                      {loading ? (
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          生成が終わると「出陣確認」が開きます。
                        </p>
                      ) : null}
                      {hasLiveOutput && !resultsModalOpen && !loading ? (
                        <button
                          type="button"
                          className="mb-1 text-left text-[10px] font-medium text-violet-700 underline-offset-2 hover:underline sm:text-[11px] dark:text-violet-300"
                          onClick={() => setResultsModalOpen(true)}
                        >
                          出陣確認を開く
                        </button>
                      ) : null}
                      {canDeploy ? (
                        <div>
                          <p className="text-[9px] font-semibold tracking-[0.18em] text-muted-foreground/70">
                            DEPLOY
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium leading-snug text-foreground/90 sm:text-xs">
                            {deployIntentSummary}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canDeploy}
                      aria-describedby={
                        !canDeploy && deployGateHints.length > 0 && !loading
                          ? "lab-deploy-gate-hints"
                          : undefined
                      }
                      onClick={() => {
                        void runGenerate();
                      }}
                      className={cn(
                        "h-9 w-full min-w-0 shrink-0 px-5 text-[13px] font-semibold md:w-auto md:min-w-[168px] md:self-end",
                        "transition-[filter,opacity,box-shadow,background-image] duration-300",
                        canDeploy
                          ? "bg-linear-to-r from-fuchsia-600 via-violet-600 to-purple-600 text-white shadow-[0_0_44px_-8px_rgba(192,38,211,0.95)] ring-1 ring-fuchsia-300/45 hover:from-fuchsia-500 hover:via-violet-500 hover:to-purple-500"
                          : "bg-muted text-muted-foreground opacity-55 grayscale ring-0 shadow-none dark:bg-muted/80",
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
            aria-label="出陣確認を閉じる"
            onClick={() => setResultsModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lab-results-modal-title"
            className={cn(
              "relative z-1 flex max-h-[min(88dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] border bg-background shadow-[0_-24px_72px_-36px_rgba(0,0,0,0.42)] sm:rounded-[24px] sm:shadow-[0_32px_96px_-44px_rgba(0,0,0,0.5)]",
              purposeSurface.modalChrome,
            )}
          >
            <div
              className={cn(
                "shrink-0 border-b border-border/15 bg-linear-to-r px-5 pb-3 pt-4 transition-[background-image] duration-500",
                purposeSurface.modalHeaderBar,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background/90 text-violet-700 shadow-sm ring-1 ring-border/35 dark:text-violet-200">
                    {activeTemplateId ? (
                      <span className="grid place-items-center [&_svg]:size-[1.15rem]">
                        {STRATEGY_TILE_META[activeTemplateId].icon}
                      </span>
                    ) : (
                      <BookOpen className="size-[1.15rem]" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2
                        id="lab-results-modal-title"
                        className="text-base font-bold tracking-tight text-foreground sm:text-lg"
                      >
                        いざ出陣
                      </h2>
                      <Badge
                        variant="secondary"
                        className="rounded-full tabular-nums text-[10px]"
                      >
                        共鳴 {identityResonancePercent}%
                      </Badge>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Protocol を確認済みなら、ここでは{" "}
                      <span className="font-medium text-foreground/90">
                        Roadmap へ載せて最初の行動に移す
                      </span>{" "}
                      だけに集中できます。
                    </p>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px]"
                      >
                        {activePurpose.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px]"
                      >
                        {activeTemplate?.label ?? "武器未選択"}
                      </Badge>
                    </div>
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
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 [scrollbar-gutter:stable]">
              {visibleConceptBrief ? (
                <section className="space-y-3 rounded-2xl border border-violet-200/70 bg-violet-50/75 p-4 dark:border-violet-900/45 dark:bg-violet-950/25">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800/75 dark:text-violet-200/75">
                      Concept Brief
                    </p>
                    <h3 className="mt-1 text-base font-bold leading-snug text-violet-950 dark:text-violet-50">
                      {visibleConceptBrief.oneLiner}
                    </h3>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={briefHasEdits ? "default" : "outline"}
                      className="h-8 gap-1.5 text-xs"
                      disabled={!lastSavedSeries || !briefDraft || briefSaving || !briefHasEdits}
                      onClick={() => void handleSaveBriefDraft()}
                    >
                      {briefSaving ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : (
                        <Save className="size-3" aria-hidden />
                      )}
                      {briefSaving ? "保存中" : briefHasEdits ? "Briefを保存" : "保存済み"}
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">一言コンセプト</span>
                      <Textarea
                        value={briefDraft?.oneLiner ?? visibleConceptBrief.oneLiner}
                        onChange={(event) => updateBriefDraftField("oneLiner", event.target.value)}
                        rows={2}
                        className="min-h-12 bg-background/85 text-xs"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">価値提案</span>
                      <Textarea
                        value={briefDraft?.valueProposition ?? visibleConceptBrief.valueProposition}
                        onChange={(event) => updateBriefDraftField("valueProposition", event.target.value)}
                        rows={2}
                        className="min-h-12 bg-background/85 text-xs"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">代替手段との差分</span>
                      <Textarea
                        value={briefDraft?.differentiator ?? visibleConceptBrief.differentiator}
                        onChange={(event) => updateBriefDraftField("differentiator", event.target.value)}
                        rows={2}
                        className="min-h-12 bg-background/85 text-xs"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">30秒ピッチ</span>
                      <Textarea
                        value={briefDraft?.elevatorPitch ?? visibleConceptBrief.elevatorPitch}
                        onChange={(event) => updateBriefDraftField("elevatorPitch", event.target.value)}
                        rows={3}
                        className="min-h-16 bg-background/85 text-xs"
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    {[
                      ["誰に", visibleConceptBrief.audience],
                      ["痛み", visibleConceptBrief.pain],
                      ["差分", visibleConceptBrief.differentiator],
                      ["なぜ今", visibleConceptBrief.whyNow],
                      ["なぜ自分", visibleConceptBrief.whyMe],
                      ["MVP", visibleConceptBrief.mvp],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-violet-200/55 bg-background/70 px-3 py-2 dark:border-violet-900/35 dark:bg-background/55">
                        <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
                        <p className="mt-1 leading-relaxed text-foreground/90">{value}</p>
                      </div>
                    ))}
                  </div>
                  <details className="rounded-xl border border-violet-200/55 bg-background/70 px-3 py-2 dark:border-violet-900/35 dark:bg-background/55">
                    <summary className="cursor-pointer text-[10px] font-semibold text-muted-foreground">
                      Before / After・編集比較
                    </summary>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-lg border border-dashed border-border/50 bg-muted/25 p-2">
                        <p className="text-[10px] font-semibold text-muted-foreground">Before: Scrap</p>
                        <p className="mt-1 line-clamp-5 whitespace-pre-wrap leading-relaxed text-muted-foreground">{storedSeed}</p>
                      </div>
                      <div className="rounded-lg border border-violet-200/55 bg-violet-50/60 p-2 dark:border-violet-900/35 dark:bg-violet-950/25">
                        <p className="text-[10px] font-semibold text-muted-foreground">
                          After: {briefHasEdits ? "編集中のBrief" : "生成されたBrief"}
                        </p>
                        <p className="mt-1 leading-relaxed text-foreground/90">{visibleConceptBrief.oneLiner}</p>
                      </div>
                    </div>
                    {activeConceptBrief && briefHasEdits ? (
                      <div className="mt-2 rounded-lg border border-amber-200/70 bg-amber-50/70 p-2 text-xs dark:border-amber-900/45 dark:bg-amber-950/25">
                        <p className="text-[10px] font-semibold text-muted-foreground">AI生成版</p>
                        <p className="mt-1 leading-relaxed text-muted-foreground">{activeConceptBrief.oneLiner}</p>
                      </div>
                    ) : null}
                  </details>
                  <details className="rounded-xl border border-violet-200/55 bg-background/70 px-3 py-2 dark:border-violet-900/35 dark:bg-background/55">
                    <summary className="cursor-pointer text-[10px] font-semibold text-muted-foreground">
                      用途別に言い換える
                    </summary>
                    <div className="mt-2 grid gap-2">
                      {(Object.keys(CONCEPT_BRIEF_TRANSFORM_LABELS) as ConceptBriefTransformKey[]).map((key) => (
                        <div key={key} className="rounded-lg border border-border/45 bg-muted/20 p-2">
                          <p className="text-[10px] font-semibold text-foreground">
                            {CONCEPT_BRIEF_TRANSFORM_LABELS[key]}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {buildConceptBriefTransform(visibleConceptBrief, key)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                </section>
              ) : null}

              {aiQuestion ? (
                <section className="rounded-2xl border border-amber-200/70 bg-amber-50/75 p-4 shadow-sm dark:border-amber-900/45 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-100">
                      <CircleHelp className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-100/80">
                        AIからの逆質問
                      </p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
                        {aiQuestion}
                      </p>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        この問いに答えると、Concept Brief の前提がさらに削れます。必要なら上の Brief を編集してから Roadmap へ進めてください。
                      </p>
                    </div>
                  </div>
                </section>
              ) : null}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  実行プラン名
                </p>
                <p className="mt-0.5 text-base font-semibold leading-snug text-foreground sm:text-lg">
                  {seriesTitle}
                </p>
              </div>
              {dnaAlignmentReason ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
                  {dnaAlignmentReason}
                </p>
              ) : null}

              <div className="grid gap-2.5 sm:grid-cols-3">
                {sprintTimelinePhases.map((phase, index) => {
                  const item = seriesItems[index];
                  const bodyPreview = (item?.body ?? phase.detail)
                    .replace(/\s+/g, " ")
                    .trim();
                  const clipped =
                    bodyPreview.length > 160
                      ? `${bodyPreview.slice(0, 160)}…`
                      : bodyPreview;
                  return (
                    <div
                      key={phase.rangeLabel}
                      className={cn(
                        "rounded-xl border border-border/20 p-3",
                        phase.style.glow,
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <Badge
                          className={cn(
                            "rounded-full text-[9px]",
                            phase.style.tone,
                          )}
                        >
                          {phase.slot?.title ?? phase.focus}
                        </Badge>
                        <span className="shrink-0 text-[9px] font-medium text-muted-foreground">
                          {phase.rangeLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-snug text-foreground">
                        {phase.goal}
                      </p>
                      {phase.immediateAction ? (
                        <p className="mt-1.5 border-l-2 border-violet-400/50 pl-2 text-[10px] font-medium leading-snug text-violet-950 dark:border-violet-600/50 dark:text-violet-100">
                          すぐ: {phase.immediateAction}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground line-clamp-4">
                          {clipped}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 space-y-2 border-t border-border/15 bg-muted/10 px-5 py-4">
              <p className="text-center text-[11px] leading-snug text-muted-foreground sm:text-left">
                {deployIntentSummary}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={handleDiscardGeneratedPlan}
                >
                  破棄して練り直す
                </Button>
                <Button
                  type="button"
                  disabled={!lastSavedSeries}
                  onClick={() => handleDeployToRoadmap()}
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "h-10 w-full font-semibold sm:w-auto sm:min-w-[200px]",
                    "bg-linear-to-r from-fuchsia-600 via-violet-600 to-purple-600 text-white shadow-[0_0_36px_-10px_rgba(192,38,211,0.75)] hover:from-fuchsia-500 hover:via-violet-500 hover:to-purple-500",
                  )}
                >
                  Roadmap へ出陣する
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
