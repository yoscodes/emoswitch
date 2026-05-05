import type { Metadata } from "next";
import { Suspense } from "react";

import { RoadmapWorkspace } from "@/components/roadmap-workspace";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Identity との整合・作戦進捗・検証知見をまとめて扱う戦略検証ダッシュボード",
};

export default function RoadmapPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16 text-center text-muted-foreground">読み込み中…</div>}>
      <RoadmapWorkspace />
    </Suspense>
  );
}
