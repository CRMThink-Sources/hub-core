'use client'

import { Aside } from '@/components/layouts/shared/aside/aside'
import { THINKZAP_ASIDE_CONFIG } from '@/components/layouts/shared/aside/thinkzap-aside-config'
import { SessionProvider } from '@/providers/session-provider'
import { AplicationProvider } from '@/providers/aplication-provider'
import {
  ThinkzapAccessProvider,
  useThinkzapAccessState,
} from '@/providers/thinkzap-access-provider'
import { APP_CODES } from '@/shared/app/app-codes'
import { Montserrat } from 'next/font/google'
import { setLocale } from '@/i18n/provider'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { isBitrixAdmin } from '@/bitrix'
import { AccessDeniedPanel } from './thinkzap/_components/access-denied-panel'
import { envConfig } from '@/shared/infra/env-config'

const THINKZAP_THEME_CLASS = 'theme-thinkzap'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

function ThinkzapContent({ children }: { children: React.ReactNode }) {
  const { t: tCommon } = useTranslation('common')
  const { state: accessState } = useThinkzapAccessState()
  const pathname = usePathname()

  // Só o payload de `ready` decide. Enquanto carrega, `thinkzapAccess` é
  // `undefined` e nada é filtrado nem bloqueado — o render fica no indicador de
  // carregamento abaixo, em vez de piscar conteúdo.
  const thinkzapAccess =
    accessState.status === 'ready' ? accessState.access : undefined

  const canManageAccess =
    thinkzapAccess?.canManageAccess === true || isBitrixAdmin()

  const asideLinks = useMemo(() => {
    return THINKZAP_ASIDE_CONFIG.links.filter(link => {
      if (link.href === '/thinkzap/bots' && !envConfig.thinkbotMenuEnabled) {
        return false
      }
      if (link.href === '/thinkzap/permissoes') return canManageAccess
      if (
        link.href === '/thinkzap' ||
        link.href === '/thinkzap/conexoes' ||
        link.href === '/thinkzap/bots'
      ) {
        return thinkzapAccess?.canAccess === true
      }
      return true
    })
  }, [canManageAccess, thinkzapAccess])

  const accessBlocked = useMemo(() => {
    if (!pathname || !thinkzapAccess) return false
    if (
      (pathname === '/thinkzap' ||
        pathname.startsWith('/thinkzap/conexoes') ||
        pathname.startsWith('/thinkzap/bots') ||
        pathname.startsWith('/thinkzap/connector')) &&
      !thinkzapAccess.canAccess
    ) {
      return true
    }
    /**
     * Sem gate de `canAccessFinance`: as rotas que ele protegia — `/financeiro` e
     * `/ativar-trial` — saíram com a cobrança antiga. A permissão continua existindo
     * e volta a ser lida quando a cobrança nova tiver tela.
     */
    if (pathname.startsWith('/thinkzap/permissoes') && !canManageAccess) {
      return true
    }
    return false
  }, [pathname, thinkzapAccess, canManageAccess])

  function handleLanguageChange(code: string) {
    setLocale(code)
    window.sessionStorage.setItem('locale', code)
  }

  useEffect(() => {
    const locale = window.sessionStorage.getItem('locale')
    if (locale) setLocale(locale)
  }, [])

  useEffect(() => {
    document.body.classList.add(THINKZAP_THEME_CLASS)
    return () => document.body.classList.remove(THINKZAP_THEME_CLASS)
  }, [])

  return (
    <div
      className={`${THINKZAP_THEME_CLASS} ${montSerrat.variable} flex min-h-screen w-full`}
      style={{ fontFamily: 'var(--font-montserrat)' }}
    >
      <Aside
        {...THINKZAP_ASIDE_CONFIG}
        links={asideLinks}
        onLanguageChange={handleLanguageChange}
      />
      <main className="ml-64 w-full flex flex-col bg-white min-h-screen relative">
        {accessState.status === 'loading' ? (
          <div className="flex min-h-[50vh] items-center justify-center gap-2 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <span className="animate-pulse text-sm font-medium text-muted-foreground">
              {tCommon('carregando')}
            </span>
          </div>
        ) : accessState.status === 'error' ||
          accessState.status === 'unauthenticated' ? (
          // Falha de leitura de permissão NÃO libera a tela.
          <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="text-sm font-medium">
              Não foi possível verificar suas permissões
            </p>
            <p className="mt-1 text-sm">
              {accessState.status === 'error'
                ? accessState.message
                : 'Sessão expirada. Reabra a aplicação pelo Bitrix24.'}
            </p>
          </div>
        ) : (
          <>{accessBlocked ? <AccessDeniedPanel /> : children}</>
        )}
      </main>
    </div>
  )
}

export default function ThinkzapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AplicationProvider appCode={APP_CODES.thinkzap}>
      <ThinkzapAccessProvider>
        <SessionProvider appCode={APP_CODES.thinkzap}>
          <ThinkzapContent>{children}</ThinkzapContent>
        </SessionProvider>
      </ThinkzapAccessProvider>
    </AplicationProvider>
  )
}
