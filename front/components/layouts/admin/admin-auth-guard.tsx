'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalSession } from '@/providers/portal-session-provider'
import { useTranslation } from 'react-i18next'

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isFetching } = usePortalSession()
  const router = useRouter()
  const { t } = useTranslation('common')

  useEffect(() => {
    if (!isFetching && !session) {
      router.replace('/admin/login')
    }
  }, [isFetching, session, router])

  if (isFetching) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        {t('carregando')}
      </div>
    )
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}
