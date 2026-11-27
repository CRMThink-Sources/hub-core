'use client'

import { useTranslation } from 'react-i18next'
import { InboxIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SendsLoading() {
  const { t } = useTranslation('thinkzap/envios')
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-border bg-background p-6 text-sm text-muted-foreground"
    >
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      {t('states.loading')}
    </div>
  )
}

export function SendsEmpty() {
  const { t } = useTranslation('thinkzap/envios')
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-background p-10 text-center">
      <InboxIcon className="size-8 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-medium text-foreground">
        {t('states.emptyTitle')}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t('states.emptyDescription')}
      </p>
    </div>
  )
}

export function SendsError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('thinkzap/envios')
  return (
    <div
      role="alert"
      className="rounded-lg border border-border bg-background p-6"
    >
      <h2 className="text-base font-medium text-foreground">
        {t('states.errorTitle')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('states.errorDescription')}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={onRetry}
      >
        {t('states.retry')}
      </Button>
    </div>
  )
}

export function SendsSessionExpired() {
  const { t } = useTranslation('thinkzap/envios')
  return (
    <p className="text-sm text-muted-foreground">
      {t('states.sessionExpired')}
    </p>
  )
}
