-- オンボーディング時点の「現在の全財産」（design.md §2.1）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS initial_total_assets INTEGER;

UPDATE public.profiles
SET
  initial_total_assets = current_total_savings + initial_budget
WHERE
  initial_total_assets IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN initial_total_assets SET NOT NULL;
