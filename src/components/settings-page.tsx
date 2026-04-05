"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, CreditCard, Download, MoonStar, RefreshCcw, ShieldAlert, UserCircle2 } from "lucide-react";

import {
  fetchCreditSummary,
  fetchGenerations,
  fetchGhostSettings,
  fetchUserProfile,
  resetArchive,
  updateGhostSettings,
  saveUserProfile,
} from "@/lib/api-client";
import { useAuthSession } from "@/lib/use-auth-session";
import type { CreditSummary, GenerationRecord, GhostSettings, UserProfileSettings } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const EMOTION_OPTIONS = [
  { value: "empathy", label: "共感" },
  { value: "toxic", label: "毒舌" },
  { value: "mood", label: "情緒" },
  { value: "useful", label: "有益" },
  { value: "minimal", label: "ミニマル" },
] as const;

const WRITING_STYLE_OPTIONS = [
  { value: "polite", label: "丁寧" },
  { value: "casual", label: "カジュアル" },
  { value: "passionate", label: "熱血" },
] as const;

const SENTENCE_STYLE_OPTIONS = [
  { value: "desumasu", label: "ですます" },
  { value: "friendly", label: "だね・だよ" },
] as const;

function buildPreview(profile: UserProfileSettings | null): string {
  if (!profile) return "設定を保存すると、ここに話し方のサンプルが表示されます。";

  const toneMap = {
    polite: "相手に配慮しながら、整った言葉で伝える",
    casual: "ほどよく距離が近く、読みやすいテンポで伝える",
    passionate: "熱量を乗せて、背中を押すように伝える",
  } as const;

  const endingMap = {
    desumasu: "今日も一歩ずつ進めていきましょう。",
    friendly: "今日も一歩ずつ進めていこう。",
  } as const;

  return `${toneMap[profile.writingStyle]}。初期感情は「${EMOTION_OPTIONS.find((item) => item.value === profile.defaultEmotion)?.label ?? "共感"}」で始まり、語尾は「${endingMap[profile.sentenceStyle]}」の雰囲気になります。`;
}

