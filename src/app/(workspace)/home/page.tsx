import type { Metadata } from "next";

import { CreateWorkspace } from "@/components/create-workspace";

export const metadata: Metadata = {
  title: "作成",
};

export default function HomePage() {
  return <CreateWorkspace />;
}
