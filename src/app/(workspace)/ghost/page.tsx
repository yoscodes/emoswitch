import type { Metadata } from "next";

import { GhostSettingsForm } from "@/components/ghost-settings-form";

export const metadata: Metadata = {
  title: "マイ・ゴースト",
};

export default function GhostPage() {
  return <GhostSettingsForm />;
}
