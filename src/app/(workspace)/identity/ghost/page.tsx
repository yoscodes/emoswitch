import type { Metadata } from "next";

import { IdentityGhostWorkspace } from "@/components/identity-ghost-workspace";

export const metadata: Metadata = {
  title: "Ghost",
  description: "Identity に紐づく Ghost（プロフィール・NGワード等）",
};

export default function IdentityGhostPage() {
  return <IdentityGhostWorkspace />;
}
