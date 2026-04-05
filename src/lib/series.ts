export type SeriesSlotKey = "mon_problem" | "wed_solution" | "fri_emotion";

export type SeriesSlotConfig = {
  key: SeriesSlotKey;
  day: string;
  title: string;
  subtitle: string;
};

export const SERIES_SLOT_CONFIG: SeriesSlotConfig[] = [
  { key: "mon_problem", day: "PHASE 1", title: "共感獲得", subtitle: "なぜこの課題を扱うのか" },
  { key: "wed_solution", day: "PHASE 2", title: "権威性証明", subtitle: "どう解けるのかを示す" },
  { key: "fri_emotion", day: "PHASE 3", title: "検証募集", subtitle: "仲間と反応を集める" },
];

export function getSeriesSlotLabel(slotKey: SeriesSlotKey): string {
  const slot = SERIES_SLOT_CONFIG.find((entry) => entry.key === slotKey);
  return slot ? `${slot.day} | ${slot.title}（${slot.subtitle}）` : slotKey;
}
