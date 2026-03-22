"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchGhostSettings, updateGhostSettings } from "@/lib/api-client";

export function GhostSettingsForm() {
  const [profileUrl, setProfileUrl] = useState("");
  const [ngRaw, setNgRaw] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const g = await fetchGhostSettings();
        setProfileUrl(g.profileUrl);
        setNgRaw(g.ngWords.join("\n"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "ゴースト設定の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    const ngWords = ngRaw
      .split(/[\n,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setError(null);
    try {
      const savedSettings = await updateGhostSettings({ profileUrl: profileUrl.trim(), ngWords });
      setProfileUrl(savedSettings.profileUrl);
      setNgRaw(savedSettings.ngWords.join("\n"));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ゴースト設定の保存に失敗しました");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 pb-28 md:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">マイ・ゴースト</h1>
        <p className="text-muted-foreground">
          あなたの文体や地雷を覚えさせて、生成を「自分っぽく」寄せます（文体インポートは Supabase Vector
          連携で順次解放予定）。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5" />
            文体インポート（X など）
          </CardTitle>
          <CardDescription>
            プロフィール or 固定ポストのURLを保存しておきます。バックエンドでクロール＋ベクトル化する準備ができたら、このURLから学習します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="text-sm font-medium" htmlFor="profile-url">
            プロフィール / 投稿 URL
          </label>
          <Input
            id="profile-url"
            type="url"
            placeholder="https://x.com/your_handle"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            className="mt-2"
            disabled={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">NGワード</CardTitle>
          <CardDescription>
            生成時に使わせたくない語句を1行に1つ、またはカンマ区切りで。作成画面の生成APIに渡されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={ngRaw}
            onChange={(e) => setNgRaw(e.target.value)}
            placeholder={"例:\nマジで\n〜っす\n炎上"}
            className="min-h-32 font-mono text-sm"
            disabled={loading}
          />
          <Button type="button" onClick={() => void handleSave()} disabled={loading}>
            {saved ? "保存しました" : "保存する"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
