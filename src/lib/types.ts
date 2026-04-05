import type { EmotionTone } from "@/lib/emotions";
import type { SeriesSlotKey } from "@/lib/series";

export type QuickFeedback = "hot" | "cold" | null;
export type GenerationMode = "single" | "series";
export type PersonaStatus = "empty" | "draft" | "approved";

export type GenerationRecord = {
  id: string;
  createdAt: string;
  generationMode: "single";
  draft: string;
  emotion: EmotionTone;
  intensity: number;
  /** 生成時のモデル（旧データは未保存のため省略可） */
  speedMode?: "flash" | "pro";
  variants: string[];
  hashtags: string[];
  /** 採用した案（0-2）。未選択は null */
  selectedIndex: number | null;
  /** 投稿後のいいね等 */
  likes: number | null;
  /** 投稿時間・ハッシュタグ変更など、いいね以外の要因メモ */
  memo?: string | null;
  adviceHint?: string | null;
  quickFeedback?: QuickFeedback;
  memoryTags?: string[];
};

export type GenerationSeriesItemRecord = {
  id: string;
  seriesId: string;
  createdAt: string;
  slotKey: SeriesSlotKey;
  slotLabel: string;
  body: string;
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
  title: string;
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
  stylePrompt: string;
  manualPosts: string[];
  personaKeywords: string[];
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
