'use client'

import { LogsView } from '@/components/layouts/shared/logs/logs-view'
import { useLogsClient } from '@/components/layouts/shared/logs/use-logs-client'
import { axiosThinkanalise } from '../_lib/thinkanalise-client'

export default function ThinkanaliseLogsPage() {
  const state = useLogsClient(() => axiosThinkanalise())

  if (state.status === 'loading') return null
  if (state.status === 'unauthenticated') {
    return (
      <p className="text-sm text-muted-foreground">
        Sessão expirada. Entre novamente.
      </p>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <LogsView client={state.client} basePath="/thinkanalise" />
    </div>
  )
}
