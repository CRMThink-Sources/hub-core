'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { axiosPortal } from '@/infra/client/axios-portal'
import { Input } from '@/components/ui/input'
import type { ListPortalDomainsResponse } from '@/lib/portal-domains'
import { AdminClientsTable } from './admin-clients-table'

export function AdminClientsPage() {
  const { t } = useTranslation('admin/clients')
  const { t: tCommon } = useTranslation('common')
  const [domains, setDomains] = useState<ListPortalDomainsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setHasError(false)

      try {
        const result =
          await axiosPortal().get<ListPortalDomainsResponse>('/portal/domains')
        if (!cancelled) {
          setDomains(result)
        }
      } catch {
        if (!cancelled) {
          setHasError(true)
          setDomains(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">{tCommon('carregando')}</p>
    )
  }

  if (hasError) {
    return (
      <div className="admin-card p-6">
        <h2 className="text-lg font-medium text-foreground">
          {t('errorTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('errorDescription')}
        </p>
      </div>
    )
  }

  const list = domains?.domains ?? []
  const filteredList = list.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('description')}</p>
      </div>

      {list.length === 0 ? (
        <div className="admin-card p-6">
          <h2 className="text-lg font-medium text-foreground">
            {t('emptyTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('emptyDescription')}
          </p>
        </div>
      ) : (
        <>
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="max-w-sm"
          />
          <AdminClientsTable
            domains={filteredList}
            hasSearch={search.length > 0}
          />
        </>
      )}
    </div>
  )
}
