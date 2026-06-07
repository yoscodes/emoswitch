"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/use-auth-session";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, user, signInWithGoogle } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const next = useMemo(() => searchParams.get("next") ?? "/lab", [searchParams]);

  const startLogin = useCallback(() => {
    if (loading || user || startedRef.current) return;
    startedRef.current = true;
    setError(null);
    void signInWithGoogle(next).catch((e) => {
      setError(e instanceof Error ? e.message : "Googleログインに失敗しました");
      startedRef.current = false;
    });
  }, [loading, next, signInWithGoogle, user]);

  useEffect(() => {
    if (!loading && user) {
      router.replace(next);
    }
  }, [loading, next, router, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startLogin();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [startLogin]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 text-center shadow-sm">
        <p className="text-sm font-medium">{error ? "ログインに失敗しました" : "ログイン画面へ移動しています..."}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "Google認証後に、元の画面へ自動で戻ります。"}
        </p>
        {error ? (
          <Button
            className="mt-4"
            onClick={() => {
              startedRef.current = false;
              setError(null);
              startLogin();
            }}
          >
            もう一度ログインする
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AuthPageFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 text-center shadow-sm">
        <p className="text-sm font-medium">ログイン画面へ移動しています...</p>
        <p className="mt-2 text-sm text-muted-foreground">Google認証後に、元の画面へ自動で戻ります。</p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageContent />
    </Suspense>
  );
}
