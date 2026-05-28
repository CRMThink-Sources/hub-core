'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AdminClientImbotSection } from './admin-client-imbot-section'

type Props = {
  domainId: string
  appId: string
}

export function AdminAppSettingsPage({ domainId, appId }: Props) {
  const { t } = useTranslation('admin/app-settings')

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/clientes/${domainId}`}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'min-h-11',
        )}
      >
        <ArrowLeft className="size-4" />
        {t('back')}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('description')}</p>
      </div>

      <AdminClientImbotSection appId={appId} />
    </div>
  )
}
