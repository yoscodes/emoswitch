"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Fingerprint, Flame, Sparkles, Wand2 } from "lucide-react";

import { analyzePersona, fetchArchiveOverview, fetchGhostSettings, updateGhostSettings } from "@/lib/api-client";
import { useAuthSession } from "@/lib/use-auth-session";
import type { ArchiveOverview, GhostSettings } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function normalizeKeywordDraft(input: string[]): string[] {
  const cleaned = input.map((item) => item.trim()).filter(Boolean);
  while (cleaned.length < 5) cleaned.push("");
  return cleaned.slice(0, 5);
}

function normalizeManualPosts(input: string[]): string[] {
  const cleaned = input.map((item) => item.trim()).filter(Boolean);
  while (cleaned.length < 5) cleaned.push("");
  return cleaned.slice(0, 5);
}

export function PersonaPage() {
  const { user, loading: authLoading } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GhostSettings | null>(null);
  const [profileUrlDraft, setProfileUrlDraft] = useState("");
  const [manualPostDrafts, setManualPostDrafts] = useState<string[]>(normalizeManualPosts([]));
  const [keywordDrafts, setKeywordDrafts] = useState<string[]>(normalizeKeywordDraft([]));
  const [summaryDraft, setSummaryDraft] = useState("");
  const [stylePromptDraft, setStylePromptDraft] = useState("");
  const [archiveOverview, setArchiveOverview] = useState<ArchiveOverview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    void Promise.all([fetchGhostSettings(), fetchArchiveOverview()])
      .then(([data, overview]) => {
        setSettings(data);
        setArchiveOverview(overview);
        setProfileUrlDraft(data.profileUrl);
        setManualPostDrafts(normalizeManualPosts(data.manualPosts));
        setKeywordDrafts(normalizeKeywordDraft(data.personaKeywords));
        setSummaryDraft(data.personaSummary);
        setStylePromptDraft(data.stylePrompt);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "ペルソナ設定の取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  const approvedKeywordCount = useMemo(
    () => keywordDrafts.map((item) => item.trim()).filter(Boolean).length,
    [keywordDrafts],
  );
  const manualPostCount = useMemo(
    () => manualPostDrafts.map((item) => item.trim()).filter(Boolean).length,
    [manualPostDrafts],
  );
  const shouldRecommendRefresh =
    (archiveOverview?.insights.totalHot ?? 0) >= 5 &&
    (archiveOverview?.insights.totalHot ?? 0) > (settings?.personaLastAnalyzedHotCount ?? 0);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setStatus(null);
    setError(null);
    try {
      await updateGhostSettings({
        profileUrl: profileUrlDraft.trim(),
        manualPosts: manualPostDrafts.map((item) => item.trim()).filter(Boolean),
      });
      const next = await analyzePersona();
      setSettings(next);
      setProfileUrlDraft(next.profileUrl);
      setManualPostDrafts(normalizeManualPosts(next.manualPosts));
      setKeywordDrafts(normalizeKeywordDraft(next.personaKeywords));
      setSummaryDraft(next.personaSummary);
      setStylePromptDraft(next.stylePrompt);
      setStatus("起業家ペルソナを更新しました。内容を確認して承認できます。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ペルソナ分析に失敗しました");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const next = await updateGhostSettings({
        profileUrl: profileUrlDraft.trim(),
        manualPosts: manualPostDrafts.map((item) => item.trim()).filter(Boolean),
        personaKeywords: keywordDrafts.map((item) => item.trim()).filter(Boolean),
        personaSummary: summaryDraft.trim(),
        stylePrompt: stylePromptDraft.trim(),
        personaStatus: "approved",
        personaLastAnalyzedHotCount: archiveOverview?.insights.totalHot ?? settings?.personaLastAnalyzedHotCount ?? 0,
      });
      setSettings(next);
      setManualPostDrafts(normalizeManualPosts(next.manualPosts));
      setKeywordDrafts(normalizeKeywordDraft(next.personaKeywords));
      setSummaryDraft(next.personaSummary);
      setStylePromptDraft(next.stylePrompt);
      setStatus("起業家ペルソナを承認しました。以後の事業仮説生成に反映されます。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ペルソナの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="mx-auto max-w-4xl px-4 py-8 pb-28 md:px-6">読み込み中...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-28 md:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">ペルソナ</h1>
          <p className="text-muted-foreground">
            ペルソナ学習は Google ログイン後に利用できます。思想・強み・価値観を育てて、事業仮説の精度を積み上げられます。
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 pb-28 md:px-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Fingerprint className="size-5" />
          <span className="text-sm font-medium">Founder Persona Studio</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">思想・強み・価値観を、事業の種になる形で育てる</h1>
        <p className="max-w-3xl text-muted-foreground">
          URL、手動で貼った過去投稿、最近の成功発信、スタンスメモをもとに、AIがあなたの起業家特性を5つのキーワードで抽出します。内容を承認・修正してから生成に反映するので、分析の中身が見えます。
        </p>
        {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </header>

      {shouldRecommendRefresh ? (
        <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/20">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-amber-600 dark:text-amber-300" />
                <p className="text-sm font-medium">新しい成功パターンが見つかりました</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Archive で 🔥 が {archiveOverview?.insights.totalHot ?? 0} 件たまりました。いま再分析すると、承認済みペルソナに最近の市場反応を取り込めます。
              </p>
            </div>
            <Button type="button" onClick={() => void handleAnalyze()} disabled={analyzing}>
              <Wand2 className="mr-1 size-4" />
              再分析する
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>取り込み元</CardTitle>
          <CardDescription>
            X のプロフィールURLだけでなく、自分の過去投稿や思想メモを直接貼って素材にできます。URL取得が難しい場合でも、ここを埋めれば確実にペルソナを作れます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">X プロフィール / 投稿 URL</p>
            <Input
              type="url"
              value={profileUrlDraft}
              onChange={(event) => setProfileUrlDraft(event.target.value)}
              placeholder="https://x.com/your_handle"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">手動で貼る過去投稿 / 思想メモ</p>
              <span className="text-xs text-muted-foreground">{manualPostCount}/5 入力済み</span>
            </div>
            <div className="grid gap-3">
              {manualPostDrafts.map((post, index) => (
                <Textarea
                  key={`manual-post-${index}`}
                  value={post}
                  onChange={(event) => {
                    const next = [...manualPostDrafts];
                    next[index] = event.target.value;
                    setManualPostDrafts(normalizeManualPosts(next));
                  }}
                  className="min-h-20"
                  placeholder={`材料 ${index + 1} をそのまま貼り付け`}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void handleAnalyze()} disabled={analyzing}>
              <Wand2 className="mr-1 size-4" />
              {analyzing ? "分析中..." : "起業家特性を抽出"}
            </Button>
            <Link href="/home">
              <Button type="button" variant="outline">
                Seed Workspace へ戻る
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>起業家ペルソナ分析</CardTitle>
          <CardDescription>
            抽出結果はそのまま使わず、あなた自身が承認・修正できます。ここで整えた内容が今後の事業仮説生成精度に効きます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {settings?.personaStatus === "approved" ? "承認済み" : settings?.personaStatus === "draft" ? "確認待ち" : "未作成"}
            </Badge>
            <span className="text-sm text-muted-foreground">{approvedKeywordCount}/5 キーワード入力済み</span>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            {keywordDrafts.map((keyword, index) => (
              <Input
                key={`persona-keyword-${index}`}
                value={keyword}
                onChange={(event) => {
                  const next = [...keywordDrafts];
                  next[index] = event.target.value;
                  setKeywordDrafts(normalizeKeywordDraft(next));
                }}
                placeholder={["問題意識", "強み", "価値観", "顧客観", "発信姿勢"][index]}
              />
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">要約</p>
            <Textarea
              value={summaryDraft}
              onChange={(event) => setSummaryDraft(event.target.value)}
              className="min-h-28"
              placeholder="例: 当事者として抱えた違和感から課題を定義し、実体験と観察をもとに小さく検証を回すタイプ..."
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">生成に使う起業家スタンスメモ</p>
            <Textarea
              value={stylePromptDraft}
              onChange={(event) => setStylePromptDraft(event.target.value)}
              className="min-h-24"
              placeholder="例: 原体験から課題を語り、断定しすぎず検証を呼び込む。顧客を見下さず、同じ目線で話す。"
            />
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <p className="text-sm font-medium">なぜこの分析になったか</p>
            </div>
            {settings?.personaEvidence && settings.personaEvidence.length > 0 ? (
              <div className="space-y-2">
                {settings.personaEvidence.map((item) => (
                  <p key={item} className="text-sm text-muted-foreground">
                    ・{item}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                まだ分析結果がありません。URLか手動投稿を用意して、起業家特性の抽出を実行してください。
              </p>
            )}
          </div>

          <Button type="button" onClick={() => void handleApprove()} disabled={saving || approvedKeywordCount < 5}>
            <CheckCircle2 className="mr-1 size-4" />
            {saving ? "保存中..." : "この内容で承認する"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
