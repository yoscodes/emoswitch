import type { Metadata } from "next";
import { Suspense } from "react";

import { PlansContent } from "@/components/plans/plans-content";

export const metadata: Metadata = {
  title: "プラン",
  description: "料金・クレジット",
};

function PlansLoadingFallback() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-28 pt-10 md:pb-24">
      <div className="mx-auto mb-8 h-36 max-w-3xl animate-pulse rounded-3xl bg-muted" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      </div>
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={<PlansLoadingFallback />}>
      <PlansContent />
    </Suspense>
  );
}
