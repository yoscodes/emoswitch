import type { Metadata } from "next";

import { IdentityGhostWorkspace } from "@/components/identity-ghost-workspace";

export const metadata: Metadata = {
  title: "Ghost 設定",
  description: "プロフィール参照・スタンスメモ・NGワード（高度な Ghost 設定）",
};

export default function SettingsGhostPage() {
  return <IdentityGhostWorkspace />;
}
