import { redirect } from "next/navigation";

/** @deprecated `/vault` は廃止しました。既存リンク互換のため `/roadmap` へ送ります。 */
export default function VaultPage() {
  redirect("/roadmap");
}
