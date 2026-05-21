'use client'

import { AtivarTrialForm } from './ativar-trial-form'
import { useTranslation } from 'react-i18next'

export default function AtivarTrialPage() {
  const { t } = useTranslation('thinkzap/ativar-trial')

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {t('titulo')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitulo')}</p>
        </div>
        <AtivarTrialForm />
      </div>
    </div>
  )
}
