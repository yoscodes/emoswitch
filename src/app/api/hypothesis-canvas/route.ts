import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import {
  formatAiGatewayErrorForClient,
  getAiGatewayErrorHttpStatus,
  withGeminiQuotaAwareRetry,
} from "@/lib/ai-quota-retry";
import { buildIdentityPromptBlock, buildShredderPromptBlock } from "@/lib/identity-prompt";
import { getIdentityProfile, requireAuthenticatedActorFromRequest, resolveBillingState } from "@/lib/supabase/services";

export const runtime = "edge";

const bodySchema = z.object({
  draft: z.string().min(1),
  refinementAnswer: z.string().optional().default(""),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  intensity: z.number().min(0).max(100).default(50),
  personaKeywords: z.array(z.string()).optional().default([]),
  personaSummary: z.string().optional().default(""),
  strategyLabel: z.string().optional().default(""),
  usagePurpose: z
    .enum(["discovery", "blueprint", "refinement", "communication"])
    .optional()
    .default("discovery"),
});

const USAGE_PURPOSE_HINTS = {
  discovery: "ユーザーは発想の種を増やしたい。Identity一致率は厳しすぎず、探索余地を残す評価に寄せる。",
  blueprint: "ユーザーはコンセプトの芯を固めたい。Identityとの整合とストーリーの一貫性を重視する。",
  refinement: "ユーザーは仮説を圧縮したい。Identityとのズレや前提の穴を厳しめに検出する。",
  communication: "ユーザーは一言の打ち力を求めている。短いコピー前提でIdentityのトーンとの一致を見る。",
} as const;

const USAGE_PURPOSE_LABELS = {
  discovery: "探索（Discovery）",
  blueprint: "構築（Blueprint）",
  refinement: "研磨（Refinement）",
  communication: "伝達（Communication）",
} as const;

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
    const actor = await requireAuthenticatedActorFromRequest(request);
    const billing = await resolveBillingState(actor.userId);
    const {
      draft,
      refinementAnswer,
      emotion,
      intensity,
      personaKeywords,
      personaSummary,
      strategyLabel,
      usagePurpose,
    } = bodySchema.parse(await request.json());
    const identity = await getIdentityProfile(actor.userId);

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
            personaKeywords.length > 0 ? `投稿ペルソナ（キーワード）: ${personaKeywords.join("、")}` : null,
            personaSummary.trim() !== "" ? `ペルソナ要約: ${personaSummary.trim()}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "ペルソナ情報なし";
    const identityBlock = buildIdentityPromptBlock(identity);
    const shredderBlock = buildShredderPromptBlock(draft, identity.myTaboo);
    const survivalSimulationPrompt = billing.survivalSimulationEnabled
      ? "Proユーザーなので、生存シミュレーション観点（資金消耗、心理コスト、実行持続性）を質問設計に必ず含める。"
      : "生存シミュレーション観点は使わない。";

    const { object } = await withGeminiQuotaAwareRetry(() =>
      generateObject({
        model: google("gemini-2.5-flash"),
        schema: canvasSchema,
        temperature: 0.35,
        maxRetries: 0,
        system: [
          "あなたは起業家の仮説を磨く厳しく優秀な壁打ち相手です。",
          "入力中の事業アイデアを見て、今ぶつけるべき仮説の一行要約、プレビュータイトル、Identity一致率（dnaAlignment）、理由、そして生成前に考えるべき鋭い質問を1つ返してください。",
          "summary は『今回ぶつける仮説はこれですね』に続く1行として自然な日本語にする。",
          "previewTitle は発信案のタイトルプレビュー。SNS見出しのように短く、でも煽りすぎない。",
          "question は曖昧さを削るための逆質問を1つだけ。抽象的ではなく、答えると仮説が前進する問いにする。",
          "タブー候補に触れる語を提案する場合は [SHREDDED:<語句>] を併記し、直後により安全な代替表現を提案する。",
          "dnaAlignment は、投稿に使うIdentity（ペルソナ）との一致率を0〜100で返す。Identity情報が少ない場合は50前後に寄せる。",
          "dnaReason は一致率の理由を短く説明する。",
          "warning は、Identityと大きくズレている場合だけ入れる。ズレが小さいときは null。",
          identityBlock,
          shredderBlock,
          `ROOTS還流優先度: ${billing.rootsSyncPriority}`,
          survivalSimulationPrompt,
          "日本語で返すこと。",
        ].join("\n"),
          prompt: [
          `事業の種:\n${draft.trim()}`,
          refinementAnswer.trim() !== "" ? `AIの問いへの追加回答:\n${refinementAnswer.trim()}` : null,
          "戦い方: アクションプラン（3ステップの行動計画）",
          `市場への見せ方: ${emotion}`,
          `強度: ${intensity}`,
          strategyLabel.trim() !== "" ? `戦略タイル: ${strategyLabel.trim()}` : null,
          `活用フェーズ: ${USAGE_PURPOSE_LABELS[usagePurpose]}`,
          personaBlock,
        ]
          .filter(Boolean)
          .join("\n\n"),
      }),
    );

    return Response.json({
      summary: object.summary,
      previewTitle: object.previewTitle,
      question: object.question,
      dnaAlignment: object.dnaAlignment,
      dnaReason: object.dnaReason,
      warning: object.warning ?? null,
    });
  } catch (error) {
    const message = formatAiGatewayErrorForClient(error);
    const status = getAiGatewayErrorHttpStatus(error);
    if (message.includes("ログイン")) {
      return Response.json({ error: message }, { status: 401 });
    }
    return Response.json({ error: message }, { status: status === 429 ? 429 : 400 });
  }
}
