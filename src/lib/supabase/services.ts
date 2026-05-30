import type { User } from "@supabase/supabase-js";
import type { EmotionTone } from "@/lib/emotions";
import {
  embedConceptBriefInAdviceHint,
  extractConceptBriefFromAdviceHint,
  stripConceptBriefFromAdviceHint,
} from "@/lib/concept-brief";
import {
  buildArchiveInsights,
  type ArchiveInsightSeriesInput,
  type ArchiveInsightSingleInput,
} from "@/lib/archive-insights";
import { inferMemoryTags } from "@/lib/memory-tags";
import { compareSeriesSlotKey, getSeriesSlotLabel, type SeriesSlotKey } from "@/lib/series";
import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  ArchiveOverview,
  ConceptBrief,
  CreditSummary,
  GenerationRecord,
  GenerationSeriesItemRecord,
  GenerationSeriesRecord,
  GhostSettings,
  QuickFeedback,
  UserProfileSettings,
} from "@/lib/types";

export const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_USER_EMAIL = "demo@emoswitch.local";
const DEMO_USER_PASSWORD = "EmoSwitchDemo#2026";
const DEMO_DISPLAY_NAME = "デモユーザー";
const ENSURED_USER_TTL_MS = 5 * 60_000;
const AUTH_USER_TTL_MS = 60_000;
const ARCHIVE_OVERVIEW_TTL_MS = 15_000;
const LEGACY_BACKFILL_INTERVAL_MS = 15 * 60_000;
const NEW_SCHEMA_FALLBACK_RETIRE_THRESHOLD = 0.95;

const ensuredUserCache = new Map<string, number>();
const authenticatedUserCache = new Map<string, { user: User; expiresAt: number }>();
const archiveOverviewCache = new Map<string, { value: ArchiveOverview; expiresAt: number }>();
const schemaCoverageCache = new Map<
  string,
  { value: { legacyCount: number; newCount: number; ratio: number; useLegacyFallback: boolean }; expiresAt: number }
>();
const legacyBackfillRunAt = new Map<string, number>();

let demoUserPromise: Promise<string> | null = null;
let demoWorkspacePromise: Promise<{ userId: string; seeded: boolean }> | null = null;
let demoWorkspaceReady = false;

type DbGenerationRow = {
  id: string;
  created_at: string;
  generation_mode: "single" | "series";
  draft: string;
  emotion: EmotionTone;
  intensity: number;
  speed_mode: "flash" | "pro" | null;
  variants: string[];
  hashtags: string[];
  selected_index: number | null;
  likes: number | null;
  memo: string | null;
  advice_hint: string | null;
  quick_feedback: QuickFeedback;
  memory_tags: string[] | null;
  deleted_at: string | null;
};

type DbHotGenerationMemoryRow = {
  id: string;
  created_at: string;
  draft: string;
  emotion: EmotionTone;
  variants: string[];
  selected_index: number | null;
  likes: number | null;
  memo: string | null;
  memory_tags: string[] | null;
};

type DbSeriesRow = {
  id: string;
  created_at: string;
  title: string;
  source_draft: string;
  emotion: EmotionTone;
  intensity: number;
  speed_mode: "flash" | "pro" | null;
  advice_hint: string | null;
  ghost_whisper: string | null;
  concept_brief: ConceptBrief | null;
  quick_feedback: QuickFeedback;
  memory_tags: string[] | null;
  deleted_at: string | null;
};

type DbSeriesItemRow = {
  id: string;
  series_id: string;
  created_at: string;
  slot_key: SeriesSlotKey;
  slot_label: string;
  body: string;
  hashtags: string[];
  quick_feedback: QuickFeedback;
  likes: number | null;
  memo: string | null;
  memory_tags: string[] | null;
  deleted_at: string | null;
};

type DbArchiveInsightSingleRow = {
  emotion: EmotionTone;
  intensity: number;
  quick_feedback: QuickFeedback;
};

type DbArchiveInsightSeriesRow = {
  id: string;
  emotion: EmotionTone;
  intensity: number;
};

type DbArchiveInsightSeriesItemRow = {
  series_id: string;
  quick_feedback: QuickFeedback;
};

type DbHypothesisRow = {
  id: string;
  user_id: string;
  legacy_source_type?: string | null;
  legacy_source_id?: string | null;
  generation_mode: "single" | "series";
  seed_input: string;
  strategy_params: {
    emotion?: EmotionTone;
    intensity?: number;
    speed_mode?: "flash" | "pro" | null;
    title?: string;
  } | null;
  output_content: {
    variants?: string[];
    hashtags?: string[];
    selected_index?: number | null;
    advice_hint?: string | null;
    memory_tags?: string[];
    title?: string;
    ghost_whisper?: string | null;
    concept_brief?: ConceptBrief | null;
    items?: Array<{
      id?: string;
      slot_key?: SeriesSlotKey;
      slot_label?: string;
      body?: string;
      hashtags?: string[];
      quick_feedback?: QuickFeedback;
      likes?: number | null;
      memo?: string | null;
      memory_tags?: string[];
      created_at?: string;
    }>;
  } | null;
  status: "draft" | "deployed" | "archived";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type DbVaultLogRow = {
  id: string;
  hypothesis_id: string;
  reaction_type: "hot" | "cold" | "ignore" | "feedback" | "memo";
  reaction_payload: {
    likes?: number;
    memo?: string;
    series_item_id?: string;
    slot_key?: SeriesSlotKey;
  } | null;
  created_at: string;
};

type DbIdentityFieldBufferEntryRow = {
  id: string;
  user_id: string;
  series_id: string;
  item_id: string;
  quick_feedback: QuickFeedback;
  likes: number | null;
  memo: string | null;
  created_at: string;
  resolved_at: string | null;
};

type SeriesInsertItem = {
  slotKey: SeriesSlotKey;
  slotLabel: string;
  body: string;
  hashtags: string[];
};

export type HotGenerationMemory = {
  id: string;
  createdAt: string;
  draft: string;
  emotion: EmotionTone;
  selectedText: string;
  likes: number | null;
  memo: string | null;
  slotLabel?: string;
  memoryTags: string[];
};

export type IdentityProfile = {
  dnaAxes: Record<string, unknown>;
  myTaboo: Record<string, unknown>;
  currentProphecy: string;
  dnaCompleteness: number;
  version: number;
};

export type IdentityFieldBufferEntryInput = {
  seriesId: string;
  itemId: string;
  quickFeedback: QuickFeedback;
  likes: number | null;
  memo: string | null;
};

export type IdentityFieldBufferSeriesSummary = {
  seriesId: string;
  pendingCount: number;
};

type GenerationCreateInput = Omit<GenerationRecord, "id" | "createdAt">;

type GenerationUpdateInput = Partial<Pick<GenerationRecord, "selectedIndex" | "likes" | "memo" | "quickFeedback">>;

type GenerationSeriesCreateInput = Omit<GenerationSeriesRecord, "id" | "createdAt" | "generationMode" | "items"> & {
  items: SeriesInsertItem[];
};

type GenerationSeriesItemUpdateInput = Partial<
  Pick<GenerationSeriesItemRecord, "likes" | "memo" | "quickFeedback">
>;

type LocalMigrationPayload = {
  generations: GenerationRecord[];
  ghostSettings: GhostSettings;
};

const DEFAULT_GHOST_SETTINGS: GhostSettings = {
  profileUrl: "",
  ngWords: [],
  stylePrompt: "",
  manualPosts: [],
  personaKeywords: [],
  personaSummary: "",
  personaEvidence: [],
  personaStatus: "empty",
  personaLastAnalyzedHotCount: 0,
};

const DEFAULT_IDENTITY_PROFILE: IdentityProfile = {
  dnaAxes: {},
  myTaboo: {},
  currentProphecy: "平均的な起業家",
  dnaCompleteness: 0,
  version: 1,
};

const DEMO_GENERATIONS: Array<{
  id: string;
  generation_mode: "single";
  draft: string;
  emotion: EmotionTone;
  intensity: number;
  speed_mode: "flash" | "pro";
  variants: string[];
  hashtags: string[];
  selected_index: number | null;
  likes: number | null;
  memo: string | null;
  advice_hint: string | null;
  quick_feedback: QuickFeedback;
  memory_tags: string[];
  created_at: string;
}> = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    generation_mode: "single",
    draft: "頑張ってるのに結果が出なくて、反応も鈍くてしんどい。",
    emotion: "empathy",
    intensity: 70,
    speed_mode: "flash",
    variants: [
      "報われない日が続いても、今日まで積み上げた分はちゃんと明日の自分を助ける。",
      "うまくいかない日は、自分がダメなんじゃなくて、芽がまだ見えていないだけ。",
      "反応が薄い夜ほど、自分の価値まで静かになったわけじゃない。",
    ],
    hashtags: ["#継続", "#発信", "#言葉の力", "#エモスイッチ"],
    selected_index: 0,
    likes: 128,
    memo: "夜21時投稿。1案目をそのまま採用。",
    advice_hint: "高い共感トーンは夜帯と相性が良い傾向です。",
    quick_feedback: "hot",
    memory_tags: ["共感導入", "余韻締め", "静かな比喩"],
    created_at: isoDaysAgo(5),
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    generation_mode: "single",
    draft: "やることは多いのに、結局どれも中途半端な気がする。",
    emotion: "useful",
    intensity: 60,
    speed_mode: "pro",
    variants: [
      "中途半端に見える日は、優先順位を1つに絞るだけで前進の実感が戻ってくる。",
      "全部を同時に進めるより、今日終わらせる1個を決めた方が心は軽くなる。",
      "散らかったタスクは、能力不足ではなく順番待ちの渋滞かもしれない。",
    ],
    hashtags: ["#タスク管理", "#仕事術", "#習慣化"],
    selected_index: 1,
    likes: 42,
    memo: "ハッシュタグを3個に絞った。",
    advice_hint: "有益トーンは具体的な行動提案と組み合わせると保存率が伸びやすいです。",
    quick_feedback: "hot",
    memory_tags: ["実用提案", "短文断定"],
    created_at: isoDaysAgo(4),
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    generation_mode: "single",
    draft: "最近なんか全部どうでもよく見えて、熱量が戻らない。",
    emotion: "mood",
    intensity: 85,
    speed_mode: "flash",
    variants: [
      "熱が消えたんじゃない。少し長く灯りを落としていただけかもしれない。",
      "何もかも灰色に見える日は、世界ではなく心の照度が落ちているだけ。",
      "気持ちが動かない夜は、動けない自分を責める前に静けさを受け入れたい。",
    ],
    hashtags: ["#情緒", "#夜の言葉", "#ひとりごと"],
    selected_index: 2,
    likes: 7,
    memo: "深夜帯。3案目に変更して投稿。",
    advice_hint: "情緒トーンは画像や余白のあるレイアウトと組み合わせると反応差を見やすいです。",
    quick_feedback: null,
    memory_tags: [],
    created_at: isoDaysAgo(3),
  },
  {
    id: "33333333-3333-4333-8333-333333333334",
    generation_mode: "single",
    draft: "正直、努力してない人ほど文句だけ一人前に見える。",
    emotion: "toxic",
    intensity: 90,
    speed_mode: "pro",
    variants: [
      "何も積まない人ほど、現実への不満だけは一流で語る。",
      "努力を笑う人は、挑戦しない自分を守る言い訳だけ上手い。",
      "口だけ達者で動かない人に、結果だけ欲しがる資格はない。",
    ],
    hashtags: ["#毒舌", "#本音", "#挑戦"],
    selected_index: 1,
    likes: 0,
    memo: "強すぎたかも。次は強度を下げて比較したい。",
    advice_hint: "毒舌トーンは刺さる一方で離脱も増えやすいので、主語を狭めると安定します。",
    quick_feedback: "cold",
    memory_tags: [],
    created_at: isoDaysAgo(2),
  },
  {
    id: "33333333-3333-4333-8333-333333333335",
    generation_mode: "single",
    draft: "言いたいことはあるのに、うまく短く言えない。",
    emotion: "minimal",
    intensity: 40,
    speed_mode: "flash",
    variants: ["長い迷いは、短い一文でほどける。", "削るほど、本音は残る。", "伝わる言葉は、足すより減らす。"],
    hashtags: ["#短文", "#ミニマル", "#言葉選び"],
    selected_index: null,
    likes: null,
    memo: null,
    advice_hint: "ミニマル案は句読点の有無でも印象が変わります。",
    quick_feedback: null,
    memory_tags: [],
    created_at: isoDaysAgo(1),
  },
];

