export type SeriesSlotKey = "mon_problem" | "wed_solution" | "fri_emotion";

/** ロードマップ・出陣モーダル共通の時系列（STEP1→3）。DB の created_at だけに依存しない。 */
export const SERIES_SLOT_ORDER: readonly SeriesSlotKey[] = ["mon_problem", "wed_solution", "fri_emotion"];

export function seriesSlotOrderIndex(slotKey: string): number {
  const i = SERIES_SLOT_ORDER.indexOf(slotKey as SeriesSlotKey);
  return i === -1 ? SERIES_SLOT_ORDER.length : i;
}

/** 負なら a が b より先（上／左） */
export function compareSeriesSlotKey(a: string, b: string): number {
  return seriesSlotOrderIndex(a) - seriesSlotOrderIndex(b);
}

export function sortSeriesLikeItemsBySlotOrder<T extends { slotKey: SeriesSlotKey; createdAt?: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) => {
    const bySlot = compareSeriesSlotKey(left.slotKey, right.slotKey);
    if (bySlot !== 0) return bySlot;
    return (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
  });
}

export type SeriesSlotConfig = {
  key: SeriesSlotKey;
  day: string;
  title: string;
  subtitle: string;
};

export const SERIES_SLOT_CONFIG: SeriesSlotConfig[] = [
  { key: "mon_problem", day: "STEP 1", title: "仮説の核を撃つ", subtitle: "小さく出して最初の反応を取る" },
  { key: "wed_solution", day: "STEP 2", title: "問いを鍛える", subtitle: "観測して次の改善ループへ" },
  { key: "fri_emotion", day: "STEP 3", title: "成果を言語化する", subtitle: "学びを固定し次につなぐ" },
];

export function getSeriesSlotLabel(slotKey: SeriesSlotKey): string {
  const slot = SERIES_SLOT_CONFIG.find((entry) => entry.key === slotKey);
  return slot ? `${slot.day} | ${slot.title}（${slot.subtitle}）` : slotKey;
}
