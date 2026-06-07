import type { Metadata } from "next";
import Link from "next/link";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Concept Forge",
  description: "Concept Forge における個人情報、入力内容、生成データの取り扱いについて。",
};

const sections = [
  {
    title: "1. 取得する情報",
    body: "ログインに必要なアカウント情報、表示名、メールアドレス、入力された事業案メモ、Concept Brief、実行メモ、課金状態やクレジット履歴など、サービス提供に必要な情報を取得します。",
  },
  {
    title: "2. 利用目的",
    body: "取得した情報は、アカウント管理、Concept Brief の生成・保存・編集、利用量の管理、課金状態の確認、品質改善、不正利用防止、サポート対応のために利用します。",
  },
  {
    title: "3. AI生成に関する取り扱い",
    body: "ユーザーの入力内容は、Concept Brief や実行プランを生成するために外部AIサービスへ送信される場合があります。機密性の高い情報や第三者に共有できない情報は入力しないでください。",
  },
  {
    title: "4. 決済情報",
    body: "決済処理は外部決済サービスを通じて行います。カード番号などの詳細な決済情報は Concept Forge のアプリ内では保持しません。",
  },
  {
    title: "5. 第三者提供",
    body: "法令に基づく場合、サービス提供に必要な委託先へ共有する場合、またはユーザーの同意がある場合を除き、個人情報を第三者へ販売・提供しません。",
  },
  {
    title: "6. データの管理",
    body: `ユーザーのデータは適切なアクセス制御のもとで管理します。アカウント削除、保存データの削除、登録情報に関する問い合わせは ${supportEmail} までご連絡ください。本人確認後、法令上保持が必要な情報を除き、合理的な範囲で対応します。`,
  },
  {
    title: "7. 変更",
    body: "本ポリシーは、サービス内容や法令の変更に応じて更新される場合があります。重要な変更はアプリ内または適切な方法で通知します。",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 md:px-6">
      <header className="space-y-3">
        <Link href="/settings?tab=app" className="text-sm text-muted-foreground hover:text-foreground">
          設定へ戻る
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">プライバシーポリシー</h1>
          <p className="text-sm text-muted-foreground">最終更新日: 2026年5月30日</p>
        </div>
      </header>

      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border bg-card p-5">
            <h2 className="text-base font-semibold">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
