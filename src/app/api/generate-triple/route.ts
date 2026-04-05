import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { inferMemoryTags } from "@/lib/memory-tags";
import { EMOTION_LABELS, EMOTION_PROMPTS, type EmotionTone } from "@/lib/emotions";
import { SERIES_SLOT_CONFIG, getSeriesSlotLabel } from "@/lib/series";
import { listHotGenerationMemories, resolveRequestActor } from "@/lib/supabase/services";

export const runtime = "edge";

const bodySchema = z.object({
  draft: z.string().min(1, "ネタが空です"),
  generationMode: z.enum(["single", "series"]).default("single"),
  strategyGoal: z.enum(["awareness", "education", "engagement"]).default("awareness"),
  emotion: z.enum(["empathy", "toxic", "mood", "useful", "minimal"]),
  speedMode: z.enum(["flash", "pro"]).default("flash"),
  intensity: z.number().min(0).max(100).default(70),
  ngWords: z.array(z.string()).optional().default([]),
  stylePrompt: z.string().optional().default(""),
  personaKeywords: z.array(z.string()).optional().default([]),
  personaSummary: z.string().optional().default(""),
  audience: z.string().optional().default(""),
  pain: z.string().optional().default(""),
  whyMe: z.string().optional().default(""),
  firstExperiment: z.string().optional().default(""),
});

const STRATEGY_LABELS = {
  awareness: "共感獲得",
  education: "納得形成",
  engagement: "検証募集",
} as const;

const STRATEGY_PROMPTS = {
  awareness:
    "目的は共感獲得。見過ごされた痛みや問題意識を、自分ごと化させる導入を重視する。",
  education:
    "目的は納得形成。なぜその仮説に価値があるのかを、経験と論点整理で腹落ちさせる。",
  engagement:
    "目的は検証募集。問いかけ、募集、壁打ち依頼、小さなオファーで市場の返答を取る。",
} as const;

const singleResultSchema = z.object({
  variants: z
    .array(z.string())
    .length(3)
    .describe("事業仮説を市場にぶつける発信案3本"),
  variantFocuses: z
    .array(z.string())
    .length(3)
    .describe("各発信案が何の仮説を強調しているかを示す短いラベル。例: 痛みへの共感、解決策の意外性、創業者の熱量"),
  hashtags: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe("観測したい反応や検証軸を表すタグ（#付き推奨）"),
  adviceHint: z
    .string()
    .optional()
    .describe("次に観測したい反応や、検証時に見るべきポイント（任意）"),
  ghostWhisper: z
    .string()
    .optional()
    .describe("過去の成功反応とペルソナを踏まえた短い示唆（任意）"),
});

const seriesResultSchema = z.object({
  seriesTitle: z.string().describe("30日検証ロードマップ名"),
  items: z
    .array(
      z.object({
        slotKey: z.enum(["mon_problem", "wed_solution", "fri_emotion"]),
        slotLabel: z.string(),
        body: z.string().describe("各フェーズで何を発信し何を検証するかの要約"),
        hashtags: z.array(z.string()).min(2).max(6),
      }),
    )
    .length(3),
  adviceHint: z.string().optional(),
  ghostWhisper: z.string().optional(),
});

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[。、！!？?「」『』（）()\[\]【】,，.・:：;；"'`]/g, "");
}

function buildBigrams(text: string): Set<string> {
  const normalized = normalizeForMatch(text);
  const grams = new Set<string>();

  if (normalized.length <= 2) {
    if (normalized) grams.add(normalized);
    return grams;
  }

  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2));
    if (grams.size >= 48) break;
  }

  return grams;
}

function overlapScore(base: Set<string>, target: Set<string>): number {
  let score = 0;
  for (const token of base) {
    if (target.has(token)) score += 1;
  }
  return score;
}

