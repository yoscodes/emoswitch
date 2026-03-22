"use client";

import { AuthActions } from "@/components/auth-actions";
import { useAuthSession } from "@/lib/use-auth-session";

export function DemoModeBanner() {
  const { loading, user } = useAuthSession();

  if (loading || user) {
    return null;
  }

  return (
    <div className="border-b bg-muted/40 px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">現在はデモモードです。</p>
          <p className="text-xs text-muted-foreground">
            Google ログインすると、自分専用の履歴・ゴースト設定・クレジットで使えます。
          </p>
        </div>
        <AuthActions />
      </div>
    </div>
  );
}