const DEMO_GHOST_SOURCES = [
  {
    id: "22222222-2222-4222-8222-222222222221",
    source_url: "https://x.com/emo_switch_demo",
    source_type: "profile",
    status: "ready",
    imported_post_count: 28,
    created_at: isoDaysAgo(6),
    updated_at: isoDaysAgo(6),
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    source_url: "https://x.com/emo_switch_demo/status/1900000000000000000",
    source_type: "post",
    status: "ready",
    imported_post_count: 1,
    created_at: isoDaysAgo(2),
    updated_at: isoDaysAgo(2),
  },
] as const;

const DEMO_SERIES: Array<{
  id: string;
  title: string;
  source_draft: string;
  emotion: EmotionTone;
  intensity: number;
  speed_mode: "flash" | "pro";
  advice_hint: string | null;
  ghost_whisper: string | null;
  concept_brief?: ConceptBrief | null;
  quick_feedback: QuickFeedback;
  memory_tags: string[];
  created_at: string;
  items: Array<{
    id: string;
    slot_key: SeriesSlotKey;
    slot_label: string;
    body: string;
    hashtags: string[];
    quick_feedback: QuickFeedback;
    likes: number | null;
    memo: string | null;
    memory_tags: string[];
  }>;
}> = [
  {
    id: "44444444-4444-4444-8444-444444444441",
    title: "[連載] 続かない発信を立て直す3本",
    source_draft: "発信を続けたいのに、途中で気力が切れて止まってしまう。",
    emotion: "empathy",
    intensity: 45,
    speed_mode: "pro",
    advice_hint: "連載は温度差を付けると、週の流れとして読まれやすくなります。",
    ghost_whisper: "以前伸びた問いかけ導入を月曜に混ぜ、金曜は本音で締めています。",
    quick_feedback: "hot",
    memory_tags: ["問いかけ始まり", "共感導入", "本音吐露"],
    created_at: isoDaysAgo(2),
    items: [
      {
        id: "55555555-5555-4555-8555-555555555551",
        slot_key: "mon_problem",
        slot_label: getSeriesSlotLabel("mon_problem"),
        body: "発信が続かないのは、意思が弱いからじゃなくて、毎回ゼロから気持ちを作っているからかもしれない。",
        hashtags: ["#発信", "#継続", "#SNS運用"],
        quick_feedback: "hot",
        likes: 88,
        memo: "月曜朝に投稿。保存が多かった。",
        memory_tags: ["問いかけ始まり", "共感導入"],
      },
      {
        id: "55555555-5555-4555-8555-555555555552",
        slot_key: "wed_solution",
        slot_label: getSeriesSlotLabel("wed_solution"),
        body: "続けるコツは、ネタを増やすことより「次に何を書くか」を先に1本決めておくこと。",
        hashtags: ["#発信", "#習慣化", "#SNS運用"],
        quick_feedback: null,
        likes: 24,
        memo: "水曜昼。反応は普通。",
        memory_tags: [],
      },
      {
        id: "55555555-5555-4555-8555-555555555553",
        slot_key: "fri_emotion",
        slot_label: getSeriesSlotLabel("fri_emotion"),
        body: "ほんとは止まりたくなかった。だから今週も1本でも出せた自分を、ちゃんと褒めて終わりたい。",
        hashtags: ["#発信", "#本音", "#金曜の言葉"],
        quick_feedback: "hot",
        likes: 67,
        memo: "金曜夜に伸びた。",
        memory_tags: ["本音吐露", "余韻締め"],
      },
    ],
  },
];

type AppActor = {
  userId: string;
  mode: "auth" | "demo";
};

type DbProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  default_emotion: EmotionTone;
  writing_style: "polite" | "casual" | "passionate";
  sentence_style: "desumasu" | "friendly";
  plan_tier: "free" | "basic" | "creator" | "pro";
  subscription_tier: "free" | "basic" | "creator" | "pro";
  ai_wall_deep_enabled: boolean;
};

type DbSubscriptionRow = {
  status: string;
  plan_tier: "free" | "basic" | "creator" | "pro";
  subscription_tier: "free" | "basic" | "creator" | "pro";
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function mapGeneration(row: DbGenerationRow): GenerationRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    generationMode: "single",
    draft: row.draft,
    emotion: row.emotion,
    intensity: row.intensity,
    speedMode: row.speed_mode ?? undefined,
    variants: row.variants ?? [],
    hashtags: row.hashtags ?? [],
    selectedIndex: row.selected_index,
    likes: row.likes,
    memo: row.memo,
    adviceHint: stripConceptBriefFromAdviceHint(row.advice_hint),
    quickFeedback: row.quick_feedback,
    memoryTags: row.memory_tags ?? [],
  };
}

function mapSeriesItem(row: DbSeriesItemRow): GenerationSeriesItemRecord {
  return {
    id: row.id,
    seriesId: row.series_id,
    createdAt: row.created_at,
    slotKey: row.slot_key,
    slotLabel: row.slot_label,
    body: row.body,
    hashtags: row.hashtags ?? [],
    quickFeedback: row.quick_feedback,
    likes: row.likes,
    memo: row.memo,
    memoryTags: row.memory_tags ?? [],
  };
}

function deriveSeriesFeedback(items: GenerationSeriesItemRecord[]): QuickFeedback {
  if (items.some((item) => item.quickFeedback === "hot")) return "hot";
  if (items.length > 0 && items.every((item) => item.quickFeedback === "cold")) return "cold";
  return null;
}

