import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export const runtime = "edge";

const bodySchema = z.object({
  draft: z.string().min(1),
  refinementAnswer: z.string().optional().default(""),
  generationMode: z.enum(["single", "series"]).default("single"),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  intensity: z.number().min(0).max(100).default(50),
  personaKeywords: z.array(z.string()).optional().default([]),
  personaSummary: z.string().optional().default(""),
  strategyLabel: z.string().optional().default(""),
});

const canvasSchema = z.object({
  summary: z.string().min(18).max(90),
  previewTitle: z.string().min(10).max(48),
  question: z.string().min(14).max(70),
  dnaAlignment: z.number().int().min(0).max(100),
  dnaReason: z.string().min(14).max(120),
  warning: z.string().max(120).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const {
      draft,
      refinementAnswer,
      generationMode,
      emotion,
      intensity,
      personaKeywords,
      personaSummary,
      strategyLabel,
    } = bodySchema.parse(await request.json());

    if (draft.trim().length < 12) {
      return Response.json({
        summary: "",
        previewTitle: "",
        question: "",
        dnaAlignment: 50,
        dnaReason: "",
        warning: null,
      });
    }

    const personaBlock =
      personaKeywords.length > 0 || personaSummary.trim() !== ""
        ? [
            personaKeywords.length > 0 ? `ペルソナDNA: ${personaKeywords.join("、")}` : null,
            personaSummary.trim() !== "" ? `ペルソナ要約: ${personaSummary.trim()}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "ペルソナ情報なし";

    const { object } = await generateObject({
      model: google("gemini-1.5-flash-latest"),
      schema: canvasSchema,
      temperature: 0.35,
      system: [
        "あなたは起業家の仮説を磨く厳しく優秀な壁打ち相手です。",
        "入力中の事業アイデアを見て、今ぶつけるべき仮説の一行要約、プレビュータイトル、DNA一致率、理由、そして生成前に考えるべき鋭い質問を1つ返してください。",
        "summary は『今回ぶつける仮説はこれですね』に続く1行として自然な日本語にする。",
        "previewTitle は発信案のタイトルプレビュー。SNS見出しのように短く、でも煽りすぎない。",
        "question は曖昧さを削るための逆質問を1つだけ。抽象的ではなく、答えると仮説が前進する問いにする。",
        "dnaAlignment は、ペルソナDNAとの一致率を0〜100で返す。DNA情報が少ない場合は50前後に寄せる。",
        "dnaReason は一致率の理由を短く説明する。",
        "warning は、DNAと大きくズレている場合だけ入れる。ズレが小さいときは null。",
        "日本語で返すこと。",
      ].join("\n"),
      prompt: [
        `事業の種:\n${draft.trim()}`,
        refinementAnswer.trim() !== "" ? `AIの問いへの追加回答:\n${refinementAnswer.trim()}` : null,
        `戦い方: ${generationMode === "series" ? "30日物語" : "単発検証"}`,
        `市場への見せ方: ${emotion}`,
        `強度: ${intensity}`,
        strategyLabel.trim() !== "" ? `戦略タイル: ${strategyLabel.trim()}` : null,
        personaBlock,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    return Response.json({
      summary: object.summary,
      previewTitle: object.previewTitle,
      question: object.question,
      dnaAlignment: object.dnaAlignment,
      dnaReason: object.dnaReason,
      warning: object.warning ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "仮説キャンバス分析に失敗しました";
    return Response.json({ error: message }, { status: 400 });
  }
}
