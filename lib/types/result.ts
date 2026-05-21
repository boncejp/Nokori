/**
 * 非同期処理・バリデーションの共通結果型（.cursorrules §5）。
 * API Route や Supabase 層でも同じ形を使い、成功/失敗の分岐を統一する。
 */

export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/** リクエストボディのパース結果（ユーザー向けメッセージ付き） */
export type ValidationResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly errorMessage: string };
