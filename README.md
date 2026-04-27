# Nokori

Nokori の初期開発環境です。Next.js App Router + TypeScript をベースに、Supabase CLI のローカル開発を前提にしています。

## セットアップ

1. 依存関係をインストールします。

```bash
npm install
```

2. 環境変数を作成します。

```bash
copy .env.example .env
```

3. Supabase CLI でローカル環境を初期化します。

```bash
supabase init
supabase start
```

4. Supabase のローカル URL / anon key / service role key を確認し、`.env` に設定します。

```bash
supabase status
```

5. アプリを起動します。

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いて動作確認してください。

## Docker 起動（アプリのみ）

```bash
docker compose up --build
```
