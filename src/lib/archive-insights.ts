import { EMOTION_LABELS, type EmotionTone } from "@/lib/emotions";
import type { ArchiveInsights, GenerationRecord, GenerationSeriesRecord } from "@/lib/types";

function toIntensityBucket(intensity: number): number {
  return Math.round(intensity / 10) * 10;
}

export function buildArchiveInsights(
  singles: GenerationRecord[],
  series: GenerationSeriesRecord[],
): ArchiveInsights {
  const emotions: EmotionTone[] = ["empathy", "toxic", "mood", "useful", "minimal"];

  const emotionBreakdown = emotions.map((emotion) => {
    const singleRows = singles.filter((row) => row.emotion === emotion);
    const seriesRows = series.filter((row) => row.emotion === emotion);
    const usageCount = singleRows.length + seriesRows.length;
    const hotCount =
      singleRows.filter((row) => row.quickFeedback === "hot").length +
      seriesRows.flatMap((row) => row.items).filter((item) => item.quickFeedback === "hot").length;
    const denominator = usageCount + seriesRows.flatMap((row) => row.items).length;

    return {
      emotion,
      label: EMOTION_LABELS[emotion],
      usageCount,
      hotCount,
      hotRate: denominator === 0 ? 0 : Math.round((hotCount / denominator) * 100),
    };
  });

  const allPatterns = [
    ...singles.map((row) => ({
      emotion: row.emotion,
      intensity: row.intensity,
      hot: row.quickFeedback === "hot",
      modeLabel: "単発",
    })),
    ...series.flatMap((row) =>
      row.items.map((item) => ({
        emotion: row.emotion,
        intensity: row.intensity,
        hot: item.quickFeedback === "hot",
        modeLabel: "連載",
      })),
    ),
  ];

  const groupedPatterns = new Map<
    string,
    { emotion: EmotionTone; intensity: number; total: number; hot: number; modeLabel: string }
  >();
  for (const pattern of allPatterns) {
    const key = `${pattern.emotion}:${toIntensityBucket(pattern.intensity)}:${pattern.modeLabel}`;
    const current = groupedPatterns.get(key) ?? {
      emotion: pattern.emotion,
      intensity: toIntensityBucket(pattern.intensity),
      total: 0,
      hot: 0,
      modeLabel: pattern.modeLabel,
    };
    current.total += 1;
    current.hot += pattern.hot ? 1 : 0;
    groupedPatterns.set(key, current);
  }

  const rankedPatterns = [...groupedPatterns.values()]
    .filter((pattern) => pattern.total > 0)
    .sort((left, right) => {
      const leftRate = left.hot / left.total;
      const rightRate = right.hot / right.total;
      return rightRate - leftRate || right.hot - left.hot;
    });

  const bestPattern = rankedPatterns[0];
  const weakestPattern = rankedPatterns[rankedPatterns.length - 1];
  const bestPatternSummary = bestPattern
    ? `最近のあなたは「${EMOTION_LABELS[bestPattern.emotion]} × 強度${bestPattern.intensity}%」の時に最も🔥を獲得しています。一方で、${weakestPattern ? `「${EMOTION_LABELS[weakestPattern.emotion]} × 強度${weakestPattern.intensity}%」` : "一部のモード"}は評価が分かれる傾向にあります。`
    : "まだ十分な分析データがありません。🔥評価が溜まるほど、成功パターンが言語化されます。";

  const seriesItems = series.flatMap((row) => row.items);
  const hotSeriesItems = seriesItems.filter((item) => item.quickFeedback === "hot").length;
  const ratedSeriesItems = seriesItems.filter((item) => item.quickFeedback != null).length;

  return {
    totalSingles: singles.length,
    totalSeries: series.length,
    totalHot:
      singles.filter((row) => row.quickFeedback === "hot").length +
      hotSeriesItems,
    totalCold:
      singles.filter((row) => row.quickFeedback === "cold").length +
      seriesItems.filter((item) => item.quickFeedback === "cold").length,
    emotionBreakdown,
    bestPatternSummary,
    seriesCompletionRate:
      seriesItems.length === 0 ? 0 : Math.round((ratedSeriesItems / seriesItems.length) * 100),
    seriesHotRate:
      seriesItems.length === 0 ? 0 : Math.round((hotSeriesItems / seriesItems.length) * 100),
  };
}
