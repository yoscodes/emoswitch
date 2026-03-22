import type { Metadata } from "next";

import { PlansContent } from "@/components/plans/plans-content";

export const metadata: Metadata = {
  title: "プラン",
  description: "エモ・スイッチの料金プラン。月払い・年払い（20%OFF）とクレジットトップアップ。",
};

export default function PlansPage() {
  return <PlansContent />;
}
