export type SeriesSlotKey = "mon_problem" | "wed_solution" | "fri_emotion";

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
