import type { Metadata } from "next";

import { PersonaPage as PersonaPageContent } from "@/components/persona-page";

export const metadata: Metadata = {
  title: "ペルソナ",
};

export default function PersonaPage() {
  return <PersonaPageContent />;
}