function mapSeries(row: DbSeriesRow, items: DbSeriesItemRow[]): GenerationSeriesRecord {
  const mappedItems = items
    .filter((item) => item.deleted_at == null)
    .sort((left, right) => {
      const bySlot = compareSeriesSlotKey(left.slot_key, right.slot_key);
      if (bySlot !== 0) return bySlot;
      return left.created_at.localeCompare(right.created_at);
    })
    .map(mapSeriesItem);

  return {
    id: row.id,
    createdAt: row.created_at,
    generationMode: "series",
    title: row.title,
    draft: row.source_draft,
    emotion: row.emotion,
    intensity: row.intensity,
    speedMode: row.speed_mode ?? undefined,
    adviceHint: stripConceptBriefFromAdviceHint(row.advice_hint),
    ghostWhisper: row.ghost_whisper,
    conceptBrief: row.concept_brief ?? extractConceptBriefFromAdviceHint(row.advice_hint),
    quickFeedback: row.quick_feedback ?? deriveSeriesFeedback(mappedItems),
    memoryTags: row.memory_tags ?? [],
    items: mappedItems,
  };
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function groupVaultLogsByHypothesis(rows: DbVaultLogRow[]): Map<string, DbVaultLogRow[]> {
  const map = new Map<string, DbVaultLogRow[]>();
  for (const row of rows) {
    const current = map.get(row.hypothesis_id) ?? [];
    current.push(row);
    map.set(row.hypothesis_id, current);
  }
  for (const [key, value] of map) {
    value.sort((a, b) => b.created_at.localeCompare(a.created_at));
    map.set(key, value);
  }
  return map;
}

function deriveQuickFeedbackFromLogs(logs: DbVaultLogRow[]): QuickFeedback {
  const latest = logs.find((log) => log.reaction_type === "hot" || log.reaction_type === "cold");
  if (!latest) return null;
  return latest.reaction_type === "hot" ? "hot" : "cold";
}

function deriveLikesFromLogs(logs: DbVaultLogRow[]): number | null {
  const latest = logs.find((log) => log.reaction_type === "feedback" && typeof log.reaction_payload?.likes === "number");
  return latest && typeof latest.reaction_payload?.likes === "number" ? latest.reaction_payload.likes : null;
}

function deriveMemoFromLogs(logs: DbVaultLogRow[]): string | null {
  const latest = logs.find((log) => log.reaction_type === "memo" && typeof log.reaction_payload?.memo === "string");
  return latest && typeof latest.reaction_payload?.memo === "string" ? latest.reaction_payload.memo : null;
}

function mapSingleFromHypothesis(row: DbHypothesisRow, logs: DbVaultLogRow[]): GenerationRecord {
  const strategy = row.strategy_params ?? {};
  const output = row.output_content ?? {};
  const canonicalId =
    row.legacy_source_type === "generation" && row.legacy_source_id ? row.legacy_source_id : row.id;
  return {
    id: canonicalId,
    createdAt: row.created_at,
    generationMode: "single",
    draft: row.seed_input,
    emotion: strategy.emotion ?? "empathy",
    intensity: strategy.intensity ?? 50,
    speedMode: strategy.speed_mode ?? undefined,
    variants: asArray(output.variants),
    hashtags: asArray(output.hashtags),
    selectedIndex: typeof output.selected_index === "number" ? output.selected_index : null,
    likes: deriveLikesFromLogs(logs),
    memo: deriveMemoFromLogs(logs),
    adviceHint: stripConceptBriefFromAdviceHint(output.advice_hint),
    quickFeedback: deriveQuickFeedbackFromLogs(logs),
    memoryTags: asArray(output.memory_tags),
  };
}

function mapSeriesFromHypothesis(row: DbHypothesisRow, logs: DbVaultLogRow[]): GenerationSeriesRecord {
  const strategy = row.strategy_params ?? {};
  const output = row.output_content ?? {};
  const canonicalSeriesId =
    row.legacy_source_type === "series" && row.legacy_source_id ? row.legacy_source_id : row.id;
  const itemLogMap = new Map<string, DbVaultLogRow[]>();
  for (const log of logs) {
    const seriesItemId = log.reaction_payload?.series_item_id;
    if (!seriesItemId) continue;
    const current = itemLogMap.get(seriesItemId) ?? [];
    current.push(log);
    itemLogMap.set(seriesItemId, current);
  }
  const rawItems = asArray(output.items);
  const items: GenerationSeriesItemRecord[] = rawItems.map((item, index) => ({
    id: item.id ?? `${row.id}:${item.slot_key ?? index}`,
    seriesId: canonicalSeriesId,
    createdAt: item.created_at ?? row.created_at,
    slotKey: (item.slot_key ?? "mon_problem") as SeriesSlotKey,
    slotLabel: item.slot_label ?? getSeriesSlotLabel((item.slot_key ?? "mon_problem") as SeriesSlotKey),
    body: item.body ?? "",
    hashtags: asArray(item.hashtags),
    quickFeedback: (() => {
      const itemLogs = itemLogMap.get(item.id ?? "");
      if (!itemLogs) return item.quick_feedback ?? null;
      return deriveQuickFeedbackFromLogs(itemLogs) ?? item.quick_feedback ?? null;
    })(),
    likes: (() => {
      const itemLogs = itemLogMap.get(item.id ?? "");
      if (!itemLogs) return typeof item.likes === "number" ? item.likes : null;
      const fromLogs = deriveLikesFromLogs(itemLogs);
      return fromLogs ?? (typeof item.likes === "number" ? item.likes : null);
    })(),
    memo: (() => {
      const itemLogs = itemLogMap.get(item.id ?? "");
      if (!itemLogs) return item.memo ?? null;
      return deriveMemoFromLogs(itemLogs) ?? item.memo ?? null;
    })(),
    memoryTags: asArray(item.memory_tags),
  }));
  items.sort((left, right) => {
    const bySlot = compareSeriesSlotKey(left.slotKey, right.slotKey);
    if (bySlot !== 0) return bySlot;
    return left.createdAt.localeCompare(right.createdAt);
  });

  return {
    id: canonicalSeriesId,
    createdAt: row.created_at,
    generationMode: "series",
    title: output.title ?? strategy.title ?? "30日ロードマップ",
    draft: row.seed_input,
    emotion: strategy.emotion ?? "empathy",
    intensity: strategy.intensity ?? 50,
    speedMode: strategy.speed_mode ?? undefined,
    adviceHint: stripConceptBriefFromAdviceHint(output.advice_hint),
    ghostWhisper: output.ghost_whisper ?? null,
    conceptBrief: output.concept_brief ?? extractConceptBriefFromAdviceHint(output.advice_hint),
    quickFeedback: deriveQuickFeedbackFromLogs(logs) ?? deriveSeriesFeedback(items),
    memoryTags: asArray(output.memory_tags),
    items,
  };
}

function getUserDisplayName(user: User): string | null {
  const metadata = user.user_metadata;
  const candidates = [
    metadata?.full_name,
    metadata?.name,
    metadata?.display_name,
    user.email?.split("@")[0],
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

async function requireProfileRow(userId: string): Promise<DbProfileRow> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, display_name, default_emotion, writing_style, sentence_style, plan_tier, subscription_tier, ai_wall_deep_enabled",
    )
    .eq("id", userId)
    .single<DbProfileRow>();

  if (error) {
    throw error;
  }

  return data;
}

function normalizePlanTier(value: string | null | undefined): "free" | "basic" | "creator" | "pro" {
  if (value === "basic" || value === "creator" || value === "pro") return value;
  return "free";
}

function hasUnlimitedAccess(planTier: "free" | "basic" | "creator" | "pro"): boolean {
  return planTier !== "free";
}

function resolveRootsSyncPriority(planTier: "free" | "basic" | "creator" | "pro"): "standard" | "high" {
  return planTier === "creator" || planTier === "pro" ? "high" : "standard";
}

function canUseSurvivalSimulation(planTier: "free" | "basic" | "creator" | "pro"): boolean {
  return planTier === "pro";
}

export async function resolveBillingState(userId?: string): Promise<{
  planTier: "free" | "basic" | "creator" | "pro";
  subscriptionTier: "free" | "basic" | "creator" | "pro";
  aiWallDeepEnabled: boolean;
  isUnlimited: boolean;
  rootsSyncPriority: "standard" | "high";
  survivalSimulationEnabled: boolean;
}> {
  const scopedUserId = await resolveScopedUserId(userId);
  const [{ data: profile, error: profileError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("plan_tier, subscription_tier, ai_wall_deep_enabled")
      .eq("id", scopedUserId)
      .single<{
        plan_tier: "free" | "basic" | "creator" | "pro" | null;
        subscription_tier: "free" | "basic" | "creator" | "pro" | null;
        ai_wall_deep_enabled: boolean | null;
      }>(),
    supabaseAdmin
      .from("subscriptions")
      .select("status, plan_tier, subscription_tier")
      .eq("user_id", scopedUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .overrideTypes<DbSubscriptionRow[]>(),
  ]);
  if (profileError) throw profileError;
  if (subscriptionsError) throw subscriptionsError;

  const latestSub = subscriptions?.[0];
  const subActive = latestSub != null && (latestSub.status === "active" || latestSub.status === "trialing");
  const subscriptionTier = subActive
    ? normalizePlanTier(latestSub.subscription_tier ?? latestSub.plan_tier)
    : normalizePlanTier(profile.subscription_tier ?? profile.plan_tier);
  const planTier = subActive ? normalizePlanTier(latestSub.plan_tier) : normalizePlanTier(profile.plan_tier);
  const aiWallDeepEnabled = Boolean(profile.ai_wall_deep_enabled) || hasUnlimitedAccess(planTier);

  return {
    planTier,
    subscriptionTier,
    aiWallDeepEnabled,
    isUnlimited: hasUnlimitedAccess(planTier),
    rootsSyncPriority: resolveRootsSyncPriority(subscriptionTier),
    survivalSimulationEnabled: canUseSurvivalSimulation(subscriptionTier),
  };
}

export async function getDailyGenerationUsage(userId?: string): Promise<number> {
  const scopedUserId = await resolveScopedUserId(userId);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const from = start.toISOString();
  const to = end.toISOString();

  const { count, error } = await supabaseAdmin
    .from("hypotheses")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", scopedUserId)
    .neq("status", "draft")
    .is("deleted_at", null)
    .gte("created_at", from)
    .lt("created_at", to);
  if (error) throw error;
  if ((count ?? 0) > 0) return count ?? 0;

  const [{ count: singleCount, error: singleError }, { count: seriesCount, error: seriesError }] = await Promise.all([
    supabaseAdmin
      .from("generations")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", scopedUserId)
      .is("deleted_at", null)
      .gte("created_at", from)
      .lt("created_at", to),
    supabaseAdmin
      .from("generation_series")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", scopedUserId)
      .is("deleted_at", null)
      .gte("created_at", from)
      .lt("created_at", to),
  ]);
  if (singleError) throw singleError;
  if (seriesError) throw seriesError;
  return (singleCount ?? 0) + (seriesCount ?? 0);
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function readEnsuredUserCache(userId: string): boolean {
  const expiresAt = ensuredUserCache.get(userId);
  if (!expiresAt) return false;
  if (Date.now() >= expiresAt) {
    ensuredUserCache.delete(userId);
    return false;
  }
  return true;
}

function markUserEnsured(userId: string): void {
  ensuredUserCache.set(userId, Date.now() + ENSURED_USER_TTL_MS);
}

function trimCache<T>(cache: Map<string, T>, maxEntries: number): void {
  if (cache.size <= maxEntries) return;
  const firstKey = cache.keys().next().value;
  if (firstKey) cache.delete(firstKey);
}

type SchemaCoverage = {
  legacyCount: number;
  newCount: number;
  ratio: number;
  useLegacyFallback: boolean;
};

export async function getSchemaCoverage(userId?: string): Promise<SchemaCoverage> {
  const scopedUserId = await resolveScopedUserId(userId);
  const cached = schemaCoverageCache.get(scopedUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [{ count: singleCount, error: singleError }, { count: seriesCount, error: seriesError }, { count: newCount, error: newError }] =
    await Promise.all([
      supabaseAdmin.from("generations").select("id", { head: true, count: "exact" }).eq("user_id", scopedUserId).is("deleted_at", null),
      supabaseAdmin.from("generation_series").select("id", { head: true, count: "exact" }).eq("user_id", scopedUserId).is("deleted_at", null),
      supabaseAdmin.from("hypotheses").select("id", { head: true, count: "exact" }).eq("user_id", scopedUserId).is("deleted_at", null).neq("status", "draft"),
    ]);

  if (singleError) throw singleError;
  if (seriesError) throw seriesError;
  if (newError) throw newError;

  const legacyCount = (singleCount ?? 0) + (seriesCount ?? 0);
  const nextCount = newCount ?? 0;
  const ratio = legacyCount === 0 ? 1 : Math.min(1, nextCount / legacyCount);
  const value: SchemaCoverage = {
    legacyCount,
    newCount: nextCount,
    ratio,
    useLegacyFallback: ratio < NEW_SCHEMA_FALLBACK_RETIRE_THRESHOLD,
  };
  schemaCoverageCache.set(scopedUserId, { value, expiresAt: Date.now() + 60_000 });
  trimCache(schemaCoverageCache, 80);
  return value;
}

export async function backfillNewSchemaFromLegacy(userId?: string): Promise<{ upsertedHypotheses: number; upsertedLogs: number }> {
  const scopedUserId = await resolveScopedUserId(userId);
  const [settings, singles, series] = await Promise.all([
    getGhostSettings(scopedUserId),
    listGenerations(scopedUserId),
    listGenerationSeries(scopedUserId),
  ]);

  const currentIdentity = await getIdentityProfile(scopedUserId);
  await saveIdentityProfile(
    {
      ...currentIdentity,
      dnaAxes: {
        ...(currentIdentity.dnaAxes ?? {}),
        persona_keywords: settings.personaKeywords,
        persona_summary: settings.personaSummary,
      },
      myTaboo: {
        ...(currentIdentity.myTaboo ?? {}),
        anti_persona: settings.manualPosts.filter((line) => line.startsWith("anti_persona|")).map((line) => line.replace("anti_persona|", "")),
        ng_words: settings.ngWords,
      },
    },
    scopedUserId,
  );

  let upsertedHypotheses = 0;
  let upsertedLogs = 0;

  for (const row of singles) {
    const { data, error } = await supabaseAdmin
      .from("hypotheses")
      .upsert(
        {
          user_id: scopedUserId,
          legacy_source_type: "generation",
          legacy_source_id: row.id,
          generation_mode: "single",
          seed_input: row.draft,
          strategy_params: {
            emotion: row.emotion,
            intensity: row.intensity,
            speed_mode: row.speedMode ?? null,
          },
          identity_snapshot: {
            version: currentIdentity.version,
            current_prophecy: currentIdentity.currentProphecy,
            dna_completeness: currentIdentity.dnaCompleteness,
            dna_axes: currentIdentity.dnaAxes,
            my_taboo: currentIdentity.myTaboo,
          },
          output_content: {
            variants: row.variants,
            hashtags: row.hashtags,
            selected_index: row.selectedIndex,
            advice_hint: row.adviceHint ?? null,
            memory_tags: row.memoryTags ?? [],
          },
          status: "deployed",
          deployed_at: row.createdAt,
        },
        { onConflict: "legacy_source_type,legacy_source_id" },
      )
      .select("id")
      .single<{ id: string }>();
    if (error) throw error;
    upsertedHypotheses += 1;
    const hypothesisId = data.id;

    await supabaseAdmin
      .from("vault_logs")
      .delete()
      .eq("user_id", scopedUserId)
      .eq("hypothesis_id", hypothesisId)
      .contains("reaction_payload", { source: "legacy_backfill" });

    const logRows: Array<Record<string, unknown>> = [];
    if (row.quickFeedback) {
      logRows.push({ user_id: scopedUserId, hypothesis_id: hypothesisId, reaction_type: row.quickFeedback, reaction_payload: { source: "legacy_backfill" } });
    }
    if (row.likes != null) {
      logRows.push({ user_id: scopedUserId, hypothesis_id: hypothesisId, reaction_type: "feedback", reaction_payload: { source: "legacy_backfill", likes: row.likes } });
    }
    if (row.memo) {
      logRows.push({ user_id: scopedUserId, hypothesis_id: hypothesisId, reaction_type: "memo", reaction_payload: { source: "legacy_backfill", memo: row.memo } });
    }
    if (logRows.length > 0) {
      const { error: logError } = await supabaseAdmin.from("vault_logs").insert(logRows);
      if (logError) throw logError;
      upsertedLogs += logRows.length;
    }
  }

  for (const row of series) {
    const { data, error } = await supabaseAdmin
      .from("hypotheses")
      .upsert(
        {
          user_id: scopedUserId,
          legacy_source_type: "series",
          legacy_source_id: row.id,
          generation_mode: "series",
          seed_input: row.draft,
          strategy_params: {
            emotion: row.emotion,
            intensity: row.intensity,
            speed_mode: row.speedMode ?? null,
            title: row.title,
          },
          identity_snapshot: {
            version: currentIdentity.version,
            current_prophecy: currentIdentity.currentProphecy,
            dna_completeness: currentIdentity.dnaCompleteness,
            dna_axes: currentIdentity.dnaAxes,
            my_taboo: currentIdentity.myTaboo,
          },
          output_content: {
            title: row.title,
            advice_hint: row.adviceHint ?? null,
            ghost_whisper: row.ghostWhisper ?? null,
            concept_brief: row.conceptBrief ?? null,
            memory_tags: row.memoryTags ?? [],
            items: row.items.map((item) => ({
              id: item.id,
              slot_key: item.slotKey,
              slot_label: item.slotLabel,
              body: item.body,
              hashtags: item.hashtags,
              quick_feedback: item.quickFeedback,
              likes: item.likes,
              memo: item.memo,
              memory_tags: item.memoryTags ?? [],
              created_at: item.createdAt,
            })),
          },
          status: "deployed",
          deployed_at: row.createdAt,
        },
        { onConflict: "legacy_source_type,legacy_source_id" },
      )
      .select("id")
      .single<{ id: string }>();
    if (error) throw error;
    upsertedHypotheses += 1;
    const hypothesisId = data.id;

    await supabaseAdmin
      .from("vault_logs")
      .delete()
      .eq("user_id", scopedUserId)
      .eq("hypothesis_id", hypothesisId)
      .contains("reaction_payload", { source: "legacy_backfill" });

    const logRows: Array<Record<string, unknown>> = [];
    if (row.quickFeedback) {
      logRows.push({ user_id: scopedUserId, hypothesis_id: hypothesisId, reaction_type: row.quickFeedback, reaction_payload: { source: "legacy_backfill" } });
    }
    for (const item of row.items) {
      if (item.quickFeedback) {
        logRows.push({
          user_id: scopedUserId,
          hypothesis_id: hypothesisId,
          reaction_type: item.quickFeedback,
          reaction_payload: { source: "legacy_backfill", series_item_id: item.id, slot_key: item.slotKey },
        });
      }
      if (item.likes != null) {
        logRows.push({
          user_id: scopedUserId,
          hypothesis_id: hypothesisId,
          reaction_type: "feedback",
          reaction_payload: { source: "legacy_backfill", series_item_id: item.id, slot_key: item.slotKey, likes: item.likes },
        });
      }
      if (item.memo) {
        logRows.push({
          user_id: scopedUserId,
          hypothesis_id: hypothesisId,
          reaction_type: "memo",
          reaction_payload: { source: "legacy_backfill", series_item_id: item.id, slot_key: item.slotKey, memo: item.memo },
        });
      }
    }
    if (logRows.length > 0) {
      const { error: logError } = await supabaseAdmin.from("vault_logs").insert(logRows);
      if (logError) throw logError;
      upsertedLogs += logRows.length;
    }
  }

  schemaCoverageCache.delete(scopedUserId);
  return { upsertedHypotheses, upsertedLogs };
}

async function runPeriodicLegacyBackfill(userId: string): Promise<void> {
  const lastRunAt = legacyBackfillRunAt.get(userId) ?? 0;
  if (Date.now() - lastRunAt < LEGACY_BACKFILL_INTERVAL_MS) return;
  legacyBackfillRunAt.set(userId, Date.now());
  try {
    await backfillNewSchemaFromLegacy(userId);
  } catch {
    // Do not break user requests even if maintenance backfill fails.
  }
}

async function ensureAuthenticatedUser(user: User): Promise<string> {
  const userId = user.id;
  if (readEnsuredUserCache(userId)) {
    return userId;
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email: user.email ?? `${userId}@users.emoswitch.local`,
      display_name: getUserDisplayName(user),
      is_demo: false,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (profileError) throw profileError;

  markUserEnsured(userId);
  return userId;
}

async function getAuthenticatedUserFromToken(token: string): Promise<User> {
  const cached = authenticatedUserCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    await ensureAuthenticatedUser(cached.user);
    return cached.user;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    authenticatedUserCache.delete(token);
    throw new Error("認証ユーザーの取得に失敗しました");
  }

  authenticatedUserCache.set(token, {
    user,
    expiresAt: Date.now() + AUTH_USER_TTL_MS,
  });
  trimCache(authenticatedUserCache, 100);
  await ensureAuthenticatedUser(user);
  return user;
}

async function requireGenerationById(id: string, userId?: string): Promise<GenerationRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select(
      "id, created_at, generation_mode, draft, emotion, intensity, speed_mode, variants, hashtags, selected_index, likes, memo, advice_hint, quick_feedback, memory_tags, deleted_at",
    )
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null)
    .single<DbGenerationRow>();

  if (error) {
    throw error;
  }

  return mapGeneration(data);
}

async function requireGenerationSeriesById(id: string, userId?: string): Promise<GenerationSeriesRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const [{ data: seriesRow, error: seriesError }, { data: itemRows, error: itemsError }] = await Promise.all([
    supabaseAdmin
      .from("generation_series")
      .select(
        "id, created_at, title, source_draft, emotion, intensity, speed_mode, advice_hint, ghost_whisper, concept_brief, quick_feedback, memory_tags, deleted_at",
      )
      .eq("id", id)
      .eq("user_id", scopedUserId)
      .is("deleted_at", null)
      .single<DbSeriesRow>(),
    supabaseAdmin
      .from("generation_series_items")
      .select(
        "id, series_id, created_at, slot_key, slot_label, body, hashtags, quick_feedback, likes, memo, memory_tags, deleted_at",
      )
      .eq("series_id", id)
      .eq("user_id", scopedUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .overrideTypes<DbSeriesItemRow[]>(),
  ]);

  if (seriesError) throw seriesError;
  if (itemsError) throw itemsError;

  return mapSeries(seriesRow as DbSeriesRow, itemRows as DbSeriesItemRow[]);
}

export async function ensureDemoUser(): Promise<string> {
  if (!demoUserPromise) {
    demoUserPromise = (async () => {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        id: DEMO_USER_ID,
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: DEMO_DISPLAY_NAME, is_demo: true },
        app_metadata: { provider: "email", providers: ["email"] },
      });

      if (createError && !/already registered|already exists|duplicate/i.test(createError.message)) {
        throw createError;
      }

      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        {
          id: DEMO_USER_ID,
          email: DEMO_USER_EMAIL,
          display_name: DEMO_DISPLAY_NAME,
          is_demo: true,
        },
        { onConflict: "id", ignoreDuplicates: true },
      );

      if (profileError) {
        throw profileError;
      }

      markUserEnsured(DEMO_USER_ID);
      return DEMO_USER_ID;
    })().catch((error) => {
      demoUserPromise = null;
      throw error;
    });
  }

  return demoUserPromise;
}

