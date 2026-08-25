'use client'

import { Aside } from '@/components/layouts/shared/aside/aside'
import { GPTMAKER_ASIDE_CONFIG } from '@/components/layouts/shared/aside/gptmaker-aside-config'
import { SessionProvider } from '@/providers/session-provider'
import { AplicationProvider } from '@/providers/aplication-provider'
import { APP_CODES } from '@/shared/app/app-codes'
import { Montserrat } from 'next/font/google'
import { setLocale } from '@/i18n/provider'
import { useEffect } from 'react'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

function GptMakerContent({ children }: { children: React.ReactNode }) {
  function handleLanguageChange(code: string) {
    setLocale(code)
    window.sessionStorage.setItem('locale', code)
  }

  useEffect(() => {
    const locale = window.sessionStorage.getItem('locale')
    if (locale) setLocale(locale)
  }, [])

  return (
    <div
      className={`${montSerrat.variable} flex min-h-screen w-full`}
      style={{ fontFamily: 'var(--font-montserrat)' }}
    >
      <Aside
        {...GPTMAKER_ASIDE_CONFIG}
        onLanguageChange={handleLanguageChange}
      />
      <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
        {children}
      </main>
    </div>
  )
}

/**
 * Sem provider de permissões: a fatia 1 não tem tela de acesso por
 * usuário/departamento. Quem instala o app usa tudo.
 */
export default function GptMakerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AplicationProvider appCode={APP_CODES.gptmaker}>
      <SessionProvider appCode={APP_CODES.gptmaker}>
        <GptMakerContent>{children}</GptMakerContent>
      </SessionProvider>
    </AplicationProvider>
  )
}
