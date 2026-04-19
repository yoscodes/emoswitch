import type { Metadata } from "next";

import { IdentityLabPage } from "@/components/identity-lab-page";

export const metadata: Metadata = {
  title: "Identity Lab",
  description: "Identity / DNA の精製（旧 persona）",
};

export default function IdentityPage() {
  return <IdentityLabPage />;
}
