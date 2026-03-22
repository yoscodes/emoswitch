"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FREE_CREDIT_LIMIT = 50;

export function CreditStatus({ className }: { className?: string }) {
  const [remaining, setRemaining] = useState(FREE_CREDIT_LIMIT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("emoswitch_generations_v1");
      const used = raw ? (JSON.parse(raw) as unknown[]).length : 0;
      setRemaining(Math.max(FREE_CREDIT_LIMIT - used, 0));
    } catch {
      setRemaining(FREE_CREDIT_LIMIT);
    }
  }, []);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
        クレジット残り <span className="font-semibold text-foreground">{remaining}回</span>
      </div>
      <Link
        href="/plans"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
      >
        追加
      </Link>
    </div>
  );
}
