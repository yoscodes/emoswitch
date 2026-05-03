import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { resolveRequestActor } from "@/lib/supabase/services";

export const runtime = "edge";

const bodySchema = z.object({
  /** UI のボタンは 100 文字だが、API では少し緩めに受ける */
  draft: z.string().min(80, "下書きは80文字以上でお試しください"),
});

const resultSchema = z.object({
  audience: z
    .string()
    .max(520)
    .describe(
      "①誰に？（行動ベースで絞る）に相当。職業・属性だけでなく、いつ・どの程度動けるかなど行動粒度が取れるなら含める。日本語1〜4文。",
    ),
  pain: z
    .string()
    .max(520)
    .describe(
      "②どんな悩み？（すでに解決行動してるかまで）に相当。困りごとに加え、下書きに試した行動があれば触れる。無ければ悩みと状況だけ簡潔に。日本語1〜4文。",
    ),
});

export async function POST(request: Request) {
  try {
    await resolveRequestActor(request);
    const { draft } = bodySchema.parse(await request.json());

    const { object } = await generateObject({
      model: google("gemini-1.5-flash-latest"),
      schema: resultSchema,
      temperature: 0.35,
      system: [
        "あなたは起業メモの編集者です。思考の蒸留として、ユーザーが書いた下書き（Scrap）だけを根拠に①②へ言い換え・圧縮して書き分ける（新情報の捏造は禁止）。",
        "推測で固有名詞・数値・実績・第三者の発言を捏造しない。下書きに無い具体は足さない。不明点は短い仮置きか省略。",
        "ハルシネーションを避ける: 断定調で足りない事実を埋めない。曖昧なら「〜の可能性」ではなく、下書きの語彙に忠実に短く。",
        "箇条書きやMarkdownは使わず、各フィールドは自然な文章のみ。",
      ].join("\n"),
      prompt: `【下書き（Scrap）】\n${draft.trim()}`,
    });

    return Response.json({
      audience: object.audience.trim(),
      pain: object.pain.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "整理に失敗しました";
    return Response.json({ error: message }, { status: 400 });
  }
}
