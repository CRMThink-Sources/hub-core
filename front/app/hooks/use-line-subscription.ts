'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { extractThinkzapError } from '@/app/hooks/extract-thinkzap-error'

export type SubscriptionModality = 'stripe' | 'manual'

export type PlanInterval = 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export type LineProvider = 'ZAPI' | 'HUBMESSAGE'

/** Espelha `OfferablePlan` da api. Sem price id: o servidor resolve. */
export type OfferablePlan = {
  id: string
  name: string
  /** Centavos — a formatação é da tela, que tem o locale do operador. */
  amount: number
  interval: PlanInterval
  /** Conector que o plano precifica. É o que casa o plano com a linha. */
  provider: LineProvider
}

/** Espelha `LineSubscriptionState` da api. */
export type SubscriptionState =
  | { status: 'none' }
  | {
      status: 'active' | 'past_due' | 'cancelled' | 'trialing'
      modality: SubscriptionModality
      isTrial: boolean
      currentPeriodStart: string
      currentPeriodEnd: string
      plan: OfferablePlan
      entitlement: 'active' | 'trial-expired' | 'inactive'
      billingPortalAvailable: boolean
      canSubscribe: boolean
    }

export type LineSubscription =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready'
      subscription: SubscriptionState
      plans: OfferablePlan[]
      /**
       * A instalação tem linhas de conectores diferentes, e nenhum plano cobre isso.
       * Distingue "não há plano cadastrado" de "não há plano possível" — as duas dão
       * lista vazia, e só esta pede contato com o suporte.
       */
      mixedProviders: boolean
      /** Pagou e o webhook ainda não chegou. */
      processing: boolean
    }

/**
 * Quanto tempo a tela espera o webhook depois de o cliente voltar do checkout.
 *
 * Existe porque a confirmação é assíncrona: o cliente pagou, o gateway redireciona
 * na hora, e o webhook chega segundos depois. Sem esta espera a tela mostraria
 * "bloqueado" para quem acabou de pagar — e o cliente abre chamado.
 */
const PROCESSING_POLL_MS = 3000
const PROCESSING_TIMEOUT_MS = 90_000

/**
 * Abre o portal de faturamento numa aba **top-level**.
 *
 * Diferente do checkout, o portal do gateway **não** tem modo embedado: é página
 * hospedada, e emoldurada no iframe do Bitrix ela trava do mesmo jeito. Aba nova é o
 * único caminho. `window.top.location` não serve — origem diferente, acesso negado.
 *
 * `tab` vem aberta de fora, no gesto do clique. Popup bloqueado cai para navegar o
 * próprio iframe: pior, mas melhor que não ir a lugar nenhum.
 */
function openTopLevel(tab: Window | null, url: string): void {
  if (tab && !tab.closed) {
    tab.location.assign(url)
    return
  }
  window.location.assign(url)
}

/**
 * Contrato e planos da instalação, buscados **uma vez** para a tela inteira.
 *
 * Vive num hook, e não dentro do card, porque duas superfícies consomem o mesmo
 * dado: o card fala do contrato vigente, e cada linha da tabela oferece o plano
 * compatível com ela. Buscando em cada componente, seriam duas requisições e dois
 * estados capazes de discordar.
 */
