'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'

type Props = {
  hasSubscription: boolean
  subscriptionStatus?: string
}

export function ConexoesHeaderCard({
  hasSubscription,
  subscriptionStatus,
}: Props) {
  const { t } = useTranslation('thinkzap/conexoes/header-card')
  const isCancelled = subscriptionStatus === 'CANCELLED'

  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-fit">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <h2 className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</h2>
      </div>

      <div className="flex w-full flex-wrap justify-end gap-2">
        {!hasSubscription && (
          <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">
            <Link
              className={buttonVariants({
                size: 'lg',
                className: 'w-full sm:w-auto',
              })}
              href="/thinkzap/financeiro"
            >
              {t('ativarTrial')}
            </Link>
          </div>
        )}

        {hasSubscription && (
          <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">
            <Link
              className={buttonVariants({
                size: 'lg',
                className: 'w-full sm:w-auto',
              })}
              href="/thinkzap/financeiro"
            >
              {isCancelled ? t('reativarAssinatura') : t('contratarLinha')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
