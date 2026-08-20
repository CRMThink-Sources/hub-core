'use client'

import { useTranslation } from 'react-i18next'
import { InfoIcon } from 'lucide-react'

type Props = {
  ativas: number
  total: number
}

/**
 * Contagem de linhas contratadas. Deixou de ser "números conectados": sem
 * conector/instância não há status de conexão nesta tela — `ativas` é o item de
 * assinatura ativo, não o número autenticado no WhatsApp.
 */
export function ConexoesResumoConectados({ ativas, total }: Props) {
  const { t } = useTranslation('thinkzap/conexoes/resumo-conectados')

  return (
    <div className="w-full">
      <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
        <InfoIcon className="size-4" />
        <span>{t('linhasAtivas', { ativas, total })}</span>
      </div>
    </div>
  )
}