export async function bootstrapDemoWorkspace(): Promise<{ userId: string; seeded: boolean }> {
  if (demoWorkspaceReady) {
    return { userId: DEMO_USER_ID, seeded: false };
  }

  if (demoWorkspacePromise) {
    return demoWorkspacePromise;
  }

  demoWorkspacePromise = (async () => {
    const userId = await ensureDemoUser();

    const [
      { count: generationCount, error: generationCountError },
      { count: seriesCount, error: seriesCountError },
      { count: ledgerCount, error: ledgerCountError },
      { count: sourceCount, error: sourceCountError },
      { count: ghostSettingsCount, error: ghostSettingsCountError },
    ] =
      await Promise.all([
        supabaseAdmin
          .from("generations")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabaseAdmin
          .from("generation_series")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabaseAdmin.from("credit_ledger").select("id", { head: true, count: "exact" }).eq("user_id", userId),
        supabaseAdmin
          .from("ghost_sources")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabaseAdmin.from("ghost_settings").select("user_id", { head: true, count: "exact" }).eq("user_id", userId),
      ]);

    if (generationCountError) throw generationCountError;
    if (seriesCountError) throw seriesCountError;
    if (ledgerCountError) throw ledgerCountError;
    if (sourceCountError) throw sourceCountError;
    if (ghostSettingsCountError) throw ghostSettingsCountError;

    const seeded = (generationCount ?? 0) === 0;

  if (seeded) {
    const { error: generationInsertError } = await supabaseAdmin.from("generations").insert(
      DEMO_GENERATIONS.map((row) => ({
        ...row,
        user_id: userId,
        updated_at: row.created_at,
      })),
    );

    if (generationInsertError) {
      throw generationInsertError;
    }
  }

  if ((seriesCount ?? 0) === 0) {
    const seriesRows = DEMO_SERIES.map((row) => ({
      id: row.id,
      user_id: userId,
      title: row.title,
      source_draft: row.source_draft,
      emotion: row.emotion,
      intensity: row.intensity,
      speed_mode: row.speed_mode,
      advice_hint: row.advice_hint,
      ghost_whisper: row.ghost_whisper,
      quick_feedback: row.quick_feedback,
      memory_tags: row.memory_tags,
      created_at: row.created_at,
      updated_at: row.created_at,
    }));

    const seriesItems = DEMO_SERIES.flatMap((row) =>
      row.items.map((item) => ({
        id: item.id,
        series_id: row.id,
        user_id: userId,
        slot_key: item.slot_key,
        slot_label: item.slot_label,
        body: item.body,
        hashtags: item.hashtags,
        quick_feedback: item.quick_feedback,
        likes: item.likes,
        memo: item.memo,
        memory_tags: item.memory_tags,
        created_at: row.created_at,
        updated_at: row.created_at,
      })),
    );

    const { error: seriesInsertError } = await supabaseAdmin.from("generation_series").insert(seriesRows);
    if (seriesInsertError) throw seriesInsertError;

    const { error: seriesItemInsertError } = await supabaseAdmin
      .from("generation_series_items")
      .insert(seriesItems);
    if (seriesItemInsertError) throw seriesItemInsertError;
  }

  if ((sourceCount ?? 0) === 0) {
    const { error: sourceInsertError } = await supabaseAdmin.from("ghost_sources").insert(
      DEMO_GHOST_SOURCES.map((row) => ({
        ...row,
        user_id: userId,
      })),
    );

    if (sourceInsertError) {
      throw sourceInsertError;
    }
  }

  if ((ledgerCount ?? 0) === 0) {
    const demoLedger = [
      {
        user_id: userId,
        delta: 50,
        reason: "free_grant",
        note: "初回デモ付与",
        metadata: { source: "bootstrap" },
        created_at: isoDaysAgo(6),
      },
      ...DEMO_GENERATIONS.map((row, index) => ({
        user_id: userId,
        delta: -1,
        reason: "admin_seed",
        note: `デモ履歴 ${index + 1}`,
        metadata: { generation_id: row.id },
        created_at: row.created_at,
      })),
      ...DEMO_SERIES.map((row, index) => ({
        user_id: userId,
        delta: -1,
        reason: "admin_seed",
        note: `デモ連載 ${index + 1}`,
        metadata: { generation_series_id: row.id },
        created_at: row.created_at,
      })),
    ];

    const { error: ledgerInsertError } = await supabaseAdmin.from("credit_ledger").insert(demoLedger);

    if (ledgerInsertError) {
      throw ledgerInsertError;
    }
  }

  if ((ghostSettingsCount ?? 0) === 0) {
    const { error: ghostSettingsError } = await supabaseAdmin.from("ghost_settings").insert({
      user_id: userId,
      profile_url: "https://x.com/emo_switch_demo",
      ng_words: ["炎上", "上から目線", "マジで"],
      style_prompt: "やさしいけれど甘すぎない。語尾はやわらかめで、少し余韻を残す。",
      manual_posts: [
        "頑張ってるのに結果が出ない日は、才能よりもタイミングを疑いたい。",
        "ちゃんとしてるのに伝わらないなら、言葉より温度感がズレているのかもしれない。",
        "今日も一歩だけ進めたなら、それは止まらなかった証拠だと思う。",
      ],
      persona_keywords: ["やさしい余韻", "短文中心", "共感の導入", "断定しすぎない", "夜に合う空気感"],
      persona_summary:
        "読者の気持ちを受け止める導入から始まり、短い文で静かに余韻を残すペルソナ。強い断定よりも、そっと背中を押す距離感を大切にしている。",
      persona_evidence: [
        "共感トーンの成功投稿が複数あり、読者に寄り添う始まり方が安定している",
        "採用される文章は短文かつ1文完結が多い",
        "NGワード設定から、強すぎる表現や違和感のある言い回しを避ける傾向がある",
      ],
      persona_status: "approved",
      persona_last_analyzed_hot_count: 3,
    });

    if (ghostSettingsError) {
      throw ghostSettingsError;
    }
  }

    demoWorkspaceReady = true;
    return { userId, seeded };
  })().catch((error) => {
    demoWorkspacePromise = null;
    throw error;
  });

  return demoWorkspacePromise;
}

