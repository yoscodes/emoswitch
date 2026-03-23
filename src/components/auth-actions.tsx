"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CreditCard, LogOut, Settings, ChevronDown, Ghost } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DATA_SYNC_EVENT, fetchCreditSummary, fetchUserProfile } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/lib/use-auth-session";

type AuthActionsProps = {
  compact?: boolean;
  className?: string;
};

function getAvatarUrl(avatarUrl: unknown): string | null {
  return typeof avatarUrl === "string" && avatarUrl.trim() !== "" ? avatarUrl : null;
}

function getUserLabel(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim() !== "") return name.trim();
  if (email && email.trim() !== "") return email.trim();
  return "Googleユーザー";
}

function getInitial(label: string): string {
  return label.trim().charAt(0).toUpperCase() || "G";
}

export function AuthActions({ compact = false, className }: AuthActionsProps) {
  const { loading, user, signInWithGoogle, signOut } = useAuthSession();
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const label = useMemo(
    () => displayNameOverride ?? getUserLabel(user?.user_metadata?.full_name as string | undefined, user?.email),
    [displayNameOverride, user],
  );
  const avatarUrl = useMemo(() => getAvatarUrl(user?.user_metadata?.avatar_url), [user]);
  const email = user?.email ?? "";
  const initial = useMemo(() => getInitial(label), [label]);

  useEffect(() => {
    if (!user) {
      setDisplayNameOverride(null);
      return;
    }

    let active = true;
    const refreshProfile = async () => {
      try {
        const profile = await fetchUserProfile();
        if (active) {
          setDisplayNameOverride(profile.displayName);
        }
      } catch {
        if (active) {
          setDisplayNameOverride(null);
        }
      }
    };

    void refreshProfile();
    const onSync = () => {
      void refreshProfile();
    };
    window.addEventListener(DATA_SYNC_EVENT, onSync);

    return () => {
      active = false;
      window.removeEventListener(DATA_SYNC_EVENT, onSync);
    };
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
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

    return () => {
      active = false;
    };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!mounted || loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  const handleLogin = async () => {
    setPending(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Googleログインに失敗しました");
      setPending(false);
    }
  };

  const handleLogout = async () => {
    setPending(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ログアウトに失敗しました");
    } finally {
      setPending(false);
    }
  };

  if (!user) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {!compact ? (
          <span className="rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            デモモード
          </span>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => void handleLogin()} disabled={pending || loading}>
          Googleでログイン
        </Button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-full border bg-background/80 px-2 py-1.5 transition-colors hover:bg-muted/70",
          compact && "px-1.5",
        )}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={label}
            width={32}
            height={32}
            className="size-8 rounded-full border object-cover"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full border bg-primary/10 text-xs font-semibold text-foreground">
            {initial}
          </div>
        )}
        {!compact ? (
          <p className="hidden max-w-28 truncate text-sm font-medium md:block">{label}</p>
        ) : null}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={cn(
              "absolute right-0 z-50 mt-2 w-80 rounded-2xl border bg-background/95 p-2 shadow-2xl backdrop-blur-xl",
              compact && "bottom-full mb-2 mt-0",
            )}
            role="menu"
          >
            <div className="rounded-xl bg-muted/40 px-3 py-3">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={label}
                    width={40}
                    height={40}
                    className="size-10 rounded-full border object-cover"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full border bg-primary/10 text-sm font-semibold text-foreground">
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
              <div className="mt-3 rounded-full border bg-background/85 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">現在の残りクレジット</p>
                <p className="mt-1 font-semibold">{remaining == null ? "読み込み中..." : `${remaining}回`}</p>
              </div>
            </div>

            <div className="mx-2 my-1 h-px bg-border" />

            <div className="space-y-1 px-1 py-1">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-muted"
                role="menuitem"
              >
                <Settings className="size-4 text-muted-foreground" />
                <div>
                  <p>アカウント設定</p>
                  <p className="text-xs text-muted-foreground">プロフィールや連携の管理</p>
                </div>
              </Link>

              <Link
                href="/plans"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-muted"
                role="menuitem"
              >
                <CreditCard className="size-4 text-muted-foreground" />
                <div>
                  <p>プラン・クレジット設定</p>
                  <p className="text-xs text-muted-foreground">プラン確認とクレジット追加</p>
                </div>
              </Link>

              <Link
                href="/ghost"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-muted"
                role="menuitem"
              >
                <Ghost className="size-4 text-muted-foreground" />
                <div>
                  <p>ゴースト設定</p>
                  <p className="text-xs text-muted-foreground">文体インポートとNGワード設定</p>
                </div>
              </Link>
            </div>

            <div className="mx-2 my-1 h-px bg-border" />

            <div className="px-1 py-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void handleLogout();
                }}
                disabled={pending}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                role="menuitem"
              >
                <LogOut className="size-4" />
                <span>ログアウト</span>
              </button>
            </div>

            {error ? (
              <p className="px-3 pb-2 pt-1 text-xs text-destructive">{error}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
