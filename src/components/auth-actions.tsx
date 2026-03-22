"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

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

export function AuthActions({ compact = false, className }: AuthActionsProps) {
  const { loading, user, signInWithGoogle, signOut } = useAuthSession();
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const label = useMemo(
    () => getUserLabel(user?.user_metadata?.full_name as string | undefined, user?.email),
    [user],
  );
  const avatarUrl = useMemo(() => getAvatarUrl(user?.user_metadata?.avatar_url), [user]);

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

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="rounded-full border bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
          {user ? "ログイン中" : "デモ"}
        </span>
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={label}
            width={28}
            height={28}
            className="size-7 rounded-full border object-cover"
          />
        ) : null}
        <Button variant="outline" size="sm" onClick={user ? () => void handleLogout() : () => void handleLogin()} disabled={pending || loading}>
          {user ? "ログアウト" : "Google"}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <div className="flex items-center gap-2">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={label}
            width={32}
            height={32}
            className="size-8 rounded-full border object-cover"
          />
        ) : null}
        <span className="rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
          {user ? `${label}` : "デモモード"}
        </span>
        <Button
          variant={user ? "ghost" : "outline"}
          size="sm"
          onClick={user ? () => void handleLogout() : () => void handleLogin()}
          disabled={pending || loading}
        >
          {user ? "ログアウト" : "Googleでログイン"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
