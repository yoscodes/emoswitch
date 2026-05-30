import { redirect } from "next/navigation";

/** @deprecated `/archive` と `/vault` は廃止しました。既存リンク互換のため `/roadmap` へ送ります。 */
export default function LegacyArchivePage() {
  redirect("/roadmap");
}
