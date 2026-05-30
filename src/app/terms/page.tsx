import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約 | Concept Forge",
  description: "Concept Forge の利用条件、課金、禁止事項、免責事項について。",
};

const sections = [
  {
    title: "1. サービスの目的",
    body: "Concept Forge は、言葉にしきれていない事業案を Concept Brief と実行プランへ整理するためのワークスペースです。生成結果は意思決定を補助するものであり、成果や事業成長を保証するものではありません。",
  },
  {
    title: "2. アカウント",
    body: "ユーザーは自身のアカウント情報を適切に管理するものとします。不正利用、第三者への譲渡、なりすましは禁止します。",
  },
  {
    title: "3. 入力内容と生成結果",
    body: "ユーザーが入力したメモ、プロフィール情報、生成された Concept Brief は、ユーザー自身の検討・保存・編集のために利用されます。第三者の権利を侵害する情報、機密保持義務に違反する情報の入力は避けてください。",
  },
  {
    title: "4. 課金とクレジット",
    body: "有料プランでは、契約期間やプランに応じてクレジットが付与されます。決済処理は外部決済サービスを通じて行われ、プラン内容や価格は変更される場合があります。",
  },
  {
    title: "5. 禁止事項",
    body: "法令違反、公序良俗に反する利用、過度な負荷をかける行為、サービスの解析・妨害、他者の権利を侵害する内容の生成や保存を禁止します。",
  },
  {
    title: "6. 免責",
    body: "本サービスの生成内容、分析内容、提案内容の正確性・完全性・有用性について保証しません。ユーザーは自身の判断と責任で生成結果を利用するものとします。",
  },
  {
    title: "7. 規約の変更",
    body: "必要に応じて本規約を変更することがあります。重要な変更がある場合は、アプリ内または適切な方法で通知します。",
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 md:px-6">
      <header className="space-y-3">
        <Link href="/settings?tab=app" className="text-sm text-muted-foreground hover:text-foreground">
          設定へ戻る
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">利用規約</h1>
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
