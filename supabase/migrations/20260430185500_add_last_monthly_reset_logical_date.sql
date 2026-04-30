ALTER TABLE public.profiles
ADD COLUMN last_monthly_reset_logical_date DATE;

COMMENT ON COLUMN public.profiles.last_monthly_reset_logical_date IS
  '月次リセットを最後に実行した論理日付（JST/27:00ルール適用後）。冪等性判定専用。';
