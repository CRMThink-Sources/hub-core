'use client'

import { useLoading } from '@/providers/loading-provider'

export function LoadingOverlay() {
  const { isLoading, loadingMessage } = useLoading()

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <p className="mt-4 text-sm font-medium text-white">{loadingMessage}</p>
    </div>
  )
}
