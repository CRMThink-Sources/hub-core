'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export function AccessDeniedPanel() {
  const { t } = useTranslation('thinkzap/access-denied')

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6 lg:px-8">
      <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 px-6 py-8">
        <h2 className="text-lg font-semibold text-amber-900">{t('title')}</h2>
        <p className="mt-2 text-sm text-amber-800">{t('description')}</p>
        <Link
          href="/thinkzap/ajuda"
          className="mt-4 inline-flex rounded-md bg-[#5A997E] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {t('backToHelp')}
        </Link>
      </div>
    </div>
  )
}
