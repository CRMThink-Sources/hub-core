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

const THINKZAP_THEME_CLASS = 'theme-thinkzap'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

// banner de assinatura - revisar depois
// function getSubscriptionStatusBanner(
//   hasSubscription: boolean,
//   t: (key: string) => string,
//   subscriptionStatus?: string,
// ): { text: string; className: string } {
//   if (!hasSubscription) {
//     return {
//       text: t('banner.semAssinatura'),
//       className: 'border-amber-200 bg-amber-50 text-amber-700',
//     }
//   }
//
//   if (subscriptionStatus === 'CANCELLED') {
//     return {
//       text: t('banner.cancelada'),
//       className: 'border-red-200 bg-red-50 text-red-700',
//     }
//   }
//
//   if (subscriptionStatus === 'TRIALING') {
//     return {
//       text: t('banner.trial'),
//       className: 'border-blue-200 bg-blue-50 text-blue-700',
//     }
//   }
//
//   if (subscriptionStatus === 'PAST_DUE') {
//     return {
//       text: t('banner.pastDue'),
//       className: 'border-amber-200 bg-amber-50 text-amber-700',
//     }
//   }
//
//   return {
//     text: t('banner.ativa'),
//     className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
//   }
// }

function ThinkzapContent({ children }: { children: React.ReactNode }) {
  const { t: tCommon } = useTranslation('common')
  // banner de assinatura - revisar depois
  // const { t: tGeneral } = useTranslation('thinkzap/general')
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
      if (link.href === '/thinkzap/permissoes') return canManageAccess
      if (link.href === '/thinkzap/conexoes') {
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

  // banner de assinatura - revisar depois
  // const hasSubscription = session?.subscription != null
  // const subscriptionStatus = session?.subscription?.status as string | undefined
  // const statusBanner = getSubscriptionStatusBanner(
  //   hasSubscription,
  //   tGeneral,
  //   subscriptionStatus,
  // )

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
          <>
            {/* banner de assinatura - revisar depois
            <div className="mx-auto w-full max-w-6xl px-4 pb-0 pt-4 sm:px-6 lg:px-8">
              <p
                className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-medium ${statusBanner.className}`}
              >
                {statusBanner.text}
              </p>
            </div>
            */}
            {accessBlocked ? <AccessDeniedPanel /> : children}
          </>
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
