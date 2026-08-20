'use client'

import { useTranslation } from 'react-i18next'
import type { LineEntitlement } from '@/app/hooks/use-line-api'

type Props = {
  entitlement: Exclude<LineEntitlement, 'active'>
  /**
   * Namespace de tradução da aba. Cada uma explica o bloqueio na sua própria
   * linguagem — em Ajustes é "somente leitura", em Conexão é "não conecta mais" — e
   * um texto único diria a coisa errada em uma das duas.
   */
  namespace: string
}

/**
 * Por que a linha está travada, com tom de aviso e não de erro.
 *
 * Erro convida a tentar de novo. Aqui não há nada a repetir: o teste acabou, e o que
 * o cliente pode fazer é contratar. Por isso âmbar, e por isso o texto nomeia o
 * motivo em vez de dizer que algo falhou.
 */
export function LinhaBloqueadaAviso({ entitlement, namespace }: Props) {
  const { t } = useTranslation(namespace)

  const prefix = entitlement === 'trial-expired' ? 'trial' : 'inativa'

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
      <p className="text-sm font-medium">{t(`bloqueada.${prefix}Titulo`)}</p>
      <p className="mt-1 text-sm">{t(`bloqueada.${prefix}Descricao`)}</p>
    </div>
  )
}