export async function resolveRequestActor(request: Request): Promise<AppActor> {
  const token = getBearerToken(request);

  if (!token) {
    const { userId } = await bootstrapDemoWorkspace();
    return { userId, mode: "demo" };
  }

  const user = await getAuthenticatedUserFromToken(token);
  return { userId: user.id, mode: "auth" };
}

export async function requireAuthenticatedUserFromRequest(request: Request): Promise<User> {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("ログインが必要です");
  }

  return getAuthenticatedUserFromToken(token);
}

async function resolveScopedUserId(userId?: string): Promise<string> {
  return userId ?? (await ensureDemoUser());
}

function clearArchiveOverviewCache(): void {
  archiveOverviewCache.clear();
}

async function loadLegacyGenerationRecords(scopedUserId: string): Promise<GenerationRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select(
      "id, created_at, generation_mode, draft, emotion, intensity, speed_mode, variants, hashtags, selected_index, likes, memo, advice_hint, quick_feedback, memory_tags, deleted_at",
    )
    .eq("user_id", scopedUserId)
    .eq("generation_mode", "single")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .overrideTypes<DbGenerationRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => mapGeneration(row as DbGenerationRow));
}

async function loadLegacyGenerationSeriesRecords(scopedUserId: string): Promise<GenerationSeriesRecord[]> {
  const [{ data: seriesRows, error: seriesError }, { data: itemRows, error: itemsError }] = await Promise.all([
    supabaseAdmin
      .from("generation_series")
      .select(
        "id, created_at, title, source_draft, emotion, intensity, speed_mode, advice_hint, ghost_whisper, concept_brief, quick_feedback, memory_tags, deleted_at",
      )
      .eq("user_id", scopedUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .overrideTypes<DbSeriesRow[]>(),
    supabaseAdmin
      .from("generation_series_items")
      .select(
        "id, series_id, created_at, slot_key, slot_label, body, hashtags, quick_feedback, likes, memo, memory_tags, deleted_at",
      )
      .eq("user_id", scopedUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .overrideTypes<DbSeriesItemRow[]>(),
  ]);
  if (seriesError) throw seriesError;
  if (itemsError) throw itemsError;
  const itemsBySeries = new Map<string, DbSeriesItemRow[]>();
  for (const row of itemRows ?? []) {
    const item = row as DbSeriesItemRow;
    const current = itemsBySeries.get(item.series_id) ?? [];
    current.push(item);
    itemsBySeries.set(item.series_id, current);
  }
  return (seriesRows ?? []).map((row) => mapSeries(row as DbSeriesRow, itemsBySeries.get(row.id) ?? []));
}

export async function listGenerations(
  userId?: string,
  options?: { pivotOnly?: boolean },
): Promise<GenerationRecord[]> {
  const scopedUserId = await resolveScopedUserId(userId);
  const pivotOnly = options?.pivotOnly ?? false;
  const singleQuery = supabaseAdmin
    .from("hypotheses")
    .select(
      "id, user_id, generation_mode, seed_input, strategy_params, output_content, status, created_at, updated_at, deleted_at, legacy_source_type, legacy_source_id",
    )
    .eq("user_id", scopedUserId)
    .eq("generation_mode", "single")
    .neq("status", "draft")
    .is("deleted_at", null);
  if (pivotOnly) {
    singleQuery.or("legacy_source_type.is.null,legacy_source_type.eq.generation");
  }
  const { data: hypothesisRows, error: hypothesisError } = await singleQuery
    .order("created_at", { ascending: false })
    .overrideTypes<DbHypothesisRow[]>();

  let mappedFromHyp: GenerationRecord[] = [];
  if (!hypothesisError && (hypothesisRows?.length ?? 0) > 0) {
    const ids = hypothesisRows!.map((row) => row.id);
    const { data: logs, error: logsError } = await supabaseAdmin
      .from("vault_logs")
      .select("id, hypothesis_id, reaction_type, reaction_payload, created_at")
      .eq("user_id", scopedUserId)
      .in("hypothesis_id", ids)
      .order("created_at", { ascending: false })
      .overrideTypes<DbVaultLogRow[]>();
    if (logsError) throw logsError;

    const grouped = groupVaultLogsByHypothesis(logs ?? []);
    mappedFromHyp = hypothesisRows!.map((row) => mapSingleFromHypothesis(row, grouped.get(row.id) ?? []));
  } else if (hypothesisError) {
    throw hypothesisError;
  }

  const legacyMapped = await loadLegacyGenerationRecords(scopedUserId);
  const mergedIds = new Set(mappedFromHyp.map((r) => r.id));
  const merged = [...mappedFromHyp, ...legacyMapped.filter((r) => !mergedIds.has(r.id))];
  merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return merged;
}

export async function listGenerationSeries(
  userId?: string,
  options?: { pivotOnly?: boolean },
): Promise<GenerationSeriesRecord[]> {
  const scopedUserId = await resolveScopedUserId(userId);
  const pivotOnly = options?.pivotOnly ?? false;
  const seriesQuery = supabaseAdmin
    .from("hypotheses")
    .select(
      "id, user_id, generation_mode, seed_input, strategy_params, output_content, status, created_at, updated_at, deleted_at, legacy_source_type, legacy_source_id",
    )
    .eq("user_id", scopedUserId)
    .eq("generation_mode", "series")
    .neq("status", "draft")
    .is("deleted_at", null);
  if (pivotOnly) {
    seriesQuery.or("legacy_source_type.is.null,legacy_source_type.eq.series");
  }
  const { data: hypothesisRows, error: hypothesisError } = await seriesQuery
    .order("created_at", { ascending: false })
    .overrideTypes<DbHypothesisRow[]>();

  let mappedFromHyp: GenerationSeriesRecord[] = [];
  if (!hypothesisError && (hypothesisRows?.length ?? 0) > 0) {
    const ids = hypothesisRows!.map((row) => row.id);
    const { data: logs, error: logsError } = await supabaseAdmin
      .from("vault_logs")
      .select("id, hypothesis_id, reaction_type, reaction_payload, created_at")
      .eq("user_id", scopedUserId)
      .in("hypothesis_id", ids)
      .order("created_at", { ascending: false })
      .overrideTypes<DbVaultLogRow[]>();
    if (logsError) throw logsError;

    const grouped = groupVaultLogsByHypothesis(logs ?? []);
    mappedFromHyp = hypothesisRows!.map((row) => mapSeriesFromHypothesis(row, grouped.get(row.id) ?? []));
  } else if (hypothesisError) {
    throw hypothesisError;
  }

  const legacyMapped = await loadLegacyGenerationSeriesRecords(scopedUserId);
  const mergedIds = new Set(mappedFromHyp.map((r) => r.id));
  const merged = [...mappedFromHyp, ...legacyMapped.filter((r) => !mergedIds.has(r.id))];
  merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return merged;
}

export async function getArchiveOverview(userId?: string): Promise<ArchiveOverview> {
  return getArchiveOverviewWithOptions(userId);
}

export async function getArchiveOverviewWithOptions(
  userId?: string,
  options?: { includeEntries?: boolean; pivotOnly?: boolean },
): Promise<ArchiveOverview> {
  const scopedUserId = await resolveScopedUserId(userId);
  await runPeriodicLegacyBackfill(scopedUserId);
  const includeEntries = options?.includeEntries ?? true;
  const pivotOnly = options?.pivotOnly ?? false;
  const cacheKey = `${scopedUserId}:${includeEntries ? "full" : "summary"}:${pivotOnly ? "pivot" : "all"}`;
  const cached = archiveOverviewCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const listSingles = async () => {
    return listGenerations(scopedUserId, { pivotOnly });
  };
  const listSeries = async () => {
    return listGenerationSeries(scopedUserId, { pivotOnly });
  };

  const overview = includeEntries
    ? await (async () => {
        const [entries, series] = await Promise.all([listSingles(), listSeries()]);
        const singles = entries.filter((entry) => entry.generationMode === "single");
        const allEntries = [...singles, ...series].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

        return {
          entries: allEntries,
          insights: buildArchiveInsights(singles, series),
        } satisfies ArchiveOverview;
      })()
    : await (async () => {
        const [entries, seriesRows] = await Promise.all([listSingles(), listSeries()]);
        const singles: ArchiveInsightSingleInput[] = entries.map((row) => ({
          emotion: row.emotion,
          intensity: row.intensity,
          quickFeedback: row.quickFeedback ?? null,
        }));
        const series: ArchiveInsightSeriesInput[] = seriesRows.map((row) => ({
          emotion: row.emotion,
          intensity: row.intensity,
          items: row.items.map((item) => ({ quickFeedback: item.quickFeedback ?? null })),
        }));

        return {
          entries: [],
          insights: buildArchiveInsights(singles, series),
        } satisfies ArchiveOverview;
      })();

  archiveOverviewCache.set(cacheKey, {
    value: overview,
    expiresAt: Date.now() + ARCHIVE_OVERVIEW_TTL_MS,
  });
  trimCache(archiveOverviewCache, 40);

  return overview;
}

export async function listHotGenerationMemories(userId?: string): Promise<HotGenerationMemory[]> {
  const scopedUserId = await resolveScopedUserId(userId);
  const [singleRows, seriesRows] = await Promise.all([listGenerations(scopedUserId), listGenerationSeries(scopedUserId)]);

  const singleMemories = singleRows
    .filter((row) => row.quickFeedback === "hot")
    .map((row) => {
      const selectedIndex = row.selectedIndex;
      const selectedText = selectedIndex != null && row.variants[selectedIndex] ? row.variants[selectedIndex] : null;
      if (!selectedText) return null;
      return {
        id: row.id,
        createdAt: row.createdAt,
        draft: row.draft,
        emotion: row.emotion,
        selectedText,
        likes: row.likes,
        memo: row.memo ?? null,
        memoryTags: row.memoryTags ?? [],
      } satisfies HotGenerationMemory;
    })
    .filter((row): row is HotGenerationMemory => row !== null);

  const seriesMemories: HotGenerationMemory[] = seriesRows.flatMap((row) =>
    row.items
      .filter((item) => item.quickFeedback === "hot")
      .map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        draft: row.draft,
        emotion: row.emotion,
        selectedText: item.body,
        likes: item.likes,
        memo: item.memo ?? null,
        slotLabel: item.slotLabel,
        memoryTags: item.memoryTags ?? [],
      })),
  );

  return [...singleMemories, ...seriesMemories]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 16);
}

