import type { Metadata } from "next";

import { IdentityLabPage } from "@/components/identity-lab-page";

export const metadata: Metadata = {
  title: "Identity",
  description: "My Taboo の編集、軌跡の再分析、Identity の確定",
};

export default function IdentityPage() {
  return <IdentityLabPage />;
}
