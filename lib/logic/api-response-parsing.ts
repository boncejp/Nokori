/**
 * クライアント側で API 応答を `unknown` のまま読むための小さなヘルパー。
 *
 * `as` キャストを避け、ストア・フォーム双方で同じ抽出ロジックを共有する。
 * 不正な JSON が返っても安全に `null` を返すよう設計している。
 */

import { isRecord } from "@/lib/types/object-parsing";

/**
 * API のエラーレスポンス（`{ errorMessage: string, ... }`）から
 * ユーザー表示用のメッセージを取り出す。形式不一致なら `null`。
 */
export function getErrorMessageFromResponseBody(body: unknown): string | null {
  if (!isRecord(body) || !("errorMessage" in body)) {
    return null;
  }
  const errorMessage = body.errorMessage;
  if (typeof errorMessage !== "string") {
    return null;
  }
  return errorMessage;
}
