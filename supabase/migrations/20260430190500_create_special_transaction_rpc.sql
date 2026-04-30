CREATE OR REPLACE FUNCTION public.create_special_transaction_and_decrement_savings(
  p_amount INTEGER,
  p_memo TEXT,
  p_logical_date DATE
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  authenticated_user_id UUID;
  inserted_transaction public.transactions;
BEGIN
  authenticated_user_id := auth.uid();

  IF authenticated_user_id IS NULL THEN
    RAISE EXCEPTION '認証情報を確認できません。再度ログインしてください。';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION '金額は1円以上で入力してください。';
  END IF;

  UPDATE public.profiles
    SET current_total_savings = current_total_savings - p_amount
  WHERE id = authenticated_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'プロフィールが見つかりません。初期設定を完了してください。';
  END IF;

  INSERT INTO public.transactions (
    user_id,
    amount,
    memo,
    type,
    utility_type,
    logical_date
  )
  VALUES (
    authenticated_user_id,
    p_amount,
    p_memo,
    'SPECIAL'::public.transaction_type,
    NULL,
    p_logical_date
  )
  RETURNING * INTO inserted_transaction;

  RETURN inserted_transaction;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_special_transaction_and_decrement_savings(INTEGER, TEXT, DATE)
TO authenticated, service_role;
