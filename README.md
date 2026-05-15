# Nokori

Nokori の初期開発環境です。Next.js App Router + TypeScript をベースに、**アプリのランタイム接続先はクラウド上の Supabase プロジェクトを主**とします（Google OAuth 等の検証の都合）。スキーマはリポジトリの `supabase/migrations` で管理し、**Supabase CLI** でクラウドへ反映したり型を生成したりします。CLI は「ローカル DB を必ず起動する」ためのものではありません。

本番ホスティングは **Vercel を第一選択**と想定しています（デプロイ・OAuth の詳細は `docs/design.md`）。

## 前提ツール

- [Node.js](https://nodejs.org/)（プロジェクトの推奨版に合わせる）
- [Supabase CLI](https://supabase.com/docs/guides/cli)（マイグレーション適用・型生成・任意でローカル DB）

## セットアップ

1. 依存関係をインストールします。**パッケージマネージャは npm（`package-lock.json`）のみ**とし、`pnpm-lock.yaml` はコミットしません。

```bash
npm install
```

2. [Supabase](https://supabase.com/) で**クラウド上にプロジェクト**を作成します。

3. 環境変数ファイルを用意します（変数名はリポジトリの `.env.example` と一致させます）。

```bash
copy .env.example .env
```

4. 各変数の**意味と取得元**は `docs/design.md` の **§3.3.1（環境変数一覧）** に従って `.env` に設定します。本番・プレビューでは Vercel の **Project Settings → Environment Variables** に同じ名前で登録します。**GitHub の Issue・PR・コミットに実キーや本番 URL を書かないでください。**

5. **Google OAuth** を使う場合は、Supabase 側で Google プロバイダを有効化し、**Authentication → URL Configuration** で Site URL / Redirect URLs、および Google Cloud Console の OAuth クライアント設定を整えます。具体例とハマりどころは `docs/design.md` の「認証・OAuth 運用メモ」を参照してください。

6. リポジトリに `supabase/` が含まれていることを確認し、未初期化の場合のみ次を実行します。

```bash
supabase init
```

7. CLI からクラウドプロジェクトに接続します（初回・プロジェクト変更時）。

```bash
supabase login
supabase link
```

   `supabase link` はダッシュボードの **Project Settings → General → Reference ID** を聞かれたら入力します。

8. `supabase/migrations` の SQL を**クラウド DB**に反映します（初回およびマイグレーション追加後）。

```bash
supabase db push
```

   チームで「マイグレーションは CI や別経路のみ」など CLI を使わない運用にする場合は、その手順に従ってください。**SQL Editor にマイグレーション内容を手で貼る運用は、取り違えやすく非推奨**です（どうしても行う場合はファイルと差分を必ず照合する）。

9. TypeScript 型を生成します（スキーマ変更のたびに再実行。`supabase link` 済みであること）。

```bash
npm run gen:types
```

生成先は `lib/types/database.ts` です。リンクしていない場合やローカル DB のスキーマだけから型を出したい場合は、公式ドキュメントに従い `supabase gen types typescript --local` などを直接実行してください（その場合は `supabase start` が必要）。

10. アプリを起動します。

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いて動作確認してください。

## ローカル Supabase を使う場合（任意）

OAuth を除く検証など、**Docker でローカル Postgres を立てる**場合のみ `supabase start` を使います。API の URL とキーは次で確認できます。

```bash
supabase status
```

マイグレーションの適用は `supabase db reset`（ローカル DB をリセットしてマイグレーションから再構築）が便利です。`.env` の URL / キーをローカル用に差し替えてください。

## Docker 起動（アプリのみ）

```bash
docker compose up --build
```
