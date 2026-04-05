import type { Metadata } from "next";

import { AppNav } from "@/components/app-nav";
import { DemoModeBanner } from "@/components/demo-mode-banner";

export const metadata: Metadata = {
  title: {
    template: "%s | Persona DNA",
    default: "Persona DNA",
  },
};

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav />
      <DemoModeBanner />
      <div className="flex flex-1 flex-col pt-0 md:pt-14">{children}</div>
    </div>
  );
}
