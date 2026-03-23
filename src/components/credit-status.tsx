"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { DATA_SYNC_EVENT, fetchCreditSummary } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function CreditStatus({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
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
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-full border bg-background/85 shadow-sm backdrop-blur-sm",
        compact ? "h-9" : "h-10",
        className,
      )}
    >
      <div className={cn("flex items-center gap-2 px-3 text-xs font-medium", compact ? "pr-2" : "pr-3")}>
        <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Zap className="size-3.5" />
        </span>
        <span className="whitespace-nowrap text-muted-foreground">
          {!compact ? "残り " : ""}
          <span className="font-semibold text-foreground">{remaining == null ? "..." : `${remaining}回`}</span>
        </span>
      </div>
      <Link
        href="/plans"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-full rounded-none border-l border-border px-3 text-xs font-medium hover:bg-muted",
        )}
      >
        追加
      </Link>
    </div>
  );
}
