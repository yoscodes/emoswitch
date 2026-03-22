import type { EmotionTone } from "@/lib/emotions";

export type GenerationRecord = {
  id: string;
  createdAt: string;
  draft: string;
  emotion: EmotionTone;
  intensity: number;
  variants: string[];
  hashtags: string[];
  /** 採用した案（0-2）。未選択は null */
  selectedIndex: number | null;
  /** 投稿後のいいね等 */
  likes: number | null;
  adviceHint?: string | null;
};

export type GhostSettings = {
  profileUrl: string;
  ngWords: string[];
};
