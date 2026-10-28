'use client'

import Link from 'next/link'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, SearchX } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { findAdminJob, type AdminJobId } from '@/lib/admin-jobs'
import { AdminExpirationJobPage } from './admin-expiration-job-page'
import { AdminStripeSyncJobPage } from './admin-stripe-sync-job-page'
import { AdminEmptyState } from './ui/admin-empty-state'
import { AdminPageHeader } from './ui/admin-page-header'

/** A página de detalhe de cada job do catálogo (`lib/admin-jobs.ts`). */
const ADMIN_JOB_PAGES: Record<AdminJobId, ComponentType> = {
  'expiracao-assinaturas': AdminExpirationJobPage,
  'sincronizacao-stripe': AdminStripeSyncJobPage,
}

export function AdminJobDetailRoute({ jobId }: { jobId: string }) {
  const job = findAdminJob(jobId)

  if (!job) return <AdminJobNotFound jobId={jobId} />

  const Page = ADMIN_JOB_PAGES[job.id]
  return <Page />
}

/** Dentro do shell (não `notFound()`), para o menu continuar disponível. */
function AdminJobNotFound({ jobId }: { jobId: string }) {
  const { t } = useTranslation('admin/jobs')

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[{ label: t('title'), href: '/admin/jobs' }]}
        title={t('notFound.title')}
      />
      <AdminEmptyState
        icon={SearchX}
        title={t('notFound.description', { id: jobId })}
        action={
          <Link
            href="/admin/jobs"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ArrowLeft className="size-4" />
            {t('notFound.back')}
          </Link>
        }
      />
    </div>
  )
}
