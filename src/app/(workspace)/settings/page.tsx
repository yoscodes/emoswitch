import type { Metadata } from "next";
import { SettingsPage as SettingsPageContent } from "@/components/settings-page";

export const metadata: Metadata = {
  title: "アカウント設定",
};

export default function SettingsPage() {
  return <SettingsPageContent />;
}
