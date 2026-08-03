'use client'

import { useEffect } from 'react'
import { SessionProvider } from '@/providers/session-provider'
import { AplicationProvider } from '@/providers/aplication-provider'
import { APP_CODES } from '@/shared/app/app-codes'
import { Montserrat } from 'next/font/google'
import { Aside } from '@/components/layouts/shared/aside/aside'
import { IMPORTSHEET_ASIDE_CONFIG } from '@/components/layouts/shared/aside/importsheet-aside-config'
import { setLocale } from '@/i18n/provider'

const IMPORTSHEET_THEME_CLASS = 'theme-importsheet'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

export default function ImportSheetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    document.body.classList.add(IMPORTSHEET_THEME_CLASS)
    return () => document.body.classList.remove(IMPORTSHEET_THEME_CLASS)
  }, [])

  function handleLanguageChange(code: string) {
    setLocale(code)
  }
  return (
    <AplicationProvider appCode={APP_CODES.importsheet}>
      <SessionProvider appCode={APP_CODES.importsheet}>
        <div
          className={`${IMPORTSHEET_THEME_CLASS} ${montSerrat.variable} flex min-h-screen w-full`}
          style={{ fontFamily: 'var(--font-montserrat)' }}
        >
          <Aside
            {...IMPORTSHEET_ASIDE_CONFIG}
            onLanguageChange={handleLanguageChange}
          />
          <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
            {children}
          </main>
        </div>
      </SessionProvider>
    </AplicationProvider>
  )
}
