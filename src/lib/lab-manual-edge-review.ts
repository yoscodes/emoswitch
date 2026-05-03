/**
 * 自動テスト後の実機目視で優先したい「板挟み（タイブレーク）」組み合わせ。
 * 12 グリッド全体の最終確認は Lab で usagePurpose × strategyGoal を総当たり。
 */
export const LAB_MANUAL_EDGE_REVIEW_PRIORITY = [
  {
    id: "communication-logic",
    label: "伝達 × 論理",
    focus:
      "「短文・コピー」の制約を守りつつ、納得感のある論理を各 body 内で1行に凝縮できているか（長文化・平均化していないか）。",
  },
  {
    id: "refinement-empathy",
    label: "研磨 × 共感",
    focus:
      "前提を疑う厳しさを保ちつつ、ターゲットの痛みに寄り添った具体と、末尾の検証一文が両立しているか。",
  },
] as const;
