import type { Metadata } from "next";

import { ArchivePanel } from "@/components/archive-panel";

export const metadata: Metadata = {
  title: "アーカイブ",
};

export default function ArchivePage() {
  return <ArchivePanel />;
}
