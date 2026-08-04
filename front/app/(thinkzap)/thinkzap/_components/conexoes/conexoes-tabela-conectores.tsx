'use client'

import type { SubscriptionLine } from '@/shared/aplication/subscription-items'
import type { OfferablePlan } from '@/app/hooks/use-line-subscription'
import { plansForProvider } from '@/app/hooks/use-line-subscription'
import { ConexaoRow } from './conexao-row'
import { useTranslation } from 'react-i18next'

type Props = {
  linhas: SubscriptionLine[] | undefined
  /**
   * Planos ofertáveis da instalação. A tabela filtra por conector antes de passar
   * para cada linha — plano de WhatsApp Oficial não serve a uma linha do WhatsApp
   * Web, e oferecê-lo cobraria o conector errado.
   */
  planos?: OfferablePlan[]
  redirecting?: string | null
  onSubscribe?: (planId: string) => void
}

/**
 * Largura da coluna de ação, igual no cabeçalho e nas linhas.
 *
 * Fixa de propósito: uma célula de largura automática não pode ser espelhada por um
 * espaçador vazio no cabeçalho. Cabe o rótulo com preço de um plano só
 * (`Assinar · R$ 100,00/mês`) e, com mais de um, o `select` encolhe para caber ao
 * lado do botão curto.
 */
const ACAO_COL = 'w-56 shrink-0'

export function ConexoesTabelaConectores({
  linhas,
  planos = [],
  redirecting = null,
  onSubscribe,
}: Props) {
  const { t } = useTranslation('thinkzap/conexoes/tabela-conectores')
  const lista = linhas ?? []
  const ultimoIndice = lista.length - 1

  const planosPorLinha = lista.map(linha =>
    plansForProvider(planos, linha.provider),
  )

  /**
   * A coluna de ação é reservada no cabeçalho **e** em toda linha quando qualquer
   * linha tem plano a oferecer.
   *
   * Tem que ser nas duas pontas: a linha com botão ganha uma terceira célula, e sem
   * a mesma reserva no cabeçalho os dois `flex-1` dele ficam mais largos que os da
   * linha — o que desalinha o STATUS. Reservar em toda linha, mesmo nas sem botão,
   * é o que mantém as linhas alinhadas entre si.
   */
  const mostrarAcoes =
    onSubscribe !== undefined && planosPorLinha.some(p => p.length > 0)

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
        {mostrarAcoes ? <div className={ACAO_COL} aria-hidden /> : null}
      </div>

      {lista.map((linha, index) => (
        <ConexaoRow
          key={linha.id}
          linha={linha}
          showBorderBottom={index !== ultimoIndice}
          planos={planosPorLinha[index] ?? []}
          reservarAcoes={mostrarAcoes}
          redirecting={redirecting}
          onSubscribe={onSubscribe}
        />
      ))}
    </div>
  )
}
