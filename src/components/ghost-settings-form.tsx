"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchGhostSettings, updateGhostSettings } from "@/lib/api-client";

function parseNgWords(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,、]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function GhostSettingsForm() {
  const [profileUrl, setProfileUrl] = useState("");
  const [ngRaw, setNgRaw] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [savedProfileUrl, setSavedProfileUrl] = useState("");
  const [savedNgWords, setSavedNgWords] = useState<string[]>([]);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [roadmapAlignRight, setRoadmapAlignRight] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const roadmapRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const ngWords = parseNgWords(ngRaw);
  const hasSavedProfileUrl = savedProfileUrl.trim() !== "";
  const trimmedProfileUrl = profileUrl.trim();
  const urlFeedback =
    trimmedProfileUrl === ""
      ? null
      : /^https?:\/\/(www\.)?(x|twitter)\.com\/.+/i.test(trimmedProfileUrl)
        ? "XのURLとして認識しています。保存すると、解析待ちとして登録されます。"
        : "URLを確認しました。保存すると、解析待ちとして登録されます。";

  useEffect(() => {
    void (async () => {
      try {
        const g = await fetchGhostSettings();
        setProfileUrl(g.profileUrl);
        setNgRaw(g.ngWords.join("\n"));
        setStylePrompt(g.stylePrompt);
        setSavedProfileUrl(g.profileUrl);
        setSavedNgWords(g.ngWords);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ゴースト設定の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isRoadmapOpen) return;

    const updateTooltipPosition = () => {
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      if (!tooltipRect) return;

      if (window.innerWidth >= 768) {
        setRoadmapAlignRight(false);
        return;
      }

      setRoadmapAlignRight(tooltipRect.right > window.innerWidth - 16);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!roadmapRef.current?.contains(event.target as Node)) {
        setIsRoadmapOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsRoadmapOpen(false);
      }
    };

    updateTooltipPosition();
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateTooltipPosition);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateTooltipPosition);
    };
  }, [isRoadmapOpen]);

  const handleSave = async () => {
    setError(null);
    try {
      const savedSettings = await updateGhostSettings({
        profileUrl: profileUrl.trim(),
        ngWords,
        stylePrompt: stylePrompt.trim(),
      });
      setProfileUrl(savedSettings.profileUrl);
      setNgRaw(savedSettings.ngWords.join("\n"));
      setStylePrompt(savedSettings.stylePrompt);
      setSavedProfileUrl(savedSettings.profileUrl);
      setSavedNgWords(savedSettings.ngWords);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ゴースト設定の保存に失敗しました");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-28 md:px-6">
      <header className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">マイ・ゴースト設定</Badge>
          <div ref={roadmapRef} className="relative">
            <button
              type="button"
              aria-label="ゴースト育成のロードマップ"
              aria-expanded={isRoadmapOpen}
              aria-controls="ghost-roadmap-tooltip"
              className="inline-flex size-6 items-center justify-center rounded-full border text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none"
              onClick={() => setIsRoadmapOpen((open) => !open)}
            >
              ?
            </button>
            {isRoadmapOpen ? (
              <div
                id="ghost-roadmap-tooltip"
                ref={tooltipRef}
                className={[
                  "absolute top-8 z-20 w-72 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-md",
                  roadmapAlignRight ? "right-0" : "left-0",
                ].join(" ")}
              >
                <p className="font-medium">今後の育成イメージ</p>
                <p className="mt-2 text-muted-foreground">現在: NGワード反映 + URL保存</p>
                <p className="text-muted-foreground">Step 2: 文体ラベル・性格設定</p>
                <p className="text-muted-foreground">Step 3: クロール進捗の表示</p>
                <p className="text-muted-foreground">Step 4: 学習済み投稿の確認</p>
              </div>
            ) : null}
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">マイ・ゴースト</h1>
        <p className="text-muted-foreground">
          AIに、あなたの「声」を教えましょう。過去の投稿や、大切にしている言葉をインポートすることで、
          生成される3案がよりあなたらしく、心地よいものに変わっていきます。
        </p>
      </header>

      <Card className="border-primary/10 bg-card/95">
        <CardHeader>
          <CardTitle className="text-lg">文体インポート（X など）</CardTitle>
          <CardDescription>
            プロフィールや固定ポストのURLを預けておくと、将来のクロール連携時にゴースト育成へつなげられます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="profile-url">
              プロフィール / 投稿 URL
            </label>
            {hasSavedProfileUrl ? <Badge variant="secondary">解析待ち（登録済み）</Badge> : null}
          </div>
          <Input
            id="profile-url"
            type="url"
            placeholder="https://x.com/your_handle"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            disabled={loading}
          />
          {urlFeedback ? (
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {urlFeedback}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-primary/10 bg-card/95">
        <CardHeader>
          <CardTitle className="text-lg">NGワード</CardTitle>
          <CardDescription>
            使ってほしくない語句を、カンマか改行で入力してください。保存すると、生成時の禁止表現として反映されます。
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
          {savedNgWords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {savedNgWords.map((word) => (
                <Badge key={word} variant="outline" className="rounded-full px-3 py-1">
                  {word}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-primary/10 bg-card/95">
        <CardHeader>
          <CardTitle className="text-lg">ひとこと文体指定</CardTitle>
          <CardDescription>
            URLクロールがなくても、語尾のクセや性格を一言で伝えるだけで次の生成から反映されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            placeholder={
              "例:\nやさしいけれど甘すぎない\n語尾は「〜だね」「〜かも」を混ぜる\n少し論理的、でも冷たくしない"
            }
            className="min-h-28 text-sm"
            disabled={loading}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-24 z-10 space-y-3 rounded-2xl border bg-background/90 p-4 backdrop-blur sm:bottom-6">
        <Button type="button" onClick={() => void handleSave()} disabled={loading} className="w-full sm:w-auto">
          {saved ? (
            "保存しました"
          ) : loading ? (
            "読み込み中..."
          ) : (
            "ゴーストを育てる"
          )}
        </Button>
        {saved ? <p className="text-sm text-muted-foreground">設定を更新しました。次の生成から反映されます。</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
