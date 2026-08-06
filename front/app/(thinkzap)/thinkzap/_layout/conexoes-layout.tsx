'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAplicationContext } from '@/providers/aplication-provider'
import {
  needsSubscription,
  useLineSubscription,
} from '@/app/hooks/use-line-subscription'
import {
  countActiveLines,
  listSubscriptionLines,
} from '@/shared/aplication/subscription-items'
import { useTranslation } from 'react-i18next'
import { ConexoesHeaderCard } from '../_components/conexoes/conexoes-header-card'
import { ConexoesResumoConectados } from '../_components/conexoes/conexoes-resumo-conectados'
import { ConexoesTabelaConectores } from '../_components/conexoes/conexoes-tabela-conectores'
import { EmbeddedCheckout } from '../_components/conexoes/embedded-checkout'
import { NovaLinhaModal } from '../_components/conexoes/nova-linha-modal'
import { SubscriptionCard } from '../_components/conexoes/subscription-card'
import { TrialCard } from '../_components/conexoes/trial-card'

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
  const { t } = useTranslation('thinkzap/conexoes/nova-linha')
  const { state: aplicationState, refresh } = useAplicationContext()

  const [novaLinhaAberta, setNovaLinhaAberta] = useState(false)

  /**
   * Buscado aqui, uma vez: o card fala do contrato e cada linha oferece o plano
   * compatível com ela. Buscando em cada componente, seriam duas requisições e dois
   * estados capazes de discordar.
   *
   * Fica **antes** dos early returns porque hook não pode ser condicional.
   */
  const subscription = useLineSubscription()
  const planos =
    subscription.state.kind === 'ready' &&
    needsSubscription(subscription.state.subscription)
      ? subscription.state.plans
      : []

  /**
   * O catálogo para criar linha é **outro** conjunto: `planos` acima são os que a
   * tabela oferece para reativar uma linha bloqueada, e só existem quando a
   * instalação está sem direito de uso. Criar linha é oferecido justamente para quem
   * já paga, então a oferta aqui não pode depender daquela condição.
   */
  const catalogo =
    subscription.state.kind === 'ready' ? subscription.state.plans : []

  /**
   * Quem decide se a criação é possível é o servidor: é a mesma regra que a rota usa
   * para recusar, e reimplementá-la aqui deixaria as duas divergirem — com o cliente
   * vendo um botão que responde `409`.
   */
  const podeCriarLinha =
    subscription.state.kind === 'ready' &&
    subscription.state.subscription.status !== 'none' &&
    subscription.state.subscription.canCreateLine

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

      {/* Acima do resumo: quando há convite ao teste, ele é a ação principal da
          tela. O card se esconde sozinho quando não há nada a dizer. */}
      <TrialCard onActivated={() => void refresh()} />

      {/* Contrato vigente. Some sozinho quando a instalação só tem trial — quem
          fala do teste é o card acima. Não oferece plano: isso é da linha. */}
      <SubscriptionCard subscription={subscription} />

      {/**
       * Checkout embedado, **dentro** da tela: o app vive no iframe do Bitrix, e a
       * página hospedada do gateway não monta emoldurada. Aparece só com sessão
       * aberta, entre o card e a tabela — onde o cliente acabou de clicar.
       */}
      {subscription.checkoutSecret ? (
        <EmbeddedCheckout
          clientSecret={subscription.checkoutSecret}
          onClose={() => subscription.closeCheckout(false)}
          onComplete={() => subscription.closeCheckout(true)}
        />
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <ConexoesResumoConectados ativas={ativas} total={linhas.length} />

        {/**
         * A ação fica no cabeçalho da lista, e não numa linha: criar linha é da
         * instalação, não de uma linha específica — diferente de "assinar", que mora
         * na linha porque é ela que se assina.
         */}
        {podeCriarLinha ? (
          <Button type="button" onClick={() => setNovaLinhaAberta(true)}>
            {t('acao')}
          </Button>
        ) : null}
      </div>

      <NovaLinhaModal
        isOpen={novaLinhaAberta}
        planos={catalogo}
        criando={subscription.creating}
        onClose={() => setNovaLinhaAberta(false)}
        onCreate={(provider, planId) => {
          void subscription.createLine(provider, planId).then(criada => {
            /**
             * Fecha só quando terminou de verdade. O caminho de checkout mantém o
             * modal fora do caminho — o segredo abre a sessão embedada logo acima — e
             * o caminho sem checkout recarrega o contexto, porque a lista de linhas
             * vem dos itens de assinatura.
             */
            setNovaLinhaAberta(false)
            if (criada) {
              void refresh()
              void subscription.reload()
            }
          })
        }}
      />

      <ConexoesTabelaConectores
        linhas={linhas}
        planos={planos}
        redirecting={subscription.redirecting}
        onSubscribe={planId => void subscription.subscribe(planId)}
      />
    </div>
  )
}
