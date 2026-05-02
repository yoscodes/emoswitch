import type { Metadata } from "next";
import { Suspense } from "react";

import { RoadmapWorkspace } from "@/components/roadmap-workspace";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "生存状況・実行プロトコル・検証報告を一つの時系列で扱うダッシュボード",
};

export default function RoadmapPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16 text-center text-muted-foreground">読み込み中…</div>}>
      <RoadmapWorkspace />
    </Suspense>
  );
}
