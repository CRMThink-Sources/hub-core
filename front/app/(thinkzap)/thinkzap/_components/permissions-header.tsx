'use client'

import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function PermissionsHeader() {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t('pageTitle')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t('pageDescription')}
          </p>
        </div>
      </div>
    </div>
  )
}
