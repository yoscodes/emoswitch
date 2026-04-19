import type { Metadata } from "next";

import { MainLabWorkspace } from "@/components/main-lab-workspace";

export const metadata: Metadata = {
  title: "Lab",
  description: "研究・検証の場",
};

export default function LabPage() {
  return <MainLabWorkspace />;
}
