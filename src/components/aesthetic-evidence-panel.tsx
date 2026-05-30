"use client";

import Link from "next/link";
import { Flame, Snowflake } from "lucide-react";

import {
  type AestheticEvidenceLogEntry,
  feedbackPolarLabel,
  formatEvidenceDate,
} from "@/lib/aesthetic-evidence-log";
import { cn } from "@/lib/utils";

type AestheticEvidencePanelProps = {
  entries: AestheticEvidenceLogEntry[];
  loading?: boolean;
};

export function AestheticEvidencePanel({ entries, loading }: AestheticEvidencePanelProps) {
  return (
    <aside className="flex min-h-0 flex-col">
      <h2 className="text-sm font-semibold text-muted-foreground">美学の根拠（直近のログ）</h2>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground/90">
        実行（Roadmap）で記録したコンセプト実行メモです。エディタの補助線として参照してください。
      </p>

      <ul className="mt-3 space-y-2" aria-live="polite">
        {loading ? (
          Array.from({ length: 3 }, (_, i) => (
            <li key={`skeleton-${i}`} className="h-14 animate-pulse rounded-md bg-muted/40" />
          ))
        ) : entries.length === 0 ? (
          <li className="rounded-md border border-dashed border-border/50 bg-muted/20 px-3 py-4 text-[11px] leading-relaxed text-muted-foreground">
            まだログがありません。
            <Link href="/roadmap" className="mt-1 block font-medium text-foreground/80 underline underline-offset-2">
              実行ページ
            </Link>
            で「手応えあり」「なにか違う」を記録すると、ここに並びます。
          </li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id}>
              <AestheticEvidenceCard entry={entry} />
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}

function AestheticEvidenceCard({ entry }: { entry: AestheticEvidenceLogEntry }) {
  const isHot = entry.quickFeedback === "hot";
  const polarLabel = feedbackPolarLabel(entry.quickFeedback);

  return (
    <article
      className={cn(
        "rounded-md border border-border/40 bg-muted/30 px-2.5 py-2",
        "border-l-2",
        isHot
          ? "border-l-violet-400/70 dark:border-l-violet-500/55"
          : "border-l-sky-400/70 dark:border-l-sky-500/55",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground" dateTime={entry.at}>
          {formatEvidenceDate(entry.at)}
        </time>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium",
            isHot ? "text-violet-700 dark:text-violet-300" : "text-sky-700 dark:text-sky-300",
          )}
        >
          {isHot ? (
            <Flame className="size-3 shrink-0 opacity-80" aria-hidden />
          ) : (
            <Snowflake className="size-3 shrink-0 opacity-80" aria-hidden />
          )}
          {polarLabel}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-foreground/85">{entry.headline}</p>
    </article>
  );
}
