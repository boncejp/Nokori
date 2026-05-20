ALTER TABLE public.profiles
ADD COLUMN yutori_carryover INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.yutori_carryover IS
  '通常サイクルのゆとりモード用繰り越し額。前サイクルの余剰金を次サイクル予算に上乗せする額。'
  'STRICTリセット時・初回サイクル締め時は 0 にリセット。'
  'initial_budget は初回サイクル専用となり、通常サイクルでは本カラムを使う。';
