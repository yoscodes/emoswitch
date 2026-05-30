import type { ArchiveOverview, QuickFeedback } from "@/lib/types";
import type { IdentityFieldLogEntryV1 } from "@/lib/roadmap-deploy";

export type AestheticEvidenceLogEntry = {
  id: string;
  at: string;
  seriesTitle: string;
  quickFeedback: "hot" | "cold";
  /** 検証タイトルまたは一言メモ（1行） */
  headline: string;
};

const DEFAULT_LIMIT = 8;

function truncateOneLine(text: string, max = 72): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function formatEvidenceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}

export { formatEvidenceDate };

function buildHeadline(seriesTitle: string, memo: string | null | undefined, slotLabel: string): string {
  const memoTrim = memo?.trim();
  if (memoTrim) return truncateOneLine(memoTrim);
  const titleTrim = seriesTitle.trim();
  if (titleTrim) return truncateOneLine(titleTrim);
  if (slotLabel.trim()) return truncateOneLine(slotLabel);
  return "（無題の検証）";
}

/**
 * Roadmap で記録された hot/cold フィードバックを直近順に集約する。
 * サーバー上のアーカイブを主とし、セッション内ログで日時・メモを補完する。
 */
export function collectRecentRoadmapFeedbackLogs(
  overview: ArchiveOverview | null,
  fieldLog: readonly IdentityFieldLogEntryV1[],
  limit = DEFAULT_LIMIT,
): AestheticEvidenceLogEntry[] {
  const logByItemId = new Map<string, IdentityFieldLogEntryV1>();
  for (const entry of fieldLog) {
    if (entry.quickFeedback !== "hot" && entry.quickFeedback !== "cold") continue;
    const existing = logByItemId.get(entry.itemId);
    if (!existing || entry.at > existing.at) {
      logByItemId.set(entry.itemId, entry);
    }
  }

  const rows: AestheticEvidenceLogEntry[] = [];
  const seenItemIds = new Set<string>();

  if (overview) {
    for (const entry of overview.entries) {
      if (entry.generationMode !== "series") continue;
      const seriesTitle = entry.title?.trim() ?? "";
      for (const item of entry.items) {
        const fb = item.quickFeedback;
        if (fb !== "hot" && fb !== "cold") continue;
        seenItemIds.add(item.id);
        const session = logByItemId.get(item.id);
        rows.push({
          id: item.id,
          at: session?.at ?? item.createdAt,
          seriesTitle,
          quickFeedback: fb,
          headline: buildHeadline(seriesTitle, session?.memo ?? item.memo, item.slotLabel),
        });
      }
    }
  }

  for (const session of fieldLog) {
    if (session.quickFeedback !== "hot" && session.quickFeedback !== "cold") continue;
    if (seenItemIds.has(session.itemId)) continue;
    rows.push({
      id: session.itemId,
      at: session.at,
      seriesTitle: "",
      quickFeedback: session.quickFeedback,
      headline: buildHeadline("", session.memo, ""),
    });
  }

  rows.sort((a, b) => b.at.localeCompare(a.at));
  return rows.slice(0, limit);
}

export function feedbackPolarLabel(feedback: QuickFeedback): string | null {
  if (feedback === "hot") return "手応えあり";
  if (feedback === "cold") return "なにか違う";
  return null;
}
