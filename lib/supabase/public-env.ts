type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
};

/**
 * ブラウザ・サーバー共通で使う公開環境変数。
 * `SUPABASE_SERVICE_ROLE_KEY` はバイパス用のためここでは扱わない。
 * 通常のユーザー CRUD には anon キー＋RLS 経由のユーザーセッションのみを使う。
 */
export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof url !== "string" || url.length === 0) {
    throw new Error("環境変数 NEXT_PUBLIC_SUPABASE_URL が設定されていません。");
  }

  if (typeof anonKey !== "string" || anonKey.length === 0) {
    throw new Error(
      "環境変数 NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。",
    );
  }

  return { url, anonKey };
}
