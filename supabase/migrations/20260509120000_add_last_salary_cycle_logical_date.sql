ALTER TABLE public.profiles
ADD COLUMN last_salary_cycle_logical_date DATE;

COMMENT ON COLUMN public.profiles.last_salary_cycle_logical_date IS
  '手取り給料をサイクル単位で最後に確認した論理開始日付（サイクルの給料日＝開始日）。';
