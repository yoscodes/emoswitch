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
   - 課金を有効にする場合は Stripe 関連キー（`/.env.example` 参照）
4. 開発サーバー起動
   ```bash
   npm run dev
   ```

## 本番環境変数

Vercel などの本番環境には、`.env.example` をチェックリストとして以下を設定します。実値を `.env.example` やGitにコミットしないでください。

### 必須

- `NEXT_PUBLIC_APP_URL`
  - 本番URL。Stripe Checkout / Portal の戻り先に使います。
- `NEXT_PUBLIC_SUPPORT_EMAIL`
  - 問い合わせ、返金/解約、アカウント削除依頼の連絡先として表示します。
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
  - Gemini生成で利用します。
- `OPENAI_API_KEY`
  - `/api/transcribe` のWhisper文字起こしで利用します。

### 課金を有効にする場合

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_UNLIMITED_MONTHLY`
- `STRIPE_PRICE_UNLIMITED_YEARLY`
- `BILLING_UNLIMITED_MONTHLY_ALLOWANCE_CREDITS`
  - 未設定時は `3000`。
- `BILLING_UNLIMITED_UPGRADE_PRORATION_CREDITS`
  - 未設定時は `500`。

`STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_YEARLY` は旧名称の互換フォールバックです。新規設定では `STRIPE_PRICE_UNLIMITED_*` を使ってください。

### 任意

- `NEXT_PUBLIC_STRIPE_CHECKOUT_TOPUP_20`
  - 追加クレジット用のStripe Payment Link。未設定の場合、追加購入ボタンは無効化されます。
- `STRIPE_HEALTHCHECK_REQUIRED`
  - 本番でStripe課金を必須監視対象にする場合は `1`。
- `HEALTHCHECK_TOKEN`
  - 設定すると `/api/health` の確認にトークンが必要になります。

## リリース運用

- CI: `.github/workflows/ci.yml`
  - Pull Request と `main` / `master` へのpushで `npm ci`、`npm run lint`、`npm test`、`npm run build` を実行します。
- ヘルスチェック: `GET /api/health`
  - 監視サービスから死活監視できます。詳細は `docs/monitoring.md` を参照してください。
- Stripe本番E2E:
  - Checkout、Webhook、Customer Portal、クレジット付与の確認手順は `docs/stripe-production-e2e.md` を参照してください。

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
  - ログイン必須
- `POST /api/hypothesis-canvas`
  - 入力: `draft`, `usagePurpose`, `emotion`, `intensity`, `personaKeywords`, `personaSummary`
  - 生成前の一行要約、プレビュータイトル、Identity一致率、逆質問を返す
  - ログイン必須
- `POST /api/generate-triple`
  - 入力: `draft`, `usagePurpose`, `strategyGoal`, `emotion`, `intensity`, `ngWords`, `audience`, `pain`, `firstExperiment`, `whyNow`, `whyMe`
  - JSONで **Concept Brief + 最初の3アクション** を生成
  - ログイン必須
- `POST /api/transcribe`
  - 入力: `FormData(audio)`
  - Whisperで日本語文字起こし
  - ログイン必須
- `GET/POST /api/generations`
  - Concept Brief + 実行プランの保存・取得
  - 保存・削除はログイン必須
- `GET /api/archive/insights`
  - Roadmap/Identity用の履歴・集計データを取得
- `GET/PUT /api/ghost-settings`
  - My Taboo、スタンスメモ、NGワード、Identity補助情報を保存
  - 保存はログイン必須
- `POST /api/persona/analyze`
  - 実行メモやMy TabooからIdentityを再分析
  - ログイン必須
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
