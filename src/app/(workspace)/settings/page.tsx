import type { Metadata } from "next";
import { Suspense } from "react";

import { SettingsPage as SettingsPageContent } from "@/components/settings-page";

export const metadata: Metadata = {
  title: "設定",
  description: "プロフィール、プラン、アプリ情報",
};

function SettingsLoadingFallback() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-28 pt-4 md:px-6 md:pt-5">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        <div className="h-128 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoadingFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}
