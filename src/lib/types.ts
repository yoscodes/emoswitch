import type { EmotionTone } from "@/lib/emotions";
import type { SeriesSlotKey } from "@/lib/series";

export type QuickFeedback = "hot" | "cold" | null;
export type GenerationMode = "single" | "series";
export type PersonaStatus = "empty" | "draft" | "approved";

export type GenerationRecord = {
  id: string;
  createdAt: string;
  generationMode: "single";
  /** 旧SNS素材カラムを転用。現在は「事業の種 + 補助入力」の統合メモ */
  draft: string;
  /** 現在は「市場への見せ方」の軸として利用 */
  emotion: EmotionTone;
  /** 現在は「観察/対話/宣言」の打ち出し強度 */
  intensity: number;
  /** 生成時のモデル（旧データは未保存のため省略可） */
  speedMode?: "flash" | "pro";
  /** 市場にぶつける発信案3本 */
  variants: string[];
  /** 旧hashtagsカラムを転用。現在は検証タグとして表示 */
  hashtags: string[];
  /** 採用した仮説案（0-2）。未選択は null */
  selectedIndex: number | null;
  /** 市場反応の簡易メトリクス。現状は likes を暫定利用 */
  likes: number | null;
  /** 検証条件や結果メモ */
  memo?: string | null;
  /** 次に観測したいポイント */
  adviceHint?: string | null;
  /** hot/cold は「反応あり / 刺さらず」を意味する */
  quickFeedback?: QuickFeedback;
  memoryTags?: string[];
};

export type GenerationSeriesItemRecord = {
  id: string;
  seriesId: string;
  createdAt: string;
  /** 旧週次スロットを転用。現在は30日ロードマップのフェーズ */
  slotKey: SeriesSlotKey;
  slotLabel: string;
  /** 各フェーズで何を発信し何を検証するか */
  body: string;
  /** 各フェーズの観測タグ */
  hashtags: string[];
  quickFeedback?: QuickFeedback;
  likes: number | null;
  memo?: string | null;
  memoryTags?: string[];
};

export type GenerationSeriesRecord = {
  id: string;
  createdAt: string;
  generationMode: "series";
  /** 30日検証ロードマップ名 */
  title: string;
  /** 旧source_draftカラムを転用。現在は事業の種メモ */
  draft: string;
  emotion: EmotionTone;
  intensity: number;
  speedMode?: "flash" | "pro";
  adviceHint?: string | null;
  ghostWhisper?: string | null;
  quickFeedback?: QuickFeedback;
  memoryTags?: string[];
  items: GenerationSeriesItemRecord[];
};

export type ArchiveEntry = GenerationRecord | GenerationSeriesRecord;

export type ArchiveInsightEmotion = {
  emotion: EmotionTone;
  label: string;
  usageCount: number;
  hotCount: number;
  hotRate: number;
};

export type ArchiveInsights = {
  totalSingles: number;
  totalSeries: number;
  totalHot: number;
  totalCold: number;
  emotionBreakdown: ArchiveInsightEmotion[];
  /** どの見せ方・強度が刺さったかの要約 */
  bestPatternSummary: string;
  recommendedEmotion: EmotionTone | null;
  recommendedIntensity: number | null;
  seriesCompletionRate: number;
  seriesHotRate: number;
};

export type ArchiveOverview = {
  entries: ArchiveEntry[];
  insights: ArchiveInsights;
};

export type GhostSettings = {
  profileUrl: string;
  ngWords: string[];
  /** 旧文体メモを転用。現在は起業家スタンスメモ */
  stylePrompt: string;
  manualPosts: string[];
  /** 問題意識 / 強み / 価値観 / 顧客観 / 発信姿勢 の5軸を想定 */
  personaKeywords: string[];
  /** 起業家としての思想・強み・市場への向き合い方の要約 */
  personaSummary: string;
  personaEvidence: string[];
  personaStatus: PersonaStatus;
  personaLastAnalyzedHotCount: number;
};

export type CreditSummary = {
  remaining: number;
  used: number;
  granted: number;
};

export type UserProfileSettings = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  planName: string;
  defaultEmotion: EmotionTone;
  writingStyle: "polite" | "casual" | "passionate";
  sentenceStyle: "desumasu" | "friendly";
};
