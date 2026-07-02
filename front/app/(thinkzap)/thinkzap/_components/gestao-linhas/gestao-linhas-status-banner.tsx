'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'

type Props = {
  isTrial: boolean
  isCancelled: boolean
  hasSubscription: boolean
}

export function GestaoLinhasStatusBanner({
  isTrial,
  isCancelled,
  hasSubscription,
}: Props) {
  const { t } = useTranslation('thinkzap/gestao-linhas/status-banner')

  if (isTrial) {
    return null
  }

  if (!hasSubscription) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <p>{t('semAssinatura')}</p>
          <Link href="/thinkzap/ativar-trial" className={buttonVariants()}>
            {t('ativarTrial')}
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">{t('aposTrialInfo')}</p>
      </div>
    )
  }

  if (isCancelled) {
    return (
      <div>
        <p>{t('cancelada')}</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{t('titulo')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitulo')}</p>
    </div>
  )
}
