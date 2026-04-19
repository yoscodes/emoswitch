import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Ghost へ移動",
};

export default function GhostPage() {
  redirect("/identity/ghost");
}
