import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "設定へ移動",
};

export default function GhostPage() {
  redirect("/settings");
}
