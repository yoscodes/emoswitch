import type { Metadata } from "next";

import { AppNav } from "@/components/app-nav";

export const metadata: Metadata = {
  title: {
    template: "%s | エモ・スイッチ",
    default: "エモ・スイッチ",
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
      <div className="flex flex-1 flex-col pt-0 md:pt-14">{children}</div>
    </div>
  );
}
