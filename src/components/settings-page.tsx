"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Copy, CreditCard, FileText, ReceiptText, ShieldCheck, UserCircle2 } from "lucide-react";

import {
  type BillingHistory,
  fetchBillingHistory,
  fetchCreditSummary,
  fetchUserProfile,
  saveUserProfile,
} from "@/lib/api-client";
import { useAuthSession } from "@/lib/use-auth-session";
import type { CreditSummary, UserProfileSettings } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SETTINGS_TABS = ["profile", "credit", "app"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function parseSettingsTab(value: string | null): SettingsTab {
  if (value && (SETTINGS_TABS as readonly string[]).includes(value)) {
    return value as SettingsTab;
  }
  return "profile";
}

const SETTINGS_TAB_CRUMB: Record<SettingsTab, string> = {
  profile: "プロフィール",
  credit: "プラン・使用量",
  app: "アプリ情報",
};

const EMOTION_OPTIONS = [
  { value: "empathy", label: "共感導入" },
  { value: "toxic", label: "問題提起" },
  { value: "mood", label: "世界観" },
  { value: "useful", label: "論点整理" },
  { value: "minimal", label: "核心ひと言" },
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
  if (!profile) return "設定を保存すると、ここに起業家としての基本スタンスが表示されます。";

  const toneMap = {
    polite: "相手に配慮しながら、整った言葉で伝える",
    casual: "ほどよく距離が近く、読みやすいテンポで伝える",
    passionate: "熱量を乗せて、背中を押すように伝える",
  } as const;

  const endingMap = {
    desumasu: "今日も一歩ずつ進めていきましょう。",
    friendly: "今日も一歩ずつ進めていこう。",
  } as const;

  return `${toneMap[profile.writingStyle]}。初期の市場への見せ方は「${EMOTION_OPTIONS.find((item) => item.value === profile.defaultEmotion)?.label ?? "共感導入"}」で始まり、語尾は「${endingMap[profile.sentenceStyle]}」の雰囲気になります。`;
}

function formatDate(value: string | null): string {
  if (!value) return "未定";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatBillingCycle(value: BillingHistory["nextGrant"]["billingCycle"]): string {
  if (value === "monthly") return "月次";
  if (value === "yearly") return "年次";
  return "未設定";
}

export function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseSettingsTab(searchParams.get("tab"));
  const { user, loading: authLoading } = useAuthSession();

  useEffect(() => {
    if (searchParams.get("tab") === "identity") {
      router.replace("/identity");
    }
  }, [router, searchParams]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileSettings | null>(null);
  const [credit, setCredit] = useState<CreditSummary | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistory | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [defaultEmotion, setDefaultEmotion] = useState<UserProfileSettings["defaultEmotion"]>("empathy");
  const [writingStyle, setWritingStyle] = useState<UserProfileSettings["writingStyle"]>("casual");
  const [sentenceStyle, setSentenceStyle] = useState<UserProfileSettings["sentenceStyle"]>("friendly");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const [profileData, creditData, billingData] = await Promise.all([
          fetchUserProfile(),
          fetchCreditSummary(),
          fetchBillingHistory(),
        ]);
        setProfile(profileData);
        setCredit(creditData);
        setBillingHistory(billingData);
        setDisplayName(profileData.displayName);
        setDefaultEmotion(profileData.defaultEmotion);
        setWritingStyle(profileData.writingStyle);
        setSentenceStyle(profileData.sentenceStyle);
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
      setStatus("保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
    }
  };

  const handleCopyUserId = async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.id);
      setStatus("保存しました。");
    } catch {
      setError("保存に失敗しました。");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-28 pt-4 md:px-6 md:pt-5">
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
            設定ページは Google ログイン後に利用できます。ログインすると、プロフィールや Identity を自分専用で整えられます。
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-28 pt-4 md:px-6 md:pt-5">
      <header className="space-y-1.5">
        <nav
          className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground md:text-xs"
          aria-label="現在位置"
        >
          <UserCircle2 className="size-3.5 shrink-0 opacity-70 md:size-4" aria-hidden />
          <span className="font-medium text-foreground/75">設定</span>
          <span className="text-muted-foreground/70" aria-hidden>
            /
          </span>
          <span className="font-medium text-foreground">{SETTINGS_TAB_CRUMB[activeTab]}</span>
        </nav>
        {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = parseSettingsTab(value);
          router.replace(`/settings?tab=${next}`, { scroll: false });
        }}
        orientation="vertical"
        className="gap-6 md:grid md:grid-cols-[220px_minmax(0,1fr)]"
      >
        <TabsList variant="line" className="w-full items-stretch justify-start rounded-2xl border bg-card p-2">
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="credit">プラン・使用量</TabsTrigger>
          <TabsTrigger value="app">アプリ情報</TabsTrigger>
        </TabsList>

        <div className="min-w-0 space-y-6">
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>プロフィール</CardTitle>
                <CardDescription>アプリ内の呼び名と、基本情報を整えます。</CardDescription>
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
                  <Button onClick={() => void handleSaveProfile()}>保存する</Button>
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
                        保存する
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-2xl border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">起業家スタンス</p>
                    <p className="text-sm text-muted-foreground">
                      生成の初期値になる見せ方や話し方を整えて、毎回のブレを減らします。
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="default-emotion">
                        デフォルトの見せ方
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
                        話し方の傾向
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
                        語尾の傾向
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
                    <p className="text-sm font-medium">スタンスプレビュー</p>
                    <p className="mt-2 text-sm text-muted-foreground">{previewText}</p>
                  </div>

                  <Button onClick={() => void handleSaveProfile()}>保存する</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credit">
            <Card>
              <CardHeader>
                <CardTitle>プラン・使用量</CardTitle>
                <CardDescription>現在の契約状態とConcept Brief生成量の目安を確認できます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">{profile.planName}</Badge>
                  <span className="text-sm text-muted-foreground">現在のプラン</span>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard label="残りクレジット" value={credit ? `${credit.remaining}回` : "..."} />
                  <MetricCard label="累計付与" value={credit ? `${credit.granted}回` : "..."} />
                  <MetricCard label="累計生成" value={credit ? `${credit.used}回` : "..."} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CalendarClock className="size-4" />
                      自動付与
                    </div>
                    <p className="mt-3 text-2xl font-semibold">
                      {billingHistory?.nextGrant.enabled ? formatDate(billingHistory.nextGrant.nextGrantAt) : "無料プラン"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {billingHistory?.nextGrant.enabled
                        ? `${formatBillingCycle(billingHistory.nextGrant.billingCycle)}契約の更新時に、プラン分のクレジットが自動付与されます。`
                        : "有料プランに切り替えると、契約更新日にクレジットが自動付与されます。"}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ReceiptText className="size-4" />
                      決済・付与履歴
                    </div>
                    <div className="mt-3 space-y-3">
                      {billingHistory?.rows.length ? (
                        billingHistory.rows.slice(0, 4).map((row) => (
                          <div key={row.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{row.label}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</p>
                              {row.note ? <p className="mt-1 text-xs text-muted-foreground">{row.note}</p> : null}
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-emerald-600">+{row.delta}回</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">まだ決済・自動付与履歴はありません。</p>
                      )}
                    </div>
                  </div>
                </div>

                <Link href="/plans" className="inline-flex">
                  <Button>
                    <CreditCard className="mr-1 size-4" />
                    プランを見る
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="app">
            <Card>
              <CardHeader>
                <CardTitle>アプリ情報</CardTitle>
                <CardDescription>Concept Forge の利用条件とデータの扱いを確認できます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <LegalLinkCard
                    href="/terms"
                    icon={<FileText className="size-4" />}
                    title="利用規約"
                    description="サービス利用時の権利、禁止事項、課金、免責事項を確認できます。"
                  />
                  <LegalLinkCard
                    href="/privacy"
                    icon={<ShieldCheck className="size-4" />}
                    title="プライバシーポリシー"
                    description="アカウント情報、入力内容、生成データの取り扱いを確認できます。"
                  />
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

function LegalLinkCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="block rounded-2xl border bg-muted/30 p-4 transition hover:bg-muted/50">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
