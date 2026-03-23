import type { EmotionTone } from "@/lib/emotions";

export type GenerationRecord = {
  id: string;
  createdAt: string;
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
};

export type GhostSettings = {
  profileUrl: string;
  ngWords: string[];
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
