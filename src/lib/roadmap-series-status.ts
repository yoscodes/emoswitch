import type { GenerationSeriesRecord, RoadmapSeriesStatus } from "@/lib/types";

const HOT_RATE_THRESHOLD = 0.5;
const HOT_MIN_RATED_ITEMS = 2;

export function deriveRoadmapSeriesStatus(row: GenerationSeriesRecord, activeSeriesId: string | null): RoadmapSeriesStatus {
  if (activeSeriesId && row.id === activeSeriesId) return "active";

  const ratedItems = row.items.filter((item) => item.quickFeedback != null);
  if (ratedItems.length >= HOT_MIN_RATED_ITEMS) {
    const hotItems = ratedItems.filter((item) => item.quickFeedback === "hot").length;
    const hotRate = hotItems / ratedItems.length;
    if (hotRate >= HOT_RATE_THRESHOLD) return "hot";
  }

  return "archived";
}

