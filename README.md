# Concept Forge

言葉にできない事業案を、伝わるコンセプトへ。  
輪郭のない構想を、説明できる言葉と実行できる設計に鍛える。

## 技術スタック

- Next.js 16 (App Router / TypeScript)
- Vercel AI SDK + Gemini 2.5 (Flash / Pro切替)
- OpenAI Whisper API（音声入力の文字起こし）
- Supabase（クライアント / サーバークライアント雛形）
- shadcn/ui + Framer Motion + Lucide React

## セットアップ

1. 依存関係をインストール
   ```bash
   npm install
   ```
2. 環境変数を作成
   ```bash
   cp .env.example .env.local
   ```
3. `.env.local` にキーを設定
   - `GOOGLE_GENERATIVE_AI_API_KEY`
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - （任意）Stripe Payment Links 用 `NEXT_PUBLIC_STRIPE_CHECKOUT_*`（`/.env.example` 参照）
4. 開発サーバー起動
   ```bash
   npm run dev
   ```

## 画面構成

| パス | 内容 |
|------|------|
| `/` | LP（プロダクトの提示） |
| `/lab` | Main Lab（自由メモと解像度シートから Concept Brief + 最初の3アクションを生成。旧 `/home` はここへリダイレクト） |
| `/roadmap` | Roadmap（Concept Brief をもとに最初の3アクションを進め、実行メモを残す） |
| `/identity` | Identity Lab（My Taboo・行動ログから、Concept Brief に乗せる自分の軸を整える。旧 `/persona` はここへリダイレクト） |
| `/settings/ghost` | Ghost（プロフィール・スタンスメモ・NGワード等の詳細設定） |
| `/ghost` | `/settings/ghost` へリダイレクト |
| `/plans` | 料金・クレジット |
| `/settings` | アカウント設定 |

`/vault` と `/archive` は廃止済みです。既存リンク互換のため、現在は `/roadmap` へリダイレクトします。

## 実装済みAPI

- `POST /api/scrap-organize`
  - 入力: `draft`
  - 自由メモ（Scrap）を「誰に / どんな悩み / どう届ける / なぜ今」の解像度シートへ仮整理
- `POST /api/hypothesis-canvas`
  - 入力: `draft`, `usagePurpose`, `emotion`, `intensity`, `personaKeywords`, `personaSummary`
  - 生成前の一行要約、プレビュータイトル、Identity一致率、逆質問を返す
- `POST /api/generate-triple`
  - 入力: `draft`, `usagePurpose`, `strategyGoal`, `emotion`, `intensity`, `ngWords`, `audience`, `pain`, `firstExperiment`, `whyNow`, `whyMe`
  - JSONで **Concept Brief + 最初の3アクション** を生成
- `POST /api/transcribe`
  - 入力: `FormData(audio)`
  - Whisperで日本語文字起こし
- `GET/POST /api/generations`
  - Concept Brief + 実行プランの保存・取得
- `GET /api/archive/insights`
  - Roadmap/Identity用の履歴・集計データを取得
- `GET/POST /api/ghost-settings`
  - My Taboo、スタンスメモ、NGワード、Identity補助情報を保存
- `POST /api/persona/analyze`
  - 実行メモやMy TabooからIdentityを再分析
- `GET /api/credits`
  - 生成クレジット・日次上限・プラン能力を取得
- `POST /api/stripe/checkout`, `POST /api/stripe/portal`, `POST /api/stripe/webhook`
  - Stripe Checkout、Customer Portal、サブスクリプションWebhook

## 現在の生成フロー

1. `/lab` で自由メモ（Scrap）を入力
2. AIが解像度シートへ仮整理
3. 作戦の目的（探索 / 構築 / 研磨 / 伝達）と検証の型を選ぶ
4. `Concept Brief` と `最初の3アクション` を生成
5. `/roadmap` へ展開し、実行チェックとコンセプト実行メモを残す
6. 必要に応じて `/identity` に還流し、自分の軸を更新

## 実装メモ

- Concept Brief はAPIレスポンス・フロント型・`generation_series.concept_brief` 正規カラムに追加済み
- 旧データ互換のため、過去に `generation_series.advice_hint` へ埋め込んだ Concept Brief も復元可能
- Pivot系の `hypotheses.output_content.concept_brief` にも対応
- 旧 `vault_logs` は互換テーブルとして残し、新規コード向けに `concept_run_logs` ビューを用意
- `/vault` は画面として廃止し、履歴・実行管理は `/roadmap` に集約
