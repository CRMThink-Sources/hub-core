'use client'

import { useTranslation } from 'react-i18next'
import { InstallLayout, InstallCard } from './install-layout'

interface InstallSuccessProps {
  title?: string
  description?: string
}

export function InstallSuccess({ title, description }: InstallSuccessProps) {
  const { t } = useTranslation('bitrix/install')

  return (
    <InstallLayout>
      <InstallCard className="p-10 text-center">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-4 ring-emerald-100/80"
          aria-hidden
        >
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">
          {title ?? t('success.title')}
        </h1>
        <p className="mt-3 text-slate-600">
          {description ?? t('success.description')}
        </p>
      </InstallCard>
    </InstallLayout>
  )
}
