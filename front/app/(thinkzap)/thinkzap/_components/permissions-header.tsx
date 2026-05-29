'use client'

import Link from 'next/link'
import { BookOpen, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function PermissionsHeader() {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-100 bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <Shield className="h-7 w-7 text-blue-600" />
        </div>
        <div>
          <h1 className="page-title">{t('pageTitle')}</h1>
          <p className="page-subtitle mt-1 max-w-2xl">{t('pageDescription')}</p>
        </div>
      </div>

      <Link
        href="/thinkzap/ajuda"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-blue-200 bg-background px-4 py-2 text-sm font-medium text-blue-700 shadow-xs transition-colors hover:bg-blue-50"
      >
        <BookOpen className="h-4 w-4" />
        {t('quickGuide')}
      </Link>
    </div>
  )
}
