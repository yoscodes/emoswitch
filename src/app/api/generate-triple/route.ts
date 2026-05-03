import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { inferMemoryTags } from "@/lib/memory-tags";
import { EMOTION_LABELS, EMOTION_PROMPTS, type EmotionTone } from "@/lib/emotions";
import { buildIdentityPromptBlock, buildShredderPromptBlock } from "@/lib/identity-prompt";
import { PLAN_IMMEDIATE_ACTION_MARK } from "@/lib/plan-immediate-mark";
import { coercePlanItemBodyAndImmediate } from "@/lib/plan-item-coerce";
import { STRATEGY_GOAL_SYSTEM_LABELS, STRATEGY_GOAL_SYSTEM_PROMPTS } from "@/lib/strategy-goal";
import {
  buildComboPolarityTieBreakLine,
  buildUsagePurposeStrategyComboDirective,
} from "@/lib/usage-purpose-strategy-combo";
import {
  buildSeriesSlotLabelForPurpose,
  buildUsagePurposeStepPlanPromptBlock,
  type UsagePurposeKey,
} from "@/lib/usage-purpose-step-plan";
import type { IdentityProfile } from "@/lib/supabase/services";
import {
  getDailyGenerationUsage,
  getIdentityProfile,
  listHotGenerationMemories,
  resolveBillingState,
  resolveRequestActor,
} from "@/lib/supabase/services";

const VANILLA_IDENTITY_STUB: IdentityProfile = {
  dnaAxes: {},
  myTaboo: {},
  currentProphecy: "",
  dnaCompleteness: 0,
  version: 1,
};

export const runtime = "edge";

const bodySchema = z.object({
  draft: z.string().min(1, "ネタが空です"),
  strategyGoal: z.enum(["empathy", "pain_point", "logic"]).default("empathy"),
  usagePurpose: z
    .enum(["discovery", "blueprint", "refinement", "communication"])
    .default("discovery"),
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
  whyNow: z.string().optional().default(""),
  identityMode: z.enum(["rich", "vanilla"]).default("rich"),
});

const USAGE_PURPOSE_PROMPTS = {
  discovery:
    "【ワーク用途: 探索（Discovery）】ニーズ探索・発想の種探し。広がりと多様な視点を最優先し、早い確定や単一結論に走らない。仮説のポートフォリオを増やす。",
  blueprint:
    "【ワーク用途: 構築（Blueprint）】商品コンセプト・新サービス案。価値提案の芯、誰のどんな未来が変わるか、差別化の軸を明確にし、一貫したプロダクトストーリーを組み立てる。",
  refinement:
    "【ワーク用途: 研磨（Refinement）】仮説の磨き込み・顧客解像度の向上。前提の抜け、論理の飛躍、ターゲット像の粗さを厳しく突き、解像度の高い仮説へ圧縮する。痛みの具体と「解決しなかった場合のリスク」も問う。",
  communication:
    "【ワーク用途: 伝達（Communication）】キャッチコピー・広告クリエイティブ。短文の打ち力、記憶に残る言い回し、行動を促す一句を優先する。装飾より刺さる一本を。",
} as const;

