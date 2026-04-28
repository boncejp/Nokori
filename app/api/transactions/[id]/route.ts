import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteOwnTransactionById } from "@/lib/supabase/transactions";

type RouteContext = {
  readonly params: Promise<{
    readonly id: string;
  }>;
};

function isUuid(value: string): boolean {
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_PATTERN.test(value);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { errorMessage: "ログインが必要です。再度ログインしてください。" },
      { status: 401 },
    );
  }

  const params = await context.params;
  const transactionId = params.id;
  if (!isUuid(transactionId)) {
    return NextResponse.json(
      { errorMessage: "取引IDの形式が不正です。URLを確認してください。" },
      { status: 400 },
    );
  }

  const deleteResult = await deleteOwnTransactionById(supabase, transactionId);
  if (!deleteResult.success) {
    return NextResponse.json(
      { errorMessage: "削除に失敗しました。時間をおいて再試行してください。" },
      { status: 500 },
    );
  }
  if (deleteResult.data === null) {
    return NextResponse.json(
      { errorMessage: "対象の取引が見つかりませんでした。" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    transaction: deleteResult.data,
  });
}
