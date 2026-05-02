import type { StrategyGoal } from "@/lib/strategy-goal";
import { STRATEGY_GOAL_UI_LABELS } from "@/lib/strategy-goal";
import type { UsagePurposeKey } from "@/lib/usage-purpose-step-plan";

const USAGE_PURPOSE_LABEL_SHORT: Record<UsagePurposeKey, string> = {
  discovery: "探索",
  blueprint: "構築",
  refinement: "研磨",
  communication: "伝達",
};

/**
 * 活用方法 × 武器（strategyGoal）の掛け算（内容面の寄せ方）。
 * generate-triple の system に差し込む。スキーマ遵守は別行で明示し、ここでは過剰な「最優先」表現を避ける。
 */
const COMBO_BODIES: Record<UsagePurposeKey, Record<StrategyGoal, string>> = {
  discovery: {
    empathy:
      "広がりを損なわず、見過ごされた痛みへの共感から入り、同じ痛みを持つ層の小さな反応を取る仮説ポートフォリオを、3ステップのアクションプランで具体化してください。",
    pain_point:
      "早い確定に走らず、課題の強さ・市場の違和感・ズレを炙り出す問いと実験に軸を置き、新しいイシューの言語化を最優先した3ステップのアクションプランを構築してください。",
    logic:
      "仮説の筋道と根拠の弱さを洗い出しつつ、一本化しすぎず検証可能な選択肢を残すロジカルな3ステップのアクションプランを構築してください。",
  },
  blueprint: {
    empathy:
      "価値の芯を「誰の未来がどう変わるか」の物語で語り、共感でプロダクトストーリーの骨格を固める3ステップのアクションプランを構築してください。",
    pain_point:
      "解く課題と提供価値を前面に出し、差別化の根拠が腹落ちするまで課題視点で押し切る3ステップのアクションプランを構築してください。",
    logic:
      "価値提案・根拠・差別化を一貫した論理列で組み立て、反論しにくいコンセプト説明に落とす3ステップのアクションプランを構築してください。",
  },
  refinement: {
    empathy:
      "ターゲットの感情・文脈の解像度を上げ、痛みの具体と共感導線の抜けを埋める3ステップのアクションプランを構築してください。",
    pain_point:
      "前提・顧客像・イシュー設定のズレを容赦なく炙り、課題仮説の解像度を一段上げる3ステップのアクションプランを構築してください。",
    logic:
      "ターゲットの前提や論理の飛躍を容赦なく指摘し、極めてロジカルで反論の余地がないアクションプランを3ステップで構築してください。",
  },
  communication: {
    empathy:
      "論理的な正しさよりも、ターゲットが「私のことだ」と感情に刺さるコピーと、それを届けるチャネル・順序まで含めた3ステップのアクションプランを構築してください。",
    pain_point:
      "課題の痛みを一文で抉り、違和感と解決への欲求を同時に起こすメッセージと配信計画を3ステップのアクションプランで組み立ててください。",
    logic:
      "一文の根拠・流れ・CTAまで論理一貫で組み、説得と行動を両取りする3ステップのアクションプランを構築してください。",
  },
};

export function buildUsagePurposeStrategyComboDirective(
  purpose: UsagePurposeKey,
  goal: StrategyGoal,
): string {
  const p = USAGE_PURPOSE_LABEL_SHORT[purpose];
  const w = STRATEGY_GOAL_UI_LABELS[goal];
  const body = COMBO_BODIES[purpose][goal];
  return [
    `【用途×武器（内容の寄せ方）】今回は【${p}】×【${w}】の組み合わせです。`,
    body,
    "ニュアンスが用途・武器の他の説明とズレるときは、この意図に寄せてよい。",
  ].join("");
}
