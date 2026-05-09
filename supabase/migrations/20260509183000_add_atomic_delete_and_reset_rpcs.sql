CREATE OR REPLACE FUNCTION public.delete_own_transaction_and_restore_savings(
  p_transaction_id UUID
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  authenticated_user_id UUID;
  target_transaction public.transactions;
BEGIN
  authenticated_user_id := auth.uid();

  IF authenticated_user_id IS NULL THEN
    RAISE EXCEPTION '認証情報を確認できません。再度ログインしてください。';
  END IF;

  SELECT *
  INTO target_transaction
  FROM public.transactions
  WHERE id = p_transaction_id
    AND user_id = authenticated_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF target_transaction.type = 'SPECIAL'::public.transaction_type THEN
    UPDATE public.profiles
      SET current_total_savings = current_total_savings + target_transaction.amount
    WHERE id = authenticated_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'プロフィールが見つかりません。初期設定を完了してください。';
    END IF;
  END IF;

  DELETE FROM public.transactions
  WHERE id = target_transaction.id
    AND user_id = authenticated_user_id
  RETURNING * INTO target_transaction;

  RETURN target_transaction;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_own_data_atomic()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  authenticated_user_id UUID;
  deleted_transaction_count INTEGER;
BEGIN
  authenticated_user_id := auth.uid();

  IF authenticated_user_id IS NULL THEN
    RAISE EXCEPTION '認証情報を確認できません。再度ログインしてください。';
  END IF;

  DELETE FROM public.transactions
  WHERE user_id = authenticated_user_id;
  GET DIAGNOSTICS deleted_transaction_count = ROW_COUNT;

  DELETE FROM public.profiles
  WHERE id = authenticated_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'プロフィールが見つかりません。初期設定を完了してください。';
  END IF;

  RETURN deleted_transaction_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_transaction_and_restore_savings(UUID)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reset_own_data_atomic()
TO authenticated, service_role;
