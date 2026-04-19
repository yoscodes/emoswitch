import type { Metadata } from "next";

import { AppNav } from "@/components/app-nav";
import { DemoModeBanner } from "@/components/demo-mode-banner";

export const metadata: Metadata = {
  title: {
    template: "%s | Identity DNA",
    default: "Identity DNA",
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
      <div className="flex flex-1 flex-col bg-zinc-50 pt-0 dark:bg-background md:pt-14">{children}</div>
    </div>
  );
}
