/**
 * 検証の「武器」（Lab UI の 共感 / 課題 / 論理 と同一語彙）。
 * 旧 awareness / education / engagement は廃止。
 */
export const STRATEGY_GOALS = ["empathy", "pain_point", "logic"] as const;
export type StrategyGoal = (typeof STRATEGY_GOALS)[number];

/** 短い UI ラベル */
export const STRATEGY_GOAL_UI_LABELS: Record<StrategyGoal, string> = {
  empathy: "共感",
  pain_point: "課題",
  logic: "論理",
};

/** system プロンプト用の見出し */
export const STRATEGY_GOAL_SYSTEM_LABELS: Record<StrategyGoal, string> = {
  empathy: "共感を軸にした検証",
  pain_point: "課題の炙り出し",
  logic: "論理・納得形成",
};

export const STRATEGY_GOAL_SYSTEM_PROMPTS: Record<StrategyGoal, string> = {
  empathy:
    "目的は共感を軸にした検証。見過ごされた痛みや問題意識を自分ごと化させ、問いかけ・小さなオファー・募集で市場の返答を取る。",
  pain_point:
    "目的は課題の炙り出し。課題の強さ・市場の違和感・ターゲットのズレを前面に出し、反応とイシューの言語化を優先する。",
  logic:
    "目的は論理・納得形成。なぜ有効かを経験と論点整理で腹落ちさせ、筋の良さで信頼と次アクションに繋げる。",
};
