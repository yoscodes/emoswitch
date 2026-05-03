/** 新規生成・保存で用いる「すぐやること」行頭（半角コロン） */
export const PLAN_IMMEDIATE_ACTION_MARK = "【すぐやること】:";
/** LLM が全角コロンを使った場合のフォールバック */
export const PLAN_IMMEDIATE_ACTION_MARK_FULLWIDTH_COLON = "【すぐやること】：";
/** 過去データ互換（コロンなし） */
export const LEGACY_PLAN_IMMEDIATE_ACTION_MARK = "【すぐやること】";

/** 検索順: 半角コロン → 全角コロン → レガシー（同一インデックスではより長いマーカーを優先） */
const MARKS_BY_SEARCH_ORDER = [
  PLAN_IMMEDIATE_ACTION_MARK,
  PLAN_IMMEDIATE_ACTION_MARK_FULLWIDTH_COLON,
  LEGACY_PLAN_IMMEDIATE_ACTION_MARK,
] as const;

/** 本文中で最初に現れるマーカー（同一位置なら長い方＝コロン付きを優先） */
export function findPlanBodyImmediateSplit(body: string): { idx: number; mark: string } | null {
  let best: { idx: number; mark: string } | null = null;
  for (const m of MARKS_BY_SEARCH_ORDER) {
    const i = body.indexOf(m);
    if (i === -1) continue;
    if (
      best === null ||
      i < best.idx ||
      (i === best.idx && m.length > best.mark.length)
    ) {
      best = { idx: i, mark: m };
    }
  }
  return best;
}

export function storedBodyContainsImmediateMarker(body: string): boolean {
  return MARKS_BY_SEARCH_ORDER.some((m) => body.includes(m));
}
