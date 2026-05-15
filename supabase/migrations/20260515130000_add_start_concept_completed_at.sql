-- オンボーディング直後の「コンセプト詳細」画面（/start）の一度きり完了記録。
-- profiles 行が既にある段階のため専用テーブルは設けず、nullable 時刻で十分。

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS start_concept_completed_at timestamptz NULL;

COMMENT ON COLUMN public.profiles.start_concept_completed_at IS
'初回コンセプト画面の完了時刻。NULL のあいだはメインアプリへ入る前に /start へ誘導する。';
