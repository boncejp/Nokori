ALTER TABLE public.profiles
ADD COLUMN target_duration_months INTEGER,
ADD COLUMN target_anchor_logical_date DATE;

WITH profile_logical_dates AS (
  SELECT
    id,
    CASE
      WHEN EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Tokyo')) < 3
        THEN ((created_at AT TIME ZONE 'Asia/Tokyo')::date - INTERVAL '1 day')::date
      ELSE (created_at AT TIME ZONE 'Asia/Tokyo')::date
    END AS logical_created_date
  FROM public.profiles
)
UPDATE public.profiles AS p
SET
  target_anchor_logical_date = COALESCE(p.target_anchor_logical_date, d.logical_created_date),
  target_duration_months = COALESCE(
    p.target_duration_months,
    GREATEST(
      1,
      (
        (EXTRACT(YEAR FROM age(p.target_date, d.logical_created_date))::INTEGER * 12)
        + EXTRACT(MONTH FROM age(p.target_date, d.logical_created_date))::INTEGER
      )
    )
  )
FROM profile_logical_dates AS d
WHERE p.id = d.id;

ALTER TABLE public.profiles
ALTER COLUMN target_duration_months SET NOT NULL,
ALTER COLUMN target_anchor_logical_date SET NOT NULL;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_target_duration_months_check
CHECK (target_duration_months >= 1 AND target_duration_months <= 251);
