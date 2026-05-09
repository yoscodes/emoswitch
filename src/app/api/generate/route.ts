import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { z } from "zod";

import { EMOTION_LABELS, EMOTION_PROMPTS, type EmotionTone } from "@/lib/emotions";
import { getDailyGenerationUsage, resolveBillingState, resolveRequestActor } from "@/lib/supabase/services";

export const runtime = "edge";
const FREE_DAILY_LIMIT = 3;
const UNLIMITED_DAILY_SOFT_LIMIT = 100;

const bodySchema = z.object({
  draft: z.string().min(1, "ネタが空です"),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  speedMode: z.enum(["flash", "pro"]).default("flash"),
});

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const billing = await resolveBillingState(actor.userId);
    const dailyUsage = await getDailyGenerationUsage(actor.userId);
    if (!billing.isUnlimited && dailyUsage >= FREE_DAILY_LIMIT) {
      return Response.json(
        { error: `無料プランの本日の生成上限（${FREE_DAILY_LIMIT}回）に達しました。プランをアップグレードしてください。` },
        { status: 402 },
      );
    }
    if (billing.isUnlimited && dailyUsage >= UNLIMITED_DAILY_SOFT_LIMIT) {
      return Response.json(
        { error: `本日の利用上限（${UNLIMITED_DAILY_SOFT_LIMIT}回）に達しました。明日以降に再度お試しください。` },
        { status: 429 },
      );
    }
    const json = await request.json();
    const { draft, emotion, speedMode } = bodySchema.parse(json);
    if (speedMode === "pro" && !billing.aiWallDeepEnabled) {
      return Response.json(
        { error: "ディープ解析（Pro）は有料プランで利用できます。" },
        { status: 402 },
      );
    }
    const modelName =
      speedMode === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash";

    const system = [
      "あなたはSNS投稿に強い日本語コピーライターです。",
      "ユーザーにはプロンプトを見せず、最終文だけを出力します。",
      "出力ルール:",
      "- 1文だけを返す",
      "- 28〜80文字",
      "- 日本語",
      "- 絵文字は最大2つ",
      "- 不要な前置き・解説・引用符は禁止",
      `- 感情スイッチ: ${EMOTION_LABELS[emotion as EmotionTone]} / ${EMOTION_PROMPTS[emotion as EmotionTone]}`,
    ].join("\n");

    const result = streamText({
      model: google(modelName),
      system,
      prompt: `素材:\n${draft}`,
      temperature: 0.8,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成APIで不明なエラーが発生しました";
    return Response.json({ error: message }, { status: 400 });
  }
}
