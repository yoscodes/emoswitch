import type { Metadata } from "next";

import { MainLabWorkspace } from "@/components/main-lab-workspace";

export const metadata: Metadata = {
  title: "Lab",
  description: "投稿案の生成と仮説検証",
};

export default function LabPage() {
  return <MainLabWorkspace />;
}
