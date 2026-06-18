'use client'

import { useEffect } from 'react'
import { SessionProvider } from '@/providers/session-provider'
import { envConfig } from '@/shared/infra/env-config'
import { Montserrat } from 'next/font/google'
import { Aside } from '@/components/layouts/shared/aside/aside'
import { CLICKSIGN_ASIDE_CONFIG } from '@/components/layouts/shared/aside/clicksign-aside-config'
import { setLocale } from '@/i18n/provider'

const CLICKSIGN_THEME_CLASS = 'theme-clicksign'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

export default function ClickSignLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    document.body.classList.add(CLICKSIGN_THEME_CLASS)
    return () => document.body.classList.remove(CLICKSIGN_THEME_CLASS)
  }, [])

  function handleLanguageChange(code: string) {
    setLocale(code)
  }
  return (
    <SessionProvider appCode={envConfig.appCodes.clicksign}>
      <div
        className={`${CLICKSIGN_THEME_CLASS} ${montSerrat.variable} flex min-h-screen w-full`}
        style={{ fontFamily: 'var(--font-montserrat)' }}
      >
        <Aside
          {...CLICKSIGN_ASIDE_CONFIG}
          onLanguageChange={handleLanguageChange}
        />
        <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
