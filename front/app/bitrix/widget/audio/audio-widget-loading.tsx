export function AudioWidgetLoading() {
  return (
    <main className="h-full p-2 text-slate-900 sm:p-3">
      <div className="mx-auto w-full rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        </div>
        <p className="mt-3 text-xs text-slate-500">Carregando...</p>
      </div>
    </main>
  )
}
