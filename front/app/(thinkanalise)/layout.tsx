'use client'

import { SessionProvider } from '@/providers/session-provider'
import { envConfig } from '@/shared/infra/env-config'
import { Montserrat } from 'next/font/google'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

export default function ThinkAnaliseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider appCode={envConfig.appCodes.thinkanalise}>
      <div
        className={montSerrat.variable}
        style={{ fontFamily: 'var(--font-montserrat)' }}
      >
        {children}
      </div>
    </SessionProvider>
  )
}
