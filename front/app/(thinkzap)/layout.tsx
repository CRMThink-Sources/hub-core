'use client'

import { Toaster } from 'sonner'
import { Aside } from '@/components/layouts/shared/aside/aside'
import { THINKZAP_ASIDE_CONFIG } from '@/components/layouts/shared/aside/thinkzap-aside-config'
import { SessionProvider, useSession } from '@/providers/session-provider'
import { envConfig } from '@/shared/infra/env-config'
import { Montserrat } from 'next/font/google'
import { i18n } from '@/i18n/provider'
import { LOCALE_COOKIE } from '@/i18n/config'
import { useTranslation } from 'react-i18next'

const montSerrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
})

function getSubscriptionStatusBanner(
  hasSubscription: boolean,
  t: (key: string) => string,
  subscriptionStatus?: string,
): { text: string; className: string } {
  if (!hasSubscription) {
    return {
      text: t('banner.semAssinatura'),
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  if (subscriptionStatus === 'CANCELLED') {
    return {
      text: t('banner.cancelada'),
      className: 'border-red-200 bg-red-50 text-red-700',
    }
  }

  if (subscriptionStatus === 'TRIALING') {
    return {
      text: t('banner.trial'),
      className: 'border-blue-200 bg-blue-50 text-blue-700',
    }
  }

  if (subscriptionStatus === 'PAST_DUE') {
    return {
      text: t('banner.pastDue'),
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  return {
    text: t('banner.ativa'),
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
}

function ThinkzapContent({ children }: { children: React.ReactNode }) {
  const { t: tCommon } = useTranslation('common')
  const { t: tGeneral } = useTranslation('thinkzap/general')
  const { isFetching, session } = useSession()
  const hasSubscription = session?.subscription != null
  const subscriptionStatus = session?.subscription?.status as string | undefined
  const statusBanner = getSubscriptionStatusBanner(
    hasSubscription,
    tGeneral,
    subscriptionStatus,
  )

  function handleLanguageChange(code: string) {
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000`
    void i18n.changeLanguage(code)
  }

  return (
    <div
      className={`${montSerrat.variable} min-h-screen min-w-0 w-full`}
      style={{ fontFamily: 'var(--font-montserrat)' }}
    >
      <Aside
        {...THINKZAP_ASIDE_CONFIG}
        onLanguageChange={handleLanguageChange}
      />
      {/* Aside é fixed: padding reserva a faixa da sidebar sem somar 100vw + margin (evita scroll horizontal). */}
      <div className="box-border min-h-screen min-w-0 w-full pl-64">
        <Toaster richColors position="top-center" closeButton />
        {isFetching ? (
          <div className="flex min-h-[50vh] items-center justify-center gap-2 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
            <span className="animate-pulse text-sm font-medium text-slate-600">
              {tCommon('carregando')}
            </span>
          </div>
        ) : (
          <>
            <div className="mx-auto w-full max-w-6xl px-4 pb-0 pt-4 sm:px-6 lg:px-8">
              <p
                className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-medium ${statusBanner.className}`}
              >
                {statusBanner.text}
              </p>
            </div>
            {children}
          </>
        )}
      </div>
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
