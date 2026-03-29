export type SeriesSlotKey = "mon_problem" | "wed_solution" | "fri_emotion";

export type SeriesSlotConfig = {
  key: SeriesSlotKey;
  day: string;
  title: string;
  subtitle: string;
};

export const SERIES_SLOT_CONFIG: SeriesSlotConfig[] = [
  { key: "mon_problem", day: "月曜", title: "問題提起", subtitle: "共感" },
  { key: "wed_solution", day: "水曜", title: "解決策", subtitle: "実用" },
  { key: "fri_emotion", day: "金曜", title: "募集・本音", subtitle: "感情" },
];

export function getSeriesSlotLabel(slotKey: SeriesSlotKey): string {
  const slot = SERIES_SLOT_CONFIG.find((entry) => entry.key === slotKey);
  return slot ? `${slot.day} | ${slot.title}（${slot.subtitle}）` : slotKey;
}
