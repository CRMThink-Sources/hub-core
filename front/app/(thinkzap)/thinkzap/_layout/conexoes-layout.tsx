'use client'

import { useAplicationContext } from '@/providers/aplication-provider'
import {
  countActiveLines,
  listSubscriptionLines,
} from '@/shared/aplication/subscription-items'
import { useTranslation } from 'react-i18next'
import { ConexoesHeaderCard } from '../_components/conexoes/conexoes-header-card'
import { ConexoesResumoConectados } from '../_components/conexoes/conexoes-resumo-conectados'
import { ConexoesTabelaConectores } from '../_components/conexoes/conexoes-tabela-conectores'

/**
 * Lista de conexões a partir dos itens de assinatura de
 * `GET /api/application/me`.
 *
 * Conector/instância saíram: a linha do cliente é o item da assinatura. Com isso
 * saíram também da lista os fluxos que só existiam por causa do conector —
 * conectar/QR code, vincular/desvincular canal, desconectar, cancelar conector e
 * o link para a tela de configuração, que resolvia por `connectorId`. Esses
 * fluxos e o status de conexão passam para a tela de configuração, a ser
 * replanejada.
 */
export default function ConexoesLayout() {
  const { t: tCommon } = useTranslation('common')
  const { state: aplicationState } = useAplicationContext()

  if (aplicationState.status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="animate-pulse text-sm font-medium text-muted-foreground">
          {tCommon('carregando')}
        </span>
      </div>
    )
  }

  // Falha de leitura NÃO vira lista vazia: uma tela sem linhas convidaria a
  // contratar de novo quem já paga.
  if (aplicationState.status !== 'ready') {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <p className="text-sm font-medium">
          Não foi possível carregar suas linhas
        </p>
        <p className="mt-1 text-sm">
          {aplicationState.status === 'error'
            ? aplicationState.message
            : aplicationState.status === 'not-found'
              ? 'Instalação não encontrada neste portal.'
              : 'Sessão expirada. Reabra a aplicação pelo Bitrix24.'}
        </p>
      </div>
    )
  }

  const linhas = listSubscriptionLines(aplicationState.subscriptions)
  const ativas = countActiveLines(linhas)
  const billing = aplicationState.billing

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <ConexoesHeaderCard
          hasSubscription={billing.hasSubscription}
          subscriptionStatus={billing.status ?? undefined}
        />
      </div>

      <ConexoesResumoConectados ativas={ativas} total={linhas.length} />

      <ConexoesTabelaConectores linhas={linhas} />
    </div>
  )
}
