import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ghost",
  description: "Identity に紐づく Ghost（プロフィール・NGワード等）",
};

export default function IdentityGhostPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Ghost（プロフィール・NGワード等）は Identity Lab と一体で管理されています。メインの編集は Identity Lab から行えます。
      </p>
      <Link href="/identity" className={cn(buttonVariants({ variant: "default" }), "mt-8")}>
        Identity Lab へ
      </Link>
    </div>
  );
}
