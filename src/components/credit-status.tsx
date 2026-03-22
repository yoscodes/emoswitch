"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DATA_SYNC_EVENT, fetchCreditSummary } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function CreditStatus({ className }: { className?: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const summary = await fetchCreditSummary();
      setRemaining(summary.remaining);
    } catch {
      setRemaining(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchCreditSummary()
      .then((summary) => {
        if (active) {
          setRemaining(summary.remaining);
        }
      })
      .catch(() => {
        if (active) {
          setRemaining(null);
        }
      });

    const onSync = () => {
      void refresh();
    };
    window.addEventListener(DATA_SYNC_EVENT, onSync);
    return () => {
      active = false;
      window.removeEventListener(DATA_SYNC_EVENT, onSync);
    };
  }, [refresh]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
        クレジット残り{" "}
        <span className="font-semibold text-foreground">{remaining == null ? "..." : `${remaining}回`}</span>
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
