'use client'

import type { SubscriptionLine } from '@/shared/aplication/subscription-items'
import { ConexaoRow } from './conexao-row'
import { useTranslation } from 'react-i18next'

type Props = {
  linhas: SubscriptionLine[] | undefined
}

export function ConexoesTabelaConectores({ linhas }: Props) {
  const { t } = useTranslation('thinkzap/conexoes/tabela-conectores')
  const lista = linhas ?? []
  const ultimoIndice = lista.length - 1

  return (
    <div className="w-full overflow-visible rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4 rounded-t-xl border-b border-border bg-muted px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('colunas.nome')}
          </span>
        </div>
        <div className="flex flex-1 justify-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('colunas.status')}
          </span>
        </div>
      </div>

      {lista.map((linha, index) => (
        <ConexaoRow
          key={linha.id}
          linha={linha}
          showBorderBottom={index !== ultimoIndice}
        />
      ))}
    </div>
  )
}
