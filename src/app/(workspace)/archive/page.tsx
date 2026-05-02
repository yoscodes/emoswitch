import { redirect } from "next/navigation";

/** @deprecated `/roadmap` へ統合しました */
export default function LegacyArchivePage() {
  redirect("/roadmap");
}
