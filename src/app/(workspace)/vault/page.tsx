import type { Metadata } from "next";

import { EvidenceVault } from "@/components/evidence-vault";

export const metadata: Metadata = {
  title: "Vault",
  description: "価値あるデータの金庫（生成物・反応ログ・ROOTSの燃料）",
};

export default function VaultPage() {
  return <EvidenceVault />;
}