export async function createGeneration(
  input: GenerationCreateInput,
  userId?: string,
): Promise<GenerationRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin.rpc("create_generation_with_credit", {
    p_user_id: scopedUserId,
    p_draft: input.draft,
    p_emotion: input.emotion,
    p_intensity: input.intensity,
    p_speed_mode: input.speedMode ?? null,
    p_variants: input.variants,
    p_hashtags: input.hashtags,
    p_selected_index: input.selectedIndex,
    p_likes: input.likes,
    p_memo: input.memo,
    p_advice_hint: input.adviceHint,
  });

  if (error) {
    if (/NO_CREDITS_REMAINING/.test(error.message)) {
      throw new Error("クレジットが残っていません。");
    }
    throw error;
  }

  clearArchiveOverviewCache();
  return requireGenerationById(String(data), scopedUserId);
}

export async function createGenerationSeries(
  input: GenerationSeriesCreateInput,
  userId?: string,
): Promise<GenerationSeriesRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const adviceHintWithBrief = embedConceptBriefInAdviceHint(input.adviceHint, input.conceptBrief);
  const { data, error } = await supabaseAdmin.rpc("create_generation_series_with_credit", {
    p_user_id: scopedUserId,
    p_title: input.title,
    p_source_draft: input.draft,
    p_emotion: input.emotion,
    p_intensity: input.intensity,
    p_speed_mode: input.speedMode ?? null,
    p_items: input.items,
    p_advice_hint: adviceHintWithBrief,
    p_ghost_whisper: input.ghostWhisper ?? null,
    p_memory_tags: input.memoryTags ?? [],
  });

  if (error) {
    if (/NO_CREDITS_REMAINING/.test(error.message)) {
      throw new Error("クレジットが残っていません。");
    }
    throw error;
  }

  const seriesId = String(data);
  if (input.conceptBrief) {
    const { error: conceptError } = await supabaseAdmin
      .from("generation_series")
      .update({ concept_brief: input.conceptBrief })
      .eq("id", seriesId)
      .eq("user_id", scopedUserId)
      .is("deleted_at", null);
    if (conceptError) throw conceptError;
  }

  clearArchiveOverviewCache();
  return requireGenerationSeriesById(seriesId, scopedUserId);
}

