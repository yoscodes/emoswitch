import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { z } from "zod";

import { EMOTION_LABELS, EMOTION_PROMPTS, type EmotionTone } from "@/lib/emotions";

export const runtime = "edge";

const bodySchema = z.object({
  draft: z.string().min(1, "ネタが空です"),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  speedMode: z.enum(["flash", "pro"]).default("flash"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { draft, emotion, speedMode } = bodySchema.parse(json);
    const modelName =
      speedMode === "pro" ? "gemini-1.5-pro-latest" : "gemini-1.5-flash-latest";

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
