-- Nokori initial schema (docs/design.md §2)
-- Prisma は使用しない。マイグレーションはこのディレクトリのみで管理する。
-- サービスロールキーは RLS を迂回するため、通常のユーザー CRUD には使わない設計とする。

-- ── enums ────────────────────────────────────────────────────────────────────

CREATE TYPE public.payday_rule AS ENUM ('BEFORE', 'AFTER', 'FIXED');

CREATE TYPE public.surplus_mode AS ENUM ('STRICT', 'YUTORI');

CREATE TYPE public.transaction_type AS ENUM ('NORMAL', 'SPECIAL');

CREATE TYPE public.utility_type AS ENUM ('ELECTRICITY', 'GAS', 'WATER');

-- ── profiles ──────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  target_amount INTEGER NOT NULL,
  target_date DATE NOT NULL,
  payday INTEGER NOT NULL CHECK (payday >= 1 AND payday <= 31),
  payday_rule public.payday_rule NOT NULL,
  monthly_income INTEGER NOT NULL,
  fixed_costs INTEGER NOT NULL,
  estimated_electricity INTEGER NOT NULL,
  estimated_gas INTEGER NOT NULL,
  estimated_water INTEGER NOT NULL,
  current_total_savings INTEGER NOT NULL,
  surplus_mode public.surplus_mode NOT NULL,
  initial_budget INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'ユーザー設定（design.md §2.1）。id は auth.users.id と一致。';

-- ── transactions ───────────────────────────────────────────────────────────────

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  memo TEXT,
  type public.transaction_type NOT NULL,
  utility_type public.utility_type,
  logical_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  CONSTRAINT transactions_special_no_utility CHECK (
    NOT (
      type = 'SPECIAL'::public.transaction_type
      AND utility_type IS NOT NULL
    )
  )
);

COMMENT ON TABLE public.transactions IS '支出履歴（design.md §2.2）。logical_date はアプリ層で 27:00 ルール適用後に設定。';

COMMENT ON CONSTRAINT transactions_special_no_utility ON public.transactions IS
  'SPECIAL と光熱費種別の同時指定は禁止（design.md §2.2）。';

CREATE INDEX transactions_user_id_logical_date_idx ON public.transactions (user_id, logical_date DESC);

-- ── updated_at（profiles）─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profiles_updated_at ();

-- ── RLS（design.md §2.3）──────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_profile_only ON public.profiles
  FOR ALL
  USING (id = auth.uid ())
  WITH CHECK (id = auth.uid ());

CREATE POLICY own_transactions_only ON public.transactions
  FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

-- ── grants（PostgREST / Supabase クライアント経由の authenticated 利用）────────

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.transactions TO anon, authenticated, service_role;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
