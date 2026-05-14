export default function AppLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-16 sm:px-6">
      <div
        className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-slate-800"
        aria-hidden
      />
      <p className="text-center text-sm text-zinc-600">読み込み中です。しばらくお待ちください。</p>
    </main>
  );
}
