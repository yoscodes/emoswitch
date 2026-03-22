# エモ・スイッチ

「書けない」を「刺さる」へ。  
プロンプト不要の、感情変換エンジン。

## 技術スタック

- Next.js 16 (App Router / TypeScript)
- Vercel AI SDK + Gemini 1.5 (Flash / Pro切替)
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
| `/` | LP（デモ枠・「使ってみる」） |
| `/home` | メイン作成（3案＋ハッシュタグ・カメレオンUI・レバー音） |
| `/archive` | 履歴・採用案・いいね記録（現状は localStorage） |
| `/ghost` | マイ・ゴースト（プロフィールURL・NGワード。Vector連携は準備中） |
| `/plans` | 料金プラン（月払い / 年払い 20%OFF・Stripe リンク） |

## 実装済みAPI

- `POST /api/generate`
  - 入力: `draft`, `emotion`, `speedMode`
  - Geminiで1文のSNS向けコピーをストリーミング生成（レガシー）
- `POST /api/generate-triple`
  - 入力: `draft`, `emotion`, `speedMode`, `intensity`, `ngWords`
  - JSONで **3案 + ハッシュタグ**（+ 任意ヒント）を一括生成
- `POST /api/transcribe`
  - 入力: `FormData(audio)`
  - Whisperで日本語文字起こし

## Supabase 拡張メモ

- `pgvector` を有効化して「My Ghost（文体学習）」の埋め込み保存に利用
- 重い処理（トレンド分析や定期学習）は Supabase Edge Functions へ分離
