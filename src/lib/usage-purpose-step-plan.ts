/** `/api/generate-triple` の usagePurpose と一致（api-client の UsagePurpose と同じ） */
export type UsagePurposeKey = "discovery" | "blueprint" | "refinement" | "communication";

/**
 * 活用方法ごとの「3ステップ・アクション」の役割。
 * Lab の構成予告と generate-triple の system 指示で同一ソースを使う。
 */
export const USAGE_PURPOSE_STEP_ACTIONS: Record<
  UsagePurposeKey,
  readonly [step1: string, step2: string, step3: string]
> = {
  discovery: [
    "痛みの観察（小さなテスト）",
    "仮説の横展開（別の切り口を試す）",
    "最初の反応の回収",
  ],
  blueprint: [
    "価値の言語化（コアメッセージの作成）",
    "プロトタイプの提示（MVPの準備）",
    "顧客への直接提案",
  ],
  refinement: [
    "前提と論点の棚卸し（矛盾・抜けの炙り出し）",
    "反証・「NO」シナリオの具体化",
    "仮説の圧縮と次検証の一文定義",
  ],
  communication: [
    "フックの作成（キャッチコピー・1行目）",
    "本文の展開（ストーリー・チャネル選定）",
    "CTA（行動喚起）の設置",
  ],
};

export function getUsagePurposeStepRoleLines(usagePurpose: UsagePurposeKey): readonly string[] {
  return USAGE_PURPOSE_STEP_ACTIONS[usagePurpose];
}

/** API system に渡す 3STEP 役割ブロック（slotKey と対応付け） */
export function buildUsagePurposeStepPlanPromptBlock(usagePurpose: UsagePurposeKey): string {
  const [r0, r1, r2] = USAGE_PURPOSE_STEP_ACTIONS[usagePurpose];
  return [
    "【3ステップの役割（活用方法に連動）】",
    "items は必ず3件。slotKey は順に mon_problem → wed_solution → fri_emotion。",
    "各 body / immediateAction / validationMetric は、次の役割に沿って一貫させること。",
    `STEP 1（slotKey=mon_problem）: ${r0}`,
    `STEP 2（slotKey=wed_solution）: ${r1}`,
    `STEP 3（slotKey=fri_emotion）: ${r2}`,
    "3本は別案ではなく、同じ仮説を前に進める連続ステップにする。",
  ].join("\n");
}

/** 保存用・UI表示用の slotLabel（STEP 番号 + 役割の短名） */
export function buildSeriesSlotLabelForPurpose(
  usagePurpose: UsagePurposeKey,
  slotKey: "mon_problem" | "wed_solution" | "fri_emotion",
): string {
  const order: Array<"mon_problem" | "wed_solution" | "fri_emotion"> = ["mon_problem", "wed_solution", "fri_emotion"];
  const index = order.indexOf(slotKey);
  const role = USAGE_PURPOSE_STEP_ACTIONS[usagePurpose][index] ?? "";
  return `STEP ${index + 1} | ${role}`;
}
