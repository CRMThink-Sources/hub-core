'use client'

import { useTranslation } from 'react-i18next'
import { InfoIcon } from 'lucide-react'

type Props = {
  connected: number
  total: number
}

export function ConexoesResumoConectados({ connected, total }: Props) {
  const { t } = useTranslation('thinkzap/conexoes/resumo-conectados')

  return (
    <div className="w-full">
      <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
        <InfoIcon className="size-4" />
        <span>{t('numerosConectados', { connected, total })}</span>
      </div>
    </div>
  )
}
