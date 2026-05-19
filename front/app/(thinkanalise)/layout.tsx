'use client'

import { SessionProvider } from '@/providers/session-provider'
import { envConfig } from '@/shared/infra/env-config'
import { Montserrat } from 'next/font/google'
import { Aside } from '@/components/layouts/shared/aside/aside'
import { THINKHUB_ASIDE_CONFIG } from '@/components/layouts/shared/aside/thinkhub-aside-config'
import { setLocale } from '@/i18n/provider'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

export default function ThinkAnaliseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  function handleLanguageChange(code: string) {
    setLocale(code)
  }
  return (
    <SessionProvider appCode={envConfig.appCodes.thinkanalise}>
      <div
        className={`${montSerrat.variable} flex min-h-screen w-full`}
        style={{ fontFamily: 'var(--font-montserrat)' }}
      >
        <Aside
          {...THINKHUB_ASIDE_CONFIG}
          onLanguageChange={handleLanguageChange}
        />
        <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
