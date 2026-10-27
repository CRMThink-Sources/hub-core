'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'

export function ThinkbotSemConector() {
  const { t } = useTranslation('thinkzap/bots/lista')

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Lock aria-hidden className="size-5" />
      </span>
      <div className="max-w-md">
        <h2 className="text-lg font-semibold text-amber-900">
          {t('semConector.titulo')}
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          {t('semConector.descricao')}
        </p>
      </div>
      <Link href="/thinkzap/conexoes" className={buttonVariants()}>
        {t('semConector.acao')}
      </Link>
    </div>
  )
}
