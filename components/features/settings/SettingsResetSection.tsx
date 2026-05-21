"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getErrorMessageFromResponseBody } from "@/lib/logic/api-response-parsing";

const REQUIRED_RESET_TEXT = "RESET";

/**
 * 「データ初期化」セクション。
 *
 * 履歴全削除 → オンボーディングへ戻すフロー。誤操作を防ぐため、確認テキスト一致
 * + ブラウザ confirm の二段階で API を叩く。視覚的に危険操作とわかるよう赤系で囲む。
 */
export function SettingsResetSection() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleResetData = async () => {
    setErrorMessage("");
    if (confirmText !== REQUIRED_RESET_TEXT) {
      setErrorMessage(`確認テキスト「${REQUIRED_RESET_TEXT}」を入力してください。`);
      return;
    }

    const isConfirmed = window.confirm("全取引データを削除し、初期設定に戻します。実行しますか？");
    if (!isConfirmed) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch("/api/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText }),
      });
      const body: unknown = await response.json();
      const apiErrorMessage = getErrorMessageFromResponseBody(body);
      if (!response.ok || apiErrorMessage) {
        setErrorMessage(
          apiErrorMessage ?? "データを初期化できませんでした。通信状況を確認し、もう一度お試しください。",
        );
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setErrorMessage("通信に失敗しました。ネットワークを確認して再試行してください。");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-base font-semibold text-red-900">データ初期化</h2>
      <p className="text-sm text-red-800">
        取引履歴を全削除し、初期設定からやり直す状態に戻します。確認のため「{REQUIRED_RESET_TEXT}」を入力してください。
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
        className="min-h-11 w-full rounded-md border border-red-300 px-3 py-2.5 text-base sm:text-sm"
        placeholder={REQUIRED_RESET_TEXT}
      />
      {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
      <button
        type="button"
        onClick={handleResetData}
        disabled={isResetting}
        className="min-h-11 rounded-md border border-red-400 bg-white px-4 py-2.5 text-sm font-medium text-red-800 disabled:opacity-60"
      >
        {isResetting ? "初期化中..." : "データを初期化する"}
      </button>
    </section>
  );
}