export function useLineSubscription() {
  const { t } = useTranslation('thinkzap/conexoes/subscription')
  const searchParams = useSearchParams()
  const [state, setState] = useState<LineSubscription>({ kind: 'loading' })
  const [redirecting, setRedirecting] = useState<string | null>(null)
  const [processing, setProcessing] = useState(
    searchParams?.get('checkout') === 'success',
  )

  const load = useCallback(async () => {
    try {
      const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))

      /**
       * As duas leituras juntas: a tela decide entre "mostrar contrato" e "oferecer
       * plano" com as duas em mãos, e em sequência ela piscaria de um estado para o
       * outro.
       */
      const [subscription, plans] = await Promise.all([
        client.get<{ subscription: SubscriptionState }>(
          '/thinkzap/subscription',
        ),
        client.get<{ plans: OfferablePlan[]; mixedProviders: boolean }>(
          '/thinkzap/plans',
        ),
      ])

      setState({
        kind: 'ready',
        subscription: subscription.subscription,
        plans: plans.plans,
        mixedProviders: plans.mixedProviders,
        processing: false,
      })

      return subscription.subscription
    } catch (err: unknown) {
      setState({
        kind: 'error',
        message: extractThinkzapError(err, t('erroLeitura')),
      })
      return null
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Enquanto "processando", relê até a assinatura paga aparecer. O timeout evita
   * poll infinito quando o webhook não chega: aí a tela volta ao estado real, com
   * o aviso de que o pagamento pode levar alguns minutos.
   */
  useEffect(() => {
    if (!processing) return

    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - startedAt > PROCESSING_TIMEOUT_MS) {
        setProcessing(false)
        return
      }

      void load().then(subscription => {
        if (
          subscription &&
          subscription.status !== 'none' &&
          !subscription.isTrial &&
          subscription.entitlement === 'active'
        ) {
          setProcessing(false)
        }
      })
    }, PROCESSING_POLL_MS)

    return () => clearInterval(timer)
  }, [processing, load])

  /**
   * `client_secret` da sessão embedada, ou `null` quando não há checkout aberto.
   *
   * O checkout monta **dentro** da tela, então o segredo é estado desta tela — não
   * há navegação, e nada leva o cliente para fora do iframe do Bitrix.
   */
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null)

  const subscribe = useCallback(
    async (planId: string) => {
      setRedirecting(planId)
      try {
        const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
        const res = await client.post<{ clientSecret: string }>(
          '/thinkzap/subscription/checkout',
          { planId },
        )

        setCheckoutSecret(res.clientSecret)
      } catch (err: unknown) {
        toast.error(extractThinkzapError(err, t('erroCheckout')))
      } finally {
        setRedirecting(null)
      }
    },
    [t],
  )

  /**
   * Fecha o checkout embedado.
   *
   * Entra em "processando" ao fechar depois de pagar: o gateway navega o frame dele
   * para a `return_url`, mas quem observa a ativação é esta tela — e o webhook chega
   * segundos depois. Sem isso a tela voltaria a "bloqueado" para quem acabou de pagar.
   */
  const closeCheckout = useCallback((paid: boolean) => {
    setCheckoutSecret(null)
    if (paid) setProcessing(true)
  }, [])

  const openBillingPortal = useCallback(async () => {
    const tab = window.open('', '_blank')

    setRedirecting('portal')
    try {
      const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
      const res = await client.post<{ url: string }>(
        '/thinkzap/subscription/billing-portal',
        {},
      )
      openTopLevel(tab, res.url)
      setRedirecting(null)
    } catch (err: unknown) {
      tab?.close()
      toast.error(extractThinkzapError(err, t('erroPortal')))
      setRedirecting(null)
    }
  }, [t])

  return {
    state: state.kind === 'ready' ? { ...state, processing } : state,
    redirecting,
    subscribe,
    checkoutSecret,
    closeCheckout,
    openBillingPortal,
    reload: load,
  }
}

export type UseLineSubscription = ReturnType<typeof useLineSubscription>

/**
 * Planos que servem a uma linha: os do mesmo conector.
 *
 * Filtrar por provider é o que torna o botão na linha honesto — oferecer plano de
 * WhatsApp Oficial numa linha do WhatsApp Web levaria a um checkout que cobra o
 * conector errado.
 */
export function plansForProvider(
  plans: OfferablePlan[],
  provider: string,
): OfferablePlan[] {
  return plans.filter(plan => plan.provider === provider)
}

/** A instalação está sem direito de uso e pode contratar? */
export function needsSubscription(subscription: SubscriptionState): boolean {
  if (subscription.status === 'none') return true
  return subscription.entitlement !== 'active' && subscription.canSubscribe
}
