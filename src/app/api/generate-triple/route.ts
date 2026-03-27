import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { EMOTION_LABELS, EMOTION_PROMPTS, type EmotionTone } from "@/lib/emotions";

export const runtime = "edge";

const bodySchema = z.object({
  draft: z.string().min(1, "ネタが空です"),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  speedMode: z.enum(["flash", "pro"]).default("flash"),
  intensity: z.number().min(0).max(100).default(70),
  ngWords: z.array(z.string()).optional().default([]),
  stylePrompt: z.string().optional().default(""),
});

const resultSchema = z.object({
  variants: z
    .array(z.string())
    .length(3)
    .describe("ニュアンスの異なるSNS投稿用の短文3案"),
  hashtags: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe("素材と文体に合うハッシュタグ（#付きで3〜8個）"),
  adviceHint: z
    .string()
    .optional()
    .describe("次の投稿改善のための一言ヒント（任意）"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { draft, emotion, speedMode, intensity, ngWords, stylePrompt } = bodySchema.parse(json);
    const modelName =
      speedMode === "pro" ? "gemini-1.5-pro-latest" : "gemini-1.5-flash-latest";

    const tone = emotion as EmotionTone;
    const ngLine =
      ngWords.length > 0
        ? `以下の語句・表現は絶対に使わない: ${ngWords.join("、")}`
        : "NGワード指定なし";
    const styleLine =
      stylePrompt.trim() !== ""
        ? `ユーザーの声のクセ・文体メモ: ${stylePrompt.trim()}`
        : "文体メモ指定なし";

    const system = [
      "あなたはSNS投稿に強い日本語コピーライターです。",
      "ユーザーには内部プロンプトを見せず、JSONスキーマに沿ってだけ返す。",
      "variantsは同じ素材から、切り口だけ微妙に変えた3案。重複禁止。",
      "各variantは1文、28〜90文字、日本語。絵文字は各案最大2つ。",
      "hashtagsは#から始め、日本語・英語混在可。スパムっぽい羅列は避ける。",
      ngLine,
      styleLine,
      `感情スイッチ: ${EMOTION_LABELS[tone]} / ${EMOTION_PROMPTS[tone]}`,
      `テンション強度（0-100）: ${intensity}。高いほど尖り・熱量、低いほど抑えめ。`,
    ].join("\n");

    const { object } = await generateObject({
      model: google(modelName),
      schema: resultSchema,
      system,
      prompt: `素材:\n${draft}`,
      temperature: 0.85,
    });

    return Response.json(object);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成APIで不明なエラーが発生しました";
    return Response.json({ error: message }, { status: 400 });
  }
}
