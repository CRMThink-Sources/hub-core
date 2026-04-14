'use client'

import { Aside } from '@/components/layouts/shared/aside/aside'
import { THINKZAP_ASIDE_CONFIG } from '@/components/layouts/shared/aside/thinkzap-aside-config'
import { SessionProvider, useSession } from '@/providers/session-provider'
import { envConfig } from '@/shared/infra/env-config'
import { Montserrat } from 'next/font/google'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

function ThinkzapContent({ children }: { children: React.ReactNode }) {
  const { isFetching } = useSession()

  return (
    <div
      className={montSerrat.variable + ' row'}
      style={{ fontFamily: 'var(--font-montserrat)' }}
    >
      <Aside {...THINKZAP_ASIDE_CONFIG} />
      {isFetching ? (
        <div className="flex flex-1 min-h-screen items-center justify-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
          <span className="animate-pulse text-sm font-medium text-slate-600">
            Carregando...
          </span>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export default function ThinkzapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider appCode={envConfig.appCodes.thinkzap}>
      <ThinkzapContent>{children}</ThinkzapContent>
    </SessionProvider>
  )
}
