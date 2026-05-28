'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePortalSession } from '@/providers/portal-session-provider'

export function AdminHomeContent() {
  const { t } = useTranslation('admin/home')
  const { session } = usePortalSession()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('greeting', { name: session?.name ?? '' })}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('description')}</p>
      </div>

      <div className="admin-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">
            {t('featureClients')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('clientsCardDescription')}
          </p>
        </div>
        <Link
          href="/admin/clientes"
          className={cn(buttonVariants(), 'min-h-11 shrink-0')}
        >
          {t('clientsCardAction')}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="admin-card p-6">
        <h2 className="text-lg font-medium text-foreground">
          {t('comingSoonTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('comingSoonDescription')}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>• {t('featureApps')}</li>
          <li>• {t('featureSubscriptions')}</li>
        </ul>
      </div>
    </div>
  )
}
