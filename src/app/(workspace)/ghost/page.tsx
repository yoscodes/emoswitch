import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "ペルソナへ移動",
};

export default function GhostPage() {
  redirect("/persona");
}
