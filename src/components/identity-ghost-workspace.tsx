"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchGhostSettings, updateGhostSettings } from "@/lib/api-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function normalizeNgWords(input: string) {
  return input
    .split(/\n|、|,/)
    .map((word) => word.trim())
    .filter(Boolean);
}

export function IdentityGhostWorkspace() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profileUrl, setProfileUrl] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [ngWordsInput, setNgWordsInput] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const settings = await fetchGhostSettings();
        if (!active) return;
        setProfileUrl(settings.profileUrl ?? "");
        setStylePrompt(settings.stylePrompt ?? "");
        setNgWordsInput((settings.ngWords ?? []).join("\n"));
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "保存に失敗しました。");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const ngWords = useMemo(() => normalizeNgWords(ngWordsInput), [ngWordsInput]);
  const canSave = !loading && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      await updateGhostSettings({
        profileUrl: profileUrl.trim(),
        stylePrompt: stylePrompt.trim(),
        ngWords,
      });
      setStatus("保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24 md:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Ghost 設定</h1>
        <p className="text-sm text-muted-foreground">
          設定の補助画面として、プロフィール参照・起業家スタンスメモ・NGワードをまとめて編集します。
        </p>
      </header>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ghost Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="block space-y-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">プロフィールURL</span>
            <Input
              value={profileUrl}
              onChange={(event) => setProfileUrl(event.target.value)}
              placeholder="https://x.com/..."
              disabled={loading}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">起業家スタンスメモ</span>
            <Textarea
              value={stylePrompt}
              onChange={(event) => setStylePrompt(event.target.value)}
              placeholder="例: 誇張せず、観察ベースで語る。断定より検証を優先する。"
              className="min-h-28"
              disabled={loading}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">NGワード（改行/読点/カンマ区切り）</span>
            <Textarea
              value={ngWordsInput}
              onChange={(event) => setNgWordsInput(event.target.value)}
              placeholder={"人生変わる\n誰でも簡単\n稼げる"}
              className="min-h-24"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">保存対象: {ngWords.length}語</p>
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="button" onClick={() => void handleSave()} disabled={!canSave}>
              {saving ? "保存中..." : "保存する"}
            </Button>
            <Link href="/identity" className={cn(buttonVariants({ variant: "ghost" }))}>
              Identity に戻る
            </Link>
          </div>
          {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