function escapeCsv(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCsv(rows: GenerationRecord[]): string {
  const header = [
    "id",
    "createdAt",
    "draft",
    "emotion",
    "intensity",
    "speedMode",
    "selectedIndex",
    "likes",
    "memo",
    "variants",
    "hashtags",
  ];

  const lines = rows.map((row) =>
    [
      row.id,
      row.createdAt,
      row.draft,
      row.emotion,
      row.intensity,
      row.speedMode ?? "",
      row.selectedIndex,
      row.likes,
      row.memo ?? "",
      row.variants.join(" / "),
      row.hashtags.join(" "),
    ]
      .map(escapeCsv)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

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

export function SettingsPage() {
  const { user, loading: authLoading } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileSettings | null>(null);
  const [credit, setCredit] = useState<CreditSummary | null>(null);
  const [ghostSettings, setGhostSettings] = useState<GhostSettings | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [defaultEmotion, setDefaultEmotion] = useState<UserProfileSettings["defaultEmotion"]>("empathy");
  const [writingStyle, setWritingStyle] = useState<UserProfileSettings["writingStyle"]>("casual");
  const [sentenceStyle, setSentenceStyle] = useState<UserProfileSettings["sentenceStyle"]>("friendly");
  const [profileUrlDraft, setProfileUrlDraft] = useState("");
  const [ngRawDraft, setNgRawDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const [profileData, creditData, ghostData] = await Promise.all([
          fetchUserProfile(),
          fetchCreditSummary(),
          fetchGhostSettings(),
        ]);
        setProfile(profileData);
        setCredit(creditData);
        setGhostSettings(ghostData);
        setDisplayName(profileData.displayName);
        setDefaultEmotion(profileData.defaultEmotion);
        setWritingStyle(profileData.writingStyle);
        setSentenceStyle(profileData.sentenceStyle);
        setProfileUrlDraft(ghostData.profileUrl);
        setNgRawDraft(ghostData.ngWords.join("\n"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "設定情報の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  const previewText = useMemo(
    () =>
      buildPreview(
        profile
          ? {
              ...profile,
              displayName,
              defaultEmotion,
              writingStyle,
              sentenceStyle,
            }
          : null,
      ),
    [defaultEmotion, displayName, profile, sentenceStyle, writingStyle],
  );

  const handleSaveProfile = async () => {
    if (!user) return;
    setError(null);
    setStatus(null);
    try {
      const nextProfile = await saveUserProfile({
        displayName,
        defaultEmotion,
        writingStyle,
        sentenceStyle,
      });
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName);
      setStatus("プロフィール設定を保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "プロフィール保存に失敗しました");
    }
  };

  const handleCopyUserId = async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.id);
      setStatus("ユーザーIDをコピーしました。");
    } catch {
      setError("ユーザーIDのコピーに失敗しました。");
    }
  };

  const handleExportCsv = async () => {
    try {
      const rows = await fetchGenerations();
      const csv = buildCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `emoswitch-archive-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("アーカイブをCSVで書き出しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV書き出しに失敗しました");
    }
  };

  const handleResetArchive = async () => {
    if (!window.confirm("アーカイブ履歴をすべて非表示にします。よろしいですか？")) return;
    setResetting(true);
    setError(null);
    setStatus(null);
    try {
      const result = await resetArchive();
      setStatus(`${result.deletedCount}件の履歴をリセットしました。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "履歴のリセットに失敗しました");
    } finally {
      setResetting(false);
    }
  };

  const handleSaveProfileImport = async () => {
    if (!ghostSettings) return;
    setError(null);
    setStatus(null);
    try {
      const nextGhost = await updateGhostSettings({
        profileUrl: profileUrlDraft.trim(),
        ngWords: ghostSettings.ngWords,
        stylePrompt: ghostSettings.stylePrompt,
      });
      setGhostSettings(nextGhost);
      setProfileUrlDraft(nextGhost.profileUrl);
      setStatus("プロフィールURLを保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "プロフィールURLの保存に失敗しました");
    }
  };

  const handleSaveNgWords = async () => {
    if (!ghostSettings) return;
    setError(null);
    setStatus(null);
    try {
      const nextGhost = await updateGhostSettings({
        profileUrl: ghostSettings.profileUrl,
        ngWords: parseNgWords(ngRawDraft),
        stylePrompt: ghostSettings.stylePrompt,
      });
      setGhostSettings(nextGhost);
      setNgRawDraft(nextGhost.ngWords.join("\n"));
      setStatus("NGワードを保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "NGワードの保存に失敗しました");
    }
  };

  const hasSavedProfileUrl = (ghostSettings?.profileUrl ?? "").trim() !== "";
  const urlFeedback =
    profileUrlDraft.trim() === ""
      ? null
      : /^https?:\/\/(www\.)?(x|twitter)\.com\/.+/i.test(profileUrlDraft.trim())
        ? "XのURLとして認識しています。保存するとプロフィール連携候補として登録されます。"
        : "URLを確認しました。保存するとプロフィール連携候補として登録されます。";

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 pb-28 md:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
          <div className="h-128 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-28 md:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">設定</h1>
          <p className="text-muted-foreground">
            設定ページは Google ログイン後に利用できます。ログインすると、プロフィールやデータ管理を自分専用で整えられます。
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 pb-28 md:px-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <UserCircle2 className="size-5" />
          <span className="text-sm font-medium">設定</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">自分の居場所を整える</h1>
        <p className="text-muted-foreground">
          プロフィール、執筆スタイル、インポート設定、データ管理を一つの場所にまとめています。
        </p>
        {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </header>

      <Tabs defaultValue="profile" orientation="vertical" className="gap-6 md:grid md:grid-cols-[220px_minmax(0,1fr)]">
        <TabsList variant="line" className="w-full items-stretch justify-start rounded-2xl border bg-card p-2">
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="credit">プラン・使用量</TabsTrigger>
          <TabsTrigger value="data">データ管理</TabsTrigger>
          <TabsTrigger value="app">アプリ情報</TabsTrigger>
        </TabsList>

        <div className="min-w-0 space-y-6">
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>プロフィール</CardTitle>
                <CardDescription>アプリ内の呼び名と、連絡時に必要な基本情報を整えます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-full border bg-primary/10 text-lg font-semibold">
                    {profile.avatarUrl ? (
                      <Image
                        src={profile.avatarUrl}
                        alt={profile.displayName}
                        width={56}
                        height={56}
                      className="rounded-full object-cover"
                      />
                    ) : (
                      profile.displayName.charAt(0)
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Google 連携中</p>
                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="display-name">
                      表示名
                    </label>
                    <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                  <Button onClick={() => void handleSaveProfile()}>保存</Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">メールアドレス</p>
                    <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      {profile.email}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">ユーザーID</p>
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1 rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                        <span className="block truncate">{profile.id}</span>
                      </div>
                      <Button variant="outline" onClick={() => void handleCopyUserId()}>
                        <Copy className="mr-1 size-4" />
                        コピー
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-2xl border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">執筆スタイル</p>
                    <p className="text-sm text-muted-foreground">
                      生成の初期値になる感情や語尾を整えて、毎回のブレを減らします。
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="default-emotion">
                        デフォルト感情
                      </label>
                      <select
                        id="default-emotion"
                        value={defaultEmotion}
                        onChange={(e) => setDefaultEmotion(e.target.value as UserProfileSettings["defaultEmotion"])}
                        className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
                      >
                        {EMOTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="writing-style">
                        文体パラメータ
                      </label>
                      <select
                        id="writing-style"
                        value={writingStyle}
                        onChange={(e) => setWritingStyle(e.target.value as UserProfileSettings["writingStyle"])}
                        className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
                      >
                        {WRITING_STYLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="sentence-style">
                        語尾の癖
                      </label>
                      <select
                        id="sentence-style"
                        value={sentenceStyle}
                        onChange={(e) => setSentenceStyle(e.target.value as UserProfileSettings["sentenceStyle"])}
                        className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
                      >
                        {SENTENCE_STYLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-background/70 p-4">
                    <p className="text-sm font-medium">プレビュー</p>
                    <p className="mt-2 text-sm text-muted-foreground">{previewText}</p>
                  </div>

                  <Button onClick={() => void handleSaveProfile()}>執筆スタイルを保存</Button>
                </div>

                <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">ペルソナ連携</p>
                    <p className="text-sm text-muted-foreground">
                      URL登録やキーワード承認はペルソナ専用ページにまとめました。ここでは入口だけ管理できます。
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-sm font-medium" htmlFor="profile-import-url">
                      プロフィール / 投稿 URL
                    </label>
                    {hasSavedProfileUrl ? <Badge variant="secondary">解析待ち（登録済み）</Badge> : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <div className="space-y-2">
                      <Input
                        id="profile-import-url"
                        type="url"
                        value={profileUrlDraft}
                        onChange={(e) => setProfileUrlDraft(e.target.value)}
                        placeholder="https://x.com/your_handle"
                      />
                      {urlFeedback ? (
                        <div className="rounded-xl border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                          {urlFeedback}
                        </div>
                      ) : null}
                    </div>
                    <Button variant="outline" onClick={() => void handleSaveProfileImport()}>
                      URLを保存
                    </Button>
                  </div>
                  <Link href="/persona" className="inline-flex">
                    <Button>ペルソナページを開く</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credit">
            <Card>
              <CardHeader>
                <CardTitle>プラン・使用量</CardTitle>
                <CardDescription>現在の契約状態とクレジット消費の目安を確認できます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">{profile.planName}</Badge>
                  <span className="text-sm text-muted-foreground">現在のプラン</span>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard label="残りクレジット" value={credit ? `${credit.remaining}回` : "..."} />
                  <MetricCard label="累計付与" value={credit ? `${credit.granted}回` : "..."} />
                  <MetricCard label="累計使用" value={credit ? `${credit.used}回` : "..."} />
                </div>

                <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  次回の自動付与や決済履歴は今後ここに追加予定です。まずはプランページからクレジットを管理できます。
                </div>

                <Link href="/plans" className="inline-flex">
                  <Button>
                    <CreditCard className="mr-1 size-4" />
                    プランを変更する
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <Card>
              <CardHeader>
                <CardTitle>データ管理</CardTitle>
                <CardDescription>履歴を持ち出したり、危険な操作をここから管理します。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">NGワード設定</p>
                    <p className="text-sm text-muted-foreground">
                      アプリ全体で避けたい語句をルールとして保存します。生成時の禁止表現として反映されます。
                    </p>
                  </div>

                  <Textarea
                    value={ngRawDraft}
                    onChange={(e) => setNgRawDraft(e.target.value)}
                    placeholder={"例:\nマジで\n〜っす\n炎上"}
                    className="min-h-28 font-mono text-sm"
                  />

                  {ghostSettings && ghostSettings.ngWords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {ghostSettings.ngWords.map((word) => (
                        <Badge key={word} variant="outline" className="rounded-full px-3 py-1">
                          {word}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <Button variant="outline" onClick={() => void handleSaveNgWords()}>
                    NGワードを保存
                  </Button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => void handleExportCsv()}>
                    <Download className="mr-1 size-4" />
                    アーカイブをCSVで書き出す
                  </Button>
                  <Button variant="outline" onClick={() => void handleResetArchive()} disabled={resetting}>
                    <RefreshCcw className="mr-1 size-4" />
                    全履歴を消去
                  </Button>
                </div>

                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 size-5 text-destructive" />
                    <div className="space-y-2">
                      <p className="font-medium text-destructive">危険な操作</p>
                      <p className="text-sm text-muted-foreground">
                        アカウント削除は Auth・DB・決済の連動整理後に解放予定です。まずは CSV 書き出しでデータを保全してください。
                      </p>
                      <Button variant="destructive" disabled>
                        アカウントを削除する（準備中）
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="app">
            <Card>
              <CardHeader>
                <CardTitle>アプリ情報</CardTitle>
                <CardDescription>見た目やポリシーの確認用セクションです。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MoonStar className="size-4" />
                    外観
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    ダークモード切替は今後追加予定です。現在はシステムテーマに追従する前提でデザインを整えています。
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                    利用規約リンクは準備中です。
                  </div>
                  <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                    プライバシーポリシーリンクは準備中です。
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