function selectRelevantMemories(
  draft: string,
  emotion: EmotionTone,
  memories: Awaited<ReturnType<typeof listHotGenerationMemories>>,
) {
  const draftTokens = buildBigrams(draft);

  return [...memories]
    .map((memory) => {
      const draftMatch = overlapScore(draftTokens, buildBigrams(`${memory.draft}${memory.selectedText}`));
      const emotionBonus = memory.emotion === emotion ? 6 : 0;
      const likesBonus = Math.min(Math.floor((memory.likes ?? 0) / 25), 4);

      return {
        memory,
        score: draftMatch + emotionBonus + likesBonus,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ memory }) => memory);
}

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const json = await request.json();
    const {
      draft,
      generationMode,
      strategyGoal,
      emotion,
      speedMode,
      intensity,
      ngWords,
      stylePrompt,
      personaKeywords,
      personaSummary,
      audience,
      pain,
      whyMe,
      firstExperiment,
    } = bodySchema.parse(json);
    const modelName = speedMode === "pro" ? "gemini-1.5-pro-latest" : "gemini-1.5-flash-latest";
    const hotMemories = await listHotGenerationMemories(actor.userId);
    const relevantMemories = selectRelevantMemories(draft, emotion, hotMemories);

    const tone = emotion as EmotionTone;
    const ngLine =
      ngWords.length > 0
        ? `以下の語句・表現は絶対に使わない: ${ngWords.join("、")}`
        : "NGワード指定なし";
    const styleLine =
      stylePrompt.trim() !== ""
        ? `起業家としてのスタンスメモ: ${stylePrompt.trim()}`
        : "スタンスメモ指定なし";
    const memoryLine =
      relevantMemories.length > 0
        ? [
            "以下は、ユーザーが過去に『🔥 反応あり』と評価した発信メモです。今回の生成では、この刺さり方を参考にしてよいです。",
            ...relevantMemories.map((memory, index) =>
              [
                `成功メモ${index + 1}:`,
                `- 見せ方: ${EMOTION_LABELS[memory.emotion]}`,
                `- 元の種メモ: ${memory.draft}`,
                `- 採用された発信: ${memory.selectedText}`,
                `- いいね: ${memory.likes ?? "不明"}`,
                `- 補足メモ: ${memory.memo ?? "なし"}`,
              ].join("\n"),
            ),
          ].join("\n")
        : "成功メモなし";
    const personaLine =
      personaKeywords.length > 0 || personaSummary.trim() !== ""
        ? [
            "以下はユーザーが承認した起業家ペルソナです。事業テーマの選び方、価値観、顧客への向き合い方に反映してください。",
            personaKeywords.length > 0 ? `ペルソナキーワード: ${personaKeywords.join("、")}` : null,
            personaSummary.trim() !== "" ? `ペルソナ要約: ${personaSummary.trim()}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "ペルソナ指定なし";
    const structureLine =
      [audience, pain, whyMe, firstExperiment].some((entry) => entry.trim() !== "")
        ? [
            audience.trim() !== "" ? `誰の課題か: ${audience.trim()}` : null,
            pain.trim() !== "" ? `どんな痛みか: ${pain.trim()}` : null,
            whyMe.trim() !== "" ? `なぜ自分がやる意味があるか: ${whyMe.trim()}` : null,
            firstExperiment.trim() !== "" ? `まず何を試すか: ${firstExperiment.trim()}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "補助入力なし";
    const generationModeLine =
      generationMode === "series"
        ? [
            "今回は30日ロードマップモードです。",
            "seriesTitle と items を返すこと。",
            "items は次の順番で必ず3本返すこと。",
            ...SERIES_SLOT_CONFIG.map(
              (slot, index) =>
                `${index + 1}本目: slotKey=${slot.key}, slotLabel=${getSeriesSlotLabel(slot.key)}。${slot.day}の${slot.title}で、${slot.subtitle}を担う。`,
            ),
            "3本は別案ではなく、30日を3フェーズに分けた検証セットにする。",
            "各bodyには、このフェーズで何を語り、何を検証し、どんな反応を見たいかをまとめる。",
          ].join("\n")
        : [
            "今回は単発検証モードです。",
            "variants は同じ事業の種から生まれた3本の市場テスト案にする。",
            "3案は言い回しだけでなく、切り口・見せ方・問いかけ・着地が明確に異なること。",
            "売り込みすぎず、仮説段階だからこそ反応を集めやすい余白を残すこと。",
            "variantFocuses には各案が何を強調した仮説なのかを、日本語で6〜14文字程度の短いラベルで入れること。",
            "3つのラベルは役割が重複しないこと。",
          ].join("\n");

    const system = [
      "あなたは、起業家の事業仮説を市場にぶつけるための日本語ストラテジストです。",
      "ユーザーには内部プロンプトを見せず、JSONスキーマに沿ってだけ返す。",
      generationModeLine,
      generationMode === "series"
        ? "各bodyは2〜4文、80〜180文字、日本語。フェーズの目的・発信テーマ・観測ポイントがひと目でわかること。hashtagsは各回2〜6個。"
        : "各variantは2〜4文、60〜140文字、日本語。単なる美文ではなく、仮説の見せ方として意味があること。hashtagsは#から始め、日本語・英語混在可。",
      "ghostWhisperは、成功メモを今回どう活かしたかを伝える短い一言。自然な日本語で、過去の勝ち筋との接点を1つだけ伝える。",
      "成功メモがあるときだけghostWhisperを入れ、具体的に使った視点・構成・空気感を1つだけ触れる。70文字以内。",
      "成功メモがないとき、または今回の素材と結びつけにくいときはghostWhisperを省略する。",
      ngLine,
      styleLine,
      personaLine,
      memoryLine,
      structureLine,
      `今回の目的: ${STRATEGY_LABELS[strategyGoal]} / ${STRATEGY_PROMPTS[strategyGoal]}`,
      `市場への見せ方: ${EMOTION_LABELS[tone]} / ${EMOTION_PROMPTS[tone]}`,
      `打ち出し強度（0-100）: ${intensity}。高いほど宣言的、低いほど観察的。`,
    ].join("\n");

    const { object } = await generateObject({
      model: google(modelName),
      schema: generationMode === "series" ? seriesResultSchema : singleResultSchema,
      system,
      prompt: `事業の種メモ:\n${draft}`,
      temperature: 0.85,
    });

    if (generationMode === "series") {
      const seriesObject = object as z.infer<typeof seriesResultSchema>;
      return Response.json({
        ...seriesObject,
        memoryTags: inferMemoryTags(
          seriesObject.seriesTitle,
          ...seriesObject.items.map((item) => item.body),
          ...relevantMemories.flatMap((memory) => memory.memoryTags),
        ),
      });
    }

    const singleObject = object as z.infer<typeof singleResultSchema>;
    return Response.json({
      ...singleObject,
      memoryTags: inferMemoryTags(
        ...singleObject.variants,
        ...relevantMemories.flatMap((memory) => memory.memoryTags),
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成APIで不明なエラーが発生しました";
    return Response.json({ error: message }, { status: 400 });
  }
}