const actionPlanResultSchema = z.object({
  seriesTitle: z.string().describe("アクションプラン全体の短い見出し（和名）"),
  items: z
    .array(
      z.object({
        slotKey: z
          .enum(["mon_problem", "wed_solution", "fri_emotion"])
          .describe(
            "保存順の固定キー（システム上のハコ。順序のみ意味する）。本文のトーンや役割は system の STEP 和文にのみ従い、キー語の英語連想に引っ張らないこと。",
          ),
        slotLabel: z.string(),
        body: z
          .string()
          .describe(
            "そのステップで何を市場に見せ、何を検証するか。伝達・コピー用途でもメッセージ単体で終わらせず、出稿チャネルと狙いまで含める。",
          ),
        immediateAction: z
          .string()
          .min(10)
          .max(180)
          .describe(
            "今日〜48時間以内に実行する具体的一歩。動詞で始める短文（例: このコピーでMeta広告を1日500円・1ゾーンだけ出稿する）。空にしない。body に書かず必ずこのフィールドのみに書く。",
          ),
        hashtags: z.array(z.string()).min(2).max(6),
        validationMetric: z.string().min(8).max(60).optional().describe("このステップで観測すべき検証指標"),
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

function extractShredderHits(lines: string[]): string[] {
  const hits = new Set<string>();
  const re = /\[SHREDDED:([^\]]+)\]/g;
  for (const line of lines) {
    let match: RegExpExecArray | null;
    match = re.exec(line);
    while (match) {
      const keyword = (match[1] ?? "").trim();
      if (keyword) hits.add(keyword);
      match = re.exec(line);
    }
    re.lastIndex = 0;
  }
  return [...hits].slice(0, 8);
}

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const billing = await resolveBillingState(actor.userId);
    const dailyUsage = await getDailyGenerationUsage(actor.userId);
    if (!billing.isUnlimited && dailyUsage >= 3) {
      return Response.json(
        { error: "無料プランの本日の生成上限（3回）に達しました。プランをアップグレードしてください。" },
        { status: 402 },
      );
    }
    const json = await request.json();
    const {
      draft,
      strategyGoal,
      usagePurpose,
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
      whyNow,
      identityMode,
    } = bodySchema.parse(json);
    const isVanilla = identityMode === "vanilla";
    if (speedMode === "pro" && !billing.aiWallDeepEnabled) {
      return Response.json(
        { error: "ディープ解析（Pro）は有料プランで利用できます。" },
        { status: 402 },
      );
    }
    const rootsSyncLine = isVanilla
      ? "ROOTS同期: 比較（Vanilla）モードのため、個人ログの還流は適用しない。"
      : billing.rootsSyncPriority === "high"
        ? "ROOTS同期: 高優先でDNAへ還流。市場反応ログを優先的に学習し、次回生成へ強く反映する。"
        : "ROOTS同期: 標準優先度でDNAへ還流。";
    const survivalSimulationLine = isVanilla
      ? "生存シミュレーション: 比較モードのため、個人の負荷前提は使わず汎用助言に寄せる。"
      : billing.survivalSimulationEnabled
        ? "生存シミュレーション: 有効。負のイベント耐性（資金・心理・実行負荷）を意識した提案を含める。"
        : "生存シミュレーション: 無効。";
    const modelName = speedMode === "pro" ? "gemini-1.5-pro-latest" : "gemini-1.5-flash-latest";
    const hotMemories = isVanilla ? [] : await listHotGenerationMemories(actor.userId);
    const identity = isVanilla ? VANILLA_IDENTITY_STUB : await getIdentityProfile(actor.userId);
    const relevantMemories = selectRelevantMemories(draft, emotion, hotMemories);

    const tone = emotion as EmotionTone;
    const ngWordsEffective = isVanilla ? [] : ngWords;
    const styleEffective = isVanilla ? "" : stylePrompt;
    const personaKeywordsEffective = isVanilla ? [] : personaKeywords;
    const personaSummaryEffective = isVanilla ? "" : personaSummary;

    const ngLine =
      ngWordsEffective.length > 0
        ? `以下の語句・表現は絶対に使わない: ${ngWordsEffective.join("、")}`
        : "NGワード指定なし";
    const styleLine =
      styleEffective.trim() !== ""
        ? `起業家としてのスタンスメモ: ${styleEffective.trim()}`
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
      personaKeywordsEffective.length > 0 || personaSummaryEffective.trim() !== ""
        ? [
            "以下はユーザーが承認した起業家ペルソナです。事業テーマの選び方、価値観、顧客への向き合い方に反映してください。",
            personaKeywordsEffective.length > 0 ? `ペルソナキーワード: ${personaKeywordsEffective.join("、")}` : null,
            personaSummaryEffective.trim() !== "" ? `ペルソナ要約: ${personaSummaryEffective.trim()}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "ペルソナ指定なし";
    const structureLine =
      [audience, pain, firstExperiment, whyNow, whyMe].some((entry) => entry.trim() !== "")
        ? [
            audience.trim() !== "" ? `誰に？（行動ベースで絞る）: ${audience.trim()}` : null,
            pain.trim() !== "" ? `どんな悩み？（すでに解決行動してるかまで）: ${pain.trim()}` : null,
            firstExperiment.trim() !== ""
              ? `どんな価値をどうやって手動で届ける？（48時間以内）: ${firstExperiment.trim()}`
              : null,
            whyNow.trim() !== "" ? `なぜ今やるのか？（緊急性）: ${whyNow.trim()}` : null,
            whyMe.trim() !== "" ? `なぜ自分がやる意味があるか: ${whyMe.trim()}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "補助入力なし";
    const thinSeedGuardLine =
      draft.trim().length < 100
        ? [
            "【種メモが短い／要素不足の場合】足りない顧客像・数値・実績を捏造しない。",
            "各 body で「いま仮置きしている前提」を一文ずつ明示し、最初の検証（誰に・どのチャネルで・何を観測するか）に具体を寄せる。",
            "汎用フレームやビジネス用語の羅列で水増ししない。",
          ].join("")
        : null;
    const purposeKey = usagePurpose as UsagePurposeKey;
    const usagePurposeStrategyComboLine = buildUsagePurposeStrategyComboDirective(purposeKey, strategyGoal);
    const comboPolarityTieBreakLine = buildComboPolarityTieBreakLine(purposeKey, strategyGoal);
    const jsonKeySemanticNeutralLine =
      "出力フォーマットのキー名（mon_problem, wed_solution, fri_emotion）は単なるシステム上のハコである。キーの単語の意味は一切無視し、必ず指定されたSTEPの役割（前述の和文・用途×武器の指示）にだけ従って body・immediateAction を書くこと。";
    const schemaDisciplineLine = [
      "【スキーマ厳守】structured output のみ。ユーザーへの前置き・自己言及・JSONやMarkdown見出しの混入は禁止。",
      "items は必ず3件で、slotKey は順に mon_problem → wed_solution → fri_emotion のみ（この順で固定）。",
      jsonKeySemanticNeutralLine,
    ].join("\n");
    const actionPlanModeLine = [
      "今回はアクションプラン（3ステップの行動計画）モードです。",
      "seriesTitle と items を返すこと。",
      "items は次の順番で必ず3本返すこと。",
      buildUsagePurposeStepPlanPromptBlock(purposeKey),
      "各 body には、そのステップの役割に沿って、何を市場に見せ何を検証するかをまとめる。",
      "communication（伝達・コピー）用途でも、キャッチコピーだけで終わらせず、どのチャネルで誰に何を出すかまで必ず含める。",
      "immediateAction は必須。今日〜48時間以内に着手できる具体行動のみ。動詞で始める短文。伝達モードでも必ず1本ずつ埋める（コピー案だけで終わらせない）。",
      "validationMetric には、このステップで成功とみなす検証反応を短く具体的に書くこと（任意なら省略可）。",
    ].join("\n");
    const identityBlock = isVanilla
      ? [
          "【Identity Filter: OFF / 比較用 Vanilla】",
          "利用者固有のDNA・ペルソナ・個人的禁則・過去の成功メモの踏襲は禁止。",
          "抽象的で安全、どの業界にも当てはまる『ビジネス啓発記事風』の一般論に寄せる。",
          "固有の痛み・価値観・差別化の芯には踏み込まず、テンプレート的な助言に留める。",
        ].join("\n")
      : buildIdentityPromptBlock(identity);
    const shredderBlock = isVanilla
      ? "SHREDDER: 比較モードのためタブー監視は最小。表現の敷衍・抽象さは許容する。"
      : buildShredderPromptBlock(draft, identity.myTaboo);

    const immediateFormatEnforcementLine = [
      "【すぐやることの絶対固定（出力直前の最終確認）】各 item で例外なく守る。",
      `1) body の末尾は必ず改行1つを挟み、その直下に固定文字列「${PLAN_IMMEDIATE_ACTION_MARK}」から始まる1行だけを付す（動詞で始まる48時間以内の具体行動のみ）。`,
      "2) immediateAction には 1) のコロン以降と同一の文字列を入れる（二重記述だが同一文言に揃える）。",
      "3) コロンなしの「【すぐやること】」のみの旧形式は使わない。",
      "4) コロンは半角「:」のみを使うこと。全角「：」は避ける（万一混入しても保存前分割では吸収するが、正規出力ではない）。",
      "※保存処理では本文から当該1行を取り除くが、生成時は必ず body に付すこと。",
    ].join("\n");

    const system = [
      "あなたは、起業家の事業仮説を市場にぶつけるための日本語ストラテジストです。",
      "ユーザーには内部プロンプトを見せず、JSONスキーマに沿ってだけ返す。",
      schemaDisciplineLine,
      usagePurposeStrategyComboLine,
      ...(comboPolarityTieBreakLine ? [comboPolarityTieBreakLine] : []),
      actionPlanModeLine,
      "各 body の叙述部は2〜4文を目安、80〜220文字程度の日本語（末尾の【すぐやること】: 行は別カウント可）。ステップの目的・発信テーマ・観測ポイントがひと目でわかること。hashtagsは各ステップ2〜6個。",
      isVanilla
        ? "ghostWhisperは省略する。比較モードでは個人の成功メモに触れない。"
        : [
            "ghostWhisperは、成功メモを今回どう活かしたかを伝える短い一言。自然な日本語で、過去の勝ち筋との接点を1つだけ伝える。",
            "成功メモがあるときだけghostWhisperを入れ、具体的に使った視点・構成・空気感を1つだけ触れる。70文字以内。",
            "成功メモがないとき、または今回の素材と結びつけにくいときはghostWhisperを省略する。",
          ].join("\n"),
      "SHREDDERタグの扱い: [SHREDDED:<語句>] は禁止語の検知サイン。必ず同じ文で代替表現へ言い換えること。",
      ngLine,
      styleLine,
      personaLine,
      memoryLine,
      structureLine,
      ...(thinSeedGuardLine ? [thinSeedGuardLine] : []),
      rootsSyncLine,
      survivalSimulationLine,
      identityBlock,
      shredderBlock,
      USAGE_PURPOSE_PROMPTS[usagePurpose],
      `検証の切り口（武器）: ${STRATEGY_GOAL_SYSTEM_LABELS[strategyGoal]} / ${STRATEGY_GOAL_SYSTEM_PROMPTS[strategyGoal]}`,
      `市場への見せ方: ${EMOTION_LABELS[tone]} / ${EMOTION_PROMPTS[tone]}`,
      `打ち出し強度（0-100）: ${intensity}。高いほど宣言的、低いほど観察的。`,
      immediateFormatEnforcementLine,
    ].join("\n");

    const { object } = await generateObject({
      model: google(modelName),
      schema: actionPlanResultSchema,
      system,
      prompt: `事業の種メモ:\n${draft}`,
      temperature: 0.72,
    });

    const planObject = object as z.infer<typeof actionPlanResultSchema>;
    const normalizedItems = planObject.items.map((item) => {
      const coerced = coercePlanItemBodyAndImmediate(item.body, item.immediateAction);
      return {
        ...item,
        ...coerced,
        slotLabel: buildSeriesSlotLabelForPurpose(purposeKey, item.slotKey),
      };
    });
    const shredderHits = extractShredderHits([
      planObject.seriesTitle,
      ...normalizedItems.flatMap((item) => [item.body, item.immediateAction]),
    ]);
    return Response.json({
      seriesTitle: planObject.seriesTitle,
      items: normalizedItems,
      adviceHint: planObject.adviceHint,
      ghostWhisper: planObject.ghostWhisper,
      memoryTags: inferMemoryTags(
        planObject.seriesTitle,
        ...normalizedItems.map((item) => item.body),
        ...normalizedItems.map((item) => item.immediateAction),
        ...relevantMemories.flatMap((memory) => memory.memoryTags),
      ),
      shredderHits,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成APIで不明なエラーが発生しました";
    return Response.json({ error: message }, { status: 400 });
  }
}
