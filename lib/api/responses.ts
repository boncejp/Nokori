/**
 * API Route の JSON レスポンスを統一する小さなヘルパー。
 *
 * 目的:
 * - エラーメッセージのキーを `errorMessage` に統一して、クライアント側のパーサーを一本化する。
 * - ステータスコードを呼び出し側で揃えやすくする。
 *
 * 注意:
 * - ユーザー向けメッセージは必ず日本語で「原因」と「次にとる行動」を含める（.cursorrules §9）。
 */

import { NextResponse } from "next/server";

/** クライアントが共通でパースする失敗レスポンス。 */
export function apiErrorResponse(errorMessage: string, status: number): NextResponse {
  return NextResponse.json({ errorMessage }, { status });
}

/** 認証エラー（401）の共通レスポンス。 */
export function apiUnauthorizedResponse(): NextResponse {
  return apiErrorResponse("ログインが必要です。再度ログインしてください。", 401);
}

/** バリデーション失敗（400）の共通レスポンス。 */
export function apiValidationErrorResponse(errorMessage: string): NextResponse {
  return apiErrorResponse(errorMessage, 400);
}

/** サーバー側エラー（500）の共通レスポンス。 */
export function apiServerErrorResponse(errorMessage: string): NextResponse {
  return apiErrorResponse(errorMessage, 500);
}

/** 既定の成功レスポンス（payload があれば展開してマージ）。 */
export function apiSuccessResponse<T extends Record<string, unknown> | undefined = undefined>(
  payload?: T,
): NextResponse {
  if (typeof payload === "undefined") {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: true, ...payload });
}
