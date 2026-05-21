'use client'

import Link from 'next/link'
import { BookOpen, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function AjudaPage() {
  const { t } = useTranslation('thinkzap/ajuda/page')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex w-full gap-6 rounded-lg border border-gray-100 bg-white p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#5A997E]/10">
          <BookOpen className="h-8 w-8 text-[#5A997E]" />
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="page-title">{t('title')}</h1>
            <p className="page-subtitle mt-1">{t('subtitle')}</p>
          </div>

          <div className="shrink-0">
            <Link
              href="https://crmthink.gitbook.io/thinkzap"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#5A997E] px-5 py-2.5 font-medium text-white transition-colors hover:bg-[#4a8169]"
            >
              {t('abrirManual')}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
