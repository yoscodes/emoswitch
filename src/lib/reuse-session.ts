import { z } from "zod";

import type { EmotionTone } from "@/lib/emotions";

export const REUSE_SESSION_KEY = "emoswitch_reuse_v1";

const reusePayloadSchema = z.object({
  draft: z.string(),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  intensity: z.number().min(0).max(100),
  speedMode: z.enum(["flash", "pro"]),
});

export type ReusePayload = z.infer<typeof reusePayloadSchema>;

export function writeReuseSession(payload: ReusePayload): void {
  sessionStorage.setItem(REUSE_SESSION_KEY, JSON.stringify(payload));
}

export function readAndClearReuseSession(): ReusePayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(REUSE_SESSION_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(REUSE_SESSION_KEY);
  try {
    const parsed = JSON.parse(raw) as unknown;
    const r = reusePayloadSchema.safeParse(parsed);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

const EMOTION_SET = new Set<string>([
  "empathy",
  "toxic",
  "mood",
  "useful",
  "minimal",
]);

export function parseEmotionFromQuery(value: string | null): EmotionTone | null {
  if (!value || !EMOTION_SET.has(value)) return null;
  return value as EmotionTone;
}
