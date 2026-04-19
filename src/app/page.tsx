import type { Metadata } from "next";

import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "Identity DNA",
  description: "思想の提示",
};

export default function Page() {
  return <LandingPage />;
}
