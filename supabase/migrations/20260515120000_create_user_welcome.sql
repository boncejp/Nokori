-- 初回ウェルカム完了の永続化（profiles 行がまだ無い段階でも記録できる専用テーブル）

CREATE TABLE public.user_welcome (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_welcome IS '初回ウェルカム完了。未完了は行なし、完了で INSERT/UPSERT。design.md §3.2.1。';

ALTER TABLE public.user_welcome ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_user_welcome_only ON public.user_welcome
  FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

GRANT ALL ON TABLE public.user_welcome TO anon, authenticated, service_role;
