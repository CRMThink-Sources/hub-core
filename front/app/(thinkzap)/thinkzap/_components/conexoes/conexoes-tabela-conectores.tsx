'use client'

import { useState } from 'react'
import type { SubscriptionLine } from '@/shared/aplication/subscription-items'
import type { OfferablePlan } from '@/app/hooks/use-line-subscription'
import { plansForProvider } from '@/app/hooks/use-line-subscription'
import { ConexaoRow } from './conexao-row'
import { ExcluirLinhaDialog } from './excluir-linha-dialog'
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
  /**
   * Exclui a linha. Ausente esconde o menu de ações — é o caso das superfícies que
   * só listam.
   *
   * A tabela é dona da confirmação, e não a linha, porque só ela enxerga as outras:
   * "é a última do contrato" é uma pergunta sobre o conjunto.
   */
  onDelete?: (lineId: string) => Promise<void>
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
  onDelete,
}: Props) {
  const { t } = useTranslation('thinkzap/conexoes/tabela-conectores')
  const lista = linhas ?? []
  const ultimoIndice = lista.length - 1

  /** Linha em confirmação de exclusão, e a que está sendo excluída de fato. */
  const [confirmando, setConfirmando] = useState<SubscriptionLine | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  const planosPorLinha = lista.map(linha =>
    plansForProvider(planos, linha.provider),
  )

  /**
   * Quantas linhas **ativas** cada contrato ainda tem.
   *
   * É o que responde "excluir esta encerra a assinatura?". Só ativas contam: linha
   * cancelada já não é cobrada, e incluí-la faria a última linha viva parecer
   * acompanhada.
   */
  const ativasPorContrato = new Map<string, number>()
  for (const linha of lista) {
    if (linha.status !== 'active') continue

    ativasPorContrato.set(
      linha.subscriptionId,
      (ativasPorContrato.get(linha.subscriptionId) ?? 0) + 1,
    )
  }

  const ehUltimaDoContrato = (linha: SubscriptionLine) =>
    linha.status === 'active' &&
    (ativasPorContrato.get(linha.subscriptionId) ?? 0) === 1

  /**
   * A coluna de ação é reservada no cabeçalho **e** em toda linha.
   *
   * Antes dependia de haver plano a oferecer; agora o menu de ações existe em toda
   * linha, então a reserva é incondicional sempre que a exclusão está disponível.
   *
   * Tem que ser nas duas pontas: a linha com botão ganha uma terceira célula, e sem
   * a mesma reserva no cabeçalho os dois `flex-1` dele ficam mais largos que os da
   * linha — o que desalinha o STATUS.
   */
  const mostrarAcoes =
    onDelete !== undefined ||
    (onSubscribe !== undefined && planosPorLinha.some(p => p.length > 0))

  async function handleConfirm(linha: SubscriptionLine) {
    if (!onDelete) return

    setExcluindo(linha.id)
    try {
      await onDelete(linha.id)
      setConfirmando(null)
    } finally {
      setExcluindo(null)
    }
  }

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
          excluindo={excluindo === linha.id}
          onDelete={onDelete ? () => setConfirmando(linha) : undefined}
        />
      ))}

      {confirmando ? (
        <ExcluirLinhaDialog
          nome={confirmando.name || t('semNome')}
          ultimaDoContrato={ehUltimaDoContrato(confirmando)}
          excluindo={excluindo === confirmando.id}
          onCancel={() => setConfirmando(null)}
          onConfirm={() => void handleConfirm(confirmando)}
        />
      ) : null}
    </div>
  )
}
