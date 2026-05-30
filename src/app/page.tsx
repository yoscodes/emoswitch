import type { Metadata } from "next";

import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "Concept Forge",
  description: "言葉にできない事業案を、伝わるコンセプトへ鍛えるための作業場。",
};

export default function Page() {
  return <LandingPage />;
}
