import type { Metadata } from "next";

import { PlansContent } from "@/components/plans/plans-content";

export const metadata: Metadata = {
  title: "プラン",
  description: "料金・クレジット",
};

export default function PlansPage() {
  return <PlansContent />;
}