export async function seedArchiveSampleGenerations(userId?: string): Promise<{ insertedCount: number }> {
  const scopedUserId = await resolveScopedUserId(userId);
  const [{ count: singleCount, error: singleCountError }, { count: seriesCount, error: seriesCountError }] =
    await Promise.all([
      supabaseAdmin
        .from("generations")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", scopedUserId)
        .is("deleted_at", null),
      supabaseAdmin
        .from("generation_series")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", scopedUserId)
        .is("deleted_at", null),
    ]);

  if (singleCountError) throw singleCountError;
  if (seriesCountError) throw seriesCountError;

  let insertedCount = 0;

  if ((singleCount ?? 0) === 0) {
    const rowsToInsert = DEMO_GENERATIONS.map((row) => ({
      ...row,
      id: crypto.randomUUID(),
      user_id: scopedUserId,
      updated_at: row.created_at,
    }));

    const { error: insertError } = await supabaseAdmin.from("generations").insert(rowsToInsert);

    if (insertError) {
      throw insertError;
    }
    insertedCount += rowsToInsert.length;
  }

  if ((seriesCount ?? 0) > 0) {
    if (insertedCount > 0) clearArchiveOverviewCache();
    return { insertedCount };
  }

  const seriesRows = DEMO_SERIES.map((row) => ({
    id: crypto.randomUUID(),
    user_id: scopedUserId,
    title: row.title,
    source_draft: row.source_draft,
    emotion: row.emotion,
    intensity: row.intensity,
    speed_mode: row.speed_mode,
    advice_hint: row.advice_hint,
    ghost_whisper: row.ghost_whisper,
    concept_brief: row.concept_brief ?? null,
    quick_feedback: row.quick_feedback,
    memory_tags: row.memory_tags,
    created_at: row.created_at,
    updated_at: row.created_at,
  }));

  const seriesIdMap = new Map<string, string>();
  DEMO_SERIES.forEach((row, index) => {
    seriesIdMap.set(row.id, String(seriesRows[index]?.id));
  });

  const seriesItems = DEMO_SERIES.flatMap((row) =>
    row.items.map((item) => ({
      id: crypto.randomUUID(),
      series_id: seriesIdMap.get(row.id) as string,
      user_id: scopedUserId,
      slot_key: item.slot_key,
      slot_label: item.slot_label,
      body: item.body,
      hashtags: item.hashtags,
      quick_feedback: item.quick_feedback,
      likes: item.likes,
      memo: item.memo,
      memory_tags: item.memory_tags,
      created_at: row.created_at,
      updated_at: row.created_at,
    })),
  );

  const { error: seriesError } = await supabaseAdmin.from("generation_series").insert(seriesRows);
  if (seriesError) throw seriesError;

  const { error: seriesItemsError } = await supabaseAdmin.from("generation_series_items").insert(seriesItems);
  if (seriesItemsError) throw seriesItemsError;

  insertedCount += seriesRows.length;
  clearArchiveOverviewCache();
  return { insertedCount };
}

async function refreshSeriesAggregate(seriesId: string, userId?: string): Promise<void> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("generation_series_items")
    .select("quick_feedback, memory_tags")
    .eq("series_id", seriesId)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);

  if (error) throw error;

  const quickFeedbacks = (data ?? []).map((row) => row.quick_feedback as QuickFeedback);
  const aggregateQuickFeedback: QuickFeedback =
    quickFeedbacks.some((value) => value === "hot")
      ? "hot"
      : quickFeedbacks.length > 0 && quickFeedbacks.every((value) => value === "cold")
        ? "cold"
        : null;
  const memoryTags = Array.from(
    new Set(
      (data ?? []).flatMap((row) => ((row.memory_tags as string[] | null) ?? []).filter(Boolean)),
    ),
  );

  const { error: updateError } = await supabaseAdmin
    .from("generation_series")
    .update({
      quick_feedback: aggregateQuickFeedback,
      memory_tags: memoryTags,
    })
    .eq("id", seriesId)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);

  if (updateError) throw updateError;
}

export async function updateGeneration(
  id: string,
  patch: GenerationUpdateInput,
  userId?: string,
): Promise<GenerationRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const updatePayload: Record<string, number | string | string[] | null> = {};
  const currentRow = patch.quickFeedback !== undefined ? await requireGenerationById(id, scopedUserId) : null;

  if (patch.selectedIndex !== undefined) updatePayload.selected_index = patch.selectedIndex;
  if (patch.likes !== undefined) updatePayload.likes = patch.likes;
  if (patch.memo !== undefined) updatePayload.memo = patch.memo;
  if (patch.quickFeedback !== undefined) updatePayload.quick_feedback = patch.quickFeedback;
  if (patch.quickFeedback !== undefined && currentRow) {
    const selectedIndex = patch.selectedIndex ?? currentRow.selectedIndex;
    const selectedText =
      selectedIndex != null && currentRow.variants[selectedIndex] ? currentRow.variants[selectedIndex] : null;
    updatePayload.memory_tags =
      patch.quickFeedback === "hot" ? inferMemoryTags(selectedText, currentRow.draft, patch.memo, currentRow.memo) : [];
  }

  const { error } = await supabaseAdmin
    .from("generations")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  return requireGenerationById(id, scopedUserId);
}

export async function updateGenerationSeriesItem(
  id: string,
  patch: GenerationSeriesItemUpdateInput,
  userId?: string,
): Promise<GenerationSeriesItemRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data: currentRow, error: currentError } = await supabaseAdmin
    .from("generation_series_items")
    .select(
      "id, series_id, created_at, slot_key, slot_label, body, hashtags, quick_feedback, likes, memo, memory_tags, deleted_at",
    )
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null)
    .single<DbSeriesItemRow>();

  if (currentError) throw currentError;

  const updatePayload: Record<string, number | string | string[] | null> = {};
  if (patch.likes !== undefined) updatePayload.likes = patch.likes;
  if (patch.memo !== undefined) updatePayload.memo = patch.memo;
  if (patch.quickFeedback !== undefined) {
    updatePayload.quick_feedback = patch.quickFeedback;
    updatePayload.memory_tags =
      patch.quickFeedback === "hot" ? inferMemoryTags(currentRow.body, patch.memo, currentRow.memo) : [];
  }

  const { error } = await supabaseAdmin
    .from("generation_series_items")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);

  if (error) throw error;

  await refreshSeriesAggregate(currentRow.series_id, scopedUserId);
  clearArchiveOverviewCache();
  return requireGenerationSeriesById(currentRow.series_id, scopedUserId).then(
    (series) => series.items.find((item) => item.id === id) as GenerationSeriesItemRecord,
  );
}

export async function updateGenerationSeriesConceptBrief(
  id: string,
  conceptBrief: ConceptBrief,
  userId?: string,
): Promise<GenerationSeriesRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data: currentRow, error: currentError } = await supabaseAdmin
    .from("generation_series")
    .select("advice_hint")
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null)
    .single<Pick<DbSeriesRow, "advice_hint">>();

  if (currentError) throw currentError;

  const nextAdviceHint = embedConceptBriefInAdviceHint(currentRow.advice_hint, conceptBrief);
  const { error } = await supabaseAdmin
    .from("generation_series")
    .update({
      advice_hint: nextAdviceHint,
      concept_brief: conceptBrief,
    })
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);

  if (error) throw error;

  const { data: hypothesisRow } = await supabaseAdmin
    .from("hypotheses")
    .select("id, output_content")
    .eq("user_id", scopedUserId)
    .eq("legacy_source_type", "series")
    .eq("legacy_source_id", id)
    .is("deleted_at", null)
    .maybeSingle<Pick<DbHypothesisRow, "id" | "output_content">>();

  if (hypothesisRow) {
    await supabaseAdmin
      .from("hypotheses")
      .update({
        output_content: {
          ...(hypothesisRow.output_content ?? {}),
          concept_brief: conceptBrief,
          advice_hint: stripConceptBriefFromAdviceHint(nextAdviceHint),
        },
      })
      .eq("id", hypothesisRow.id)
      .eq("user_id", scopedUserId);
  }

  clearArchiveOverviewCache();
  return requireGenerationSeriesById(id, scopedUserId);
}

export async function appendIdentityFieldBufferEntry(
  entry: IdentityFieldBufferEntryInput,
  userId?: string,
): Promise<void> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { error } = await supabaseAdmin.from("identity_field_buffer_entries").insert({
    user_id: scopedUserId,
    series_id: entry.seriesId,
    item_id: entry.itemId,
    quick_feedback: entry.quickFeedback,
    likes: entry.likes,
    memo: entry.memo,
  });
  if (error) throw error;
}

export async function listIdentityFieldBufferSeriesSummary(
  userId?: string,
): Promise<IdentityFieldBufferSeriesSummary[]> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("identity_field_buffer_entries")
    .select("series_id")
    .eq("user_id", scopedUserId)
    .is("resolved_at", null)
    .returns<Pick<DbIdentityFieldBufferEntryRow, "series_id">[]>();
  if (error) throw error;
  const countBySeries = new Map<string, number>();
  for (const row of data ?? []) {
    countBySeries.set(row.series_id, (countBySeries.get(row.series_id) ?? 0) + 1);
  }
  return Array.from(countBySeries.entries()).map(([seriesId, pendingCount]) => ({
    seriesId,
    pendingCount,
  }));
}

export async function resolveIdentityFieldBufferEntries(userId?: string): Promise<number> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("identity_field_buffer_entries")
    .update({ resolved_at: new Date().toISOString() })
    .eq("user_id", scopedUserId)
    .is("resolved_at", null)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function softDeleteGeneration(id: string, userId?: string): Promise<void> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { error } = await supabaseAdmin
    .from("generations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
}

export async function softDeleteGenerationSeries(id: string, userId?: string): Promise<void> {
  const scopedUserId = await resolveScopedUserId(userId);
  const deletedAt = new Date().toISOString();

  const { error: seriesError } = await supabaseAdmin
    .from("generation_series")
    .update({ deleted_at: deletedAt })
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);
  if (seriesError) throw seriesError;

  const { error: itemError } = await supabaseAdmin
    .from("generation_series_items")
    .update({ deleted_at: deletedAt })
    .eq("series_id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);
  if (itemError) throw itemError;
}

export async function getGhostSettings(userId?: string): Promise<GhostSettings> {
  const scopedUserId = await resolveScopedUserId(userId);
  const [{ data, error }, { data: identityRow }] = await Promise.all([
    supabaseAdmin
    .from("ghost_settings")
    .select("profile_url, ng_words, style_prompt, manual_posts, persona_keywords, persona_summary, persona_evidence, persona_status, persona_last_analyzed_hot_count")
    .eq("user_id", scopedUserId)
    .single<{
      profile_url: string;
      ng_words: string[];
      style_prompt: string | null;
      manual_posts: string[] | null;
      persona_keywords: string[] | null;
      persona_summary: string | null;
      persona_evidence: string[] | null;
      persona_status: "empty" | "draft" | "approved" | null;
      persona_last_analyzed_hot_count: number | null;
    }>(),
    supabaseAdmin
      .from("identities")
      .select("dna_axes, my_taboo, current_prophecy, dna_completeness")
      .eq("user_id", scopedUserId)
      .maybeSingle<{
        dna_axes: { persona_keywords?: string[]; persona_summary?: string } | null;
        my_taboo: { anti_persona?: string[]; ng_words?: string[] } | null;
        current_prophecy: string | null;
        dna_completeness: number | null;
      }>(),
  ]);

  if (error) {
    return DEFAULT_GHOST_SETTINGS;
  }

  const identityKeywords = Array.isArray(identityRow?.dna_axes?.persona_keywords)
    ? identityRow?.dna_axes?.persona_keywords
    : [];
  const identitySummary = identityRow?.dna_axes?.persona_summary ?? "";
  const identityAntiPersona = Array.isArray(identityRow?.my_taboo?.anti_persona)
    ? identityRow.my_taboo.anti_persona.map((item) => `anti_persona|${item}`)
    : [];
  const identityNgWords = Array.isArray(identityRow?.my_taboo?.ng_words) ? identityRow.my_taboo.ng_words : [];

  return {
    profileUrl: data.profile_url ?? "",
    ngWords: (data.ng_words ?? []).length > 0 ? data.ng_words ?? [] : identityNgWords,
    stylePrompt: data.style_prompt ?? "",
    manualPosts: (data.manual_posts ?? []).length > 0 ? data.manual_posts ?? [] : identityAntiPersona,
    personaKeywords: (data.persona_keywords ?? []).length > 0 ? data.persona_keywords ?? [] : identityKeywords,
    personaSummary: data.persona_summary ?? identitySummary,
    personaEvidence: data.persona_evidence ?? [],
    personaStatus: data.persona_status ?? "empty",
    personaLastAnalyzedHotCount:
      data.persona_last_analyzed_hot_count ?? Math.max(0, Math.floor((identityRow?.dna_completeness ?? 0) / 10)),
  };
}

export async function saveGhostSettings(settings: GhostSettings, userId?: string): Promise<GhostSettings> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { error } = await supabaseAdmin.from("ghost_settings").upsert(
    {
      user_id: scopedUserId,
      profile_url: settings.profileUrl,
      ng_words: settings.ngWords,
      style_prompt: settings.stylePrompt,
      // Legacy identity fields are intentionally not synced from app updates anymore.
      persona_status: settings.personaStatus,
      persona_last_analyzed_hot_count: settings.personaLastAnalyzedHotCount,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  return getGhostSettings(scopedUserId);
}

export async function getIdentityProfile(userId?: string): Promise<IdentityProfile> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("identities")
    .select("dna_axes, my_taboo, current_prophecy, dna_completeness, version")
    .eq("user_id", scopedUserId)
    .maybeSingle<{
      dna_axes: Record<string, unknown> | null;
      my_taboo: Record<string, unknown> | null;
      current_prophecy: string | null;
      dna_completeness: number | null;
      version: number | null;
    }>();

  if (error || !data) return DEFAULT_IDENTITY_PROFILE;
  return {
    dnaAxes: data.dna_axes ?? {},
    myTaboo: data.my_taboo ?? {},
    currentProphecy: data.current_prophecy ?? "平均的な起業家",
    dnaCompleteness: data.dna_completeness ?? 0,
    version: data.version ?? 1,
  };
}

export async function saveIdentityProfile(profile: IdentityProfile, userId?: string): Promise<IdentityProfile> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { error } = await supabaseAdmin.from("identities").upsert(
    {
      user_id: scopedUserId,
      dna_axes: profile.dnaAxes,
      my_taboo: profile.myTaboo,
      current_prophecy: profile.currentProphecy,
      dna_completeness: profile.dnaCompleteness,
      version: profile.version,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return getIdentityProfile(scopedUserId);
}

export async function getCreditSummary(userId?: string): Promise<CreditSummary> {
  const scopedUserId = await resolveScopedUserId(userId);
  const [{ data, error }, billing, dailyUsed] = await Promise.all([
    supabaseAdmin.rpc("get_credit_summary", {
      p_user_id: scopedUserId,
    }),
    resolveBillingState(scopedUserId),
    getDailyGenerationUsage(scopedUserId),
  ]);

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  const dailyLimit = billing.isUnlimited ? null : 3;

  return {
    remaining: Number(row?.remaining ?? 0),
    used: Number(row?.used ?? 0),
    granted: Number(row?.granted ?? 0),
    dailyUsed,
    dailyLimit,
    isUnlimited: billing.isUnlimited,
    planTier: billing.planTier,
    aiWallDeepEnabled: billing.aiWallDeepEnabled,
    rootsSyncPriority: billing.rootsSyncPriority,
    survivalSimulationEnabled: billing.survivalSimulationEnabled,
  };
}

export async function getUserProfile(user: User, userId?: string): Promise<UserProfileSettings> {
  const scopedUserId = userId ?? user.id;
  const row = await requireProfileRow(scopedUserId);

  return {
    id: row.id,
    email: row.email || user.email || `${scopedUserId}@users.emoswitch.local`,
    displayName: row.display_name ?? getUserDisplayName(user) ?? "Googleユーザー",
    avatarUrl:
      typeof user.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url !== ""
        ? user.user_metadata.avatar_url
        : null,
    planName:
      row.subscription_tier === "pro"
        ? "プロ"
        : row.subscription_tier === "creator"
          ? "クリエイター"
          : row.subscription_tier === "basic"
            ? "ベーシック"
            : "無料",
    defaultEmotion: row.default_emotion ?? "empathy",
    writingStyle: row.writing_style ?? "casual",
    sentenceStyle: row.sentence_style ?? "friendly",
  };
}

export async function updateUserProfile(
  user: User,
  payload: Pick<UserProfileSettings, "displayName" | "defaultEmotion" | "writingStyle" | "sentenceStyle">,
  userId?: string,
): Promise<UserProfileSettings> {
  const scopedUserId = await resolveScopedUserId(userId ?? user.id);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      display_name: payload.displayName.trim(),
      default_emotion: payload.defaultEmotion,
      writing_style: payload.writingStyle,
      sentence_style: payload.sentenceStyle,
    })
    .eq("id", scopedUserId)
    .select("id");

  if (error) {
    throw error;
  }

  return getUserProfile(user, scopedUserId);
}

export async function resetAllGenerations(userId?: string): Promise<{ deletedCount: number }> {
  const scopedUserId = await resolveScopedUserId(userId);
  const deletedAt = new Date().toISOString();
  const [{ data: generationRows, error: generationError }, { data: seriesRows, error: seriesError }, { error: seriesItemError }] =
    await Promise.all([
      supabaseAdmin
        .from("generations")
        .update({ deleted_at: deletedAt })
        .eq("user_id", scopedUserId)
        .is("deleted_at", null)
        .select("id"),
      supabaseAdmin
        .from("generation_series")
        .update({ deleted_at: deletedAt })
        .eq("user_id", scopedUserId)
        .is("deleted_at", null)
        .select("id"),
      supabaseAdmin
        .from("generation_series_items")
        .update({ deleted_at: deletedAt })
        .eq("user_id", scopedUserId)
        .is("deleted_at", null),
    ]);

  if (generationError) throw generationError;
  if (seriesError) throw seriesError;
  if (seriesItemError) throw seriesItemError;

  return { deletedCount: generationRows.length + seriesRows.length };
}

export async function migrateLocalData(
  payload: LocalMigrationPayload,
  userId?: string,
): Promise<{ importedCount: number }> {
  const scopedUserId = await resolveScopedUserId(userId);
  const generationIds = Array.from(
    new Set(payload.generations.map((row) => row.id).filter((id): id is string => Boolean(id))),
  );

  const existingIds = new Set<string>();

  if (generationIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("generations")
      .select("id")
      .eq("user_id", scopedUserId)
      .in("id", generationIds);

    if (error) {
      throw error;
    }

    for (const row of data) {
      existingIds.add(row.id as string);
    }
  }

  const rowsToInsert = payload.generations
    .filter((row) => !existingIds.has(row.id))
    .map((row) => ({
      id: row.id,
      user_id: scopedUserId,
      generation_mode: row.generationMode ?? "single",
      draft: row.draft,
      emotion: row.emotion,
      intensity: row.intensity,
      speed_mode: row.speedMode ?? null,
      variants: row.variants,
      hashtags: row.hashtags,
      selected_index: row.selectedIndex,
      likes: row.likes,
      memo: row.memo ?? null,
      advice_hint: row.adviceHint ?? null,
      quick_feedback: row.quickFeedback ?? null,
      memory_tags: row.memoryTags ?? [],
      created_at: row.createdAt,
      updated_at: row.createdAt,
    }));

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("generations").insert(rowsToInsert);

    if (insertError) {
      throw insertError;
    }

    const { error: ledgerError } = await supabaseAdmin.from("credit_ledger").insert(
      rowsToInsert.map((row) => ({
        user_id: scopedUserId,
        delta: -1,
        reason: "migration_import",
        note: "localStorage から移行",
        metadata: { generation_id: row.id },
        created_at: row.created_at,
      })),
    );

    if (ledgerError) {
      throw ledgerError;
    }
  }

  if (
    payload.ghostSettings.profileUrl.trim() !== "" ||
    payload.ghostSettings.ngWords.length > 0 ||
    payload.ghostSettings.stylePrompt.trim() !== ""
  ) {
    await saveGhostSettings(
      {
        profileUrl: payload.ghostSettings.profileUrl.trim(),
        ngWords: payload.ghostSettings.ngWords.map((word) => word.trim()).filter(Boolean),
        stylePrompt: payload.ghostSettings.stylePrompt.trim(),
        manualPosts: payload.ghostSettings.manualPosts ?? [],
        personaKeywords: payload.ghostSettings.personaKeywords ?? [],
        personaSummary: payload.ghostSettings.personaSummary?.trim() ?? "",
        personaEvidence: payload.ghostSettings.personaEvidence ?? [],
        personaStatus: payload.ghostSettings.personaStatus ?? "empty",
        personaLastAnalyzedHotCount: payload.ghostSettings.personaLastAnalyzedHotCount ?? 0,
      },
      scopedUserId,
    );
  }

  return { importedCount: rowsToInsert.length };
}
