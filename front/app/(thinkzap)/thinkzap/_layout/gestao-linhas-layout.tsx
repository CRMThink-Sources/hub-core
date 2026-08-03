'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSession } from '@/providers/session-provider'
import { useAplicationContext } from '@/providers/aplication-provider'
import { listSubscriptionLines } from '@/shared/aplication/subscription-items'
import {
  EMPTY_SUBSCRIPTION_STATE,
  podeAlterarAssinaturaExistente,
} from '@/shared/billing/derive-subscription-state'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { envConfig } from '@/shared/infra/env-config'
import {
  GestaoLinhasPricingCard,
  type ThinkzapPricingResponse,
} from '../_components/gestao-linhas/gestao-linhas-pricing-card'
import { useTranslation } from 'react-i18next'
// banner de assinatura - revisar depois
// import { GestaoLinhasStatusBanner } from '../_components/gestao-linhas/gestao-linhas-status-banner'
import { buttonVariants } from '@/components/ui/button'
import { GestaoLinhasContratadas } from '../_components/gestao-linhas/gestao-linhas-contratadas'
import { ContratarLinhasModal } from '../_components/gestao-linhas/contratar-linhas-modal'

export default function GestaoLinhas() {
  const { t } = useTranslation('thinkzap/gestao-linhas/layout')
  const { t: tBanner } = useTranslation('thinkzap/gestao-linhas/status-banner')
  const { refreshSession } = useSession()
  const { state: aplicationState, refresh: refreshAplication } =
    useAplicationContext()
  const router = useRouter()

  const [quantidade, setQuantidade] = useState(1)
  // Linhas adicionais do WhatsApp Oficial (HubMessage). 0 = não contratar.
  const [quantidadeHub, setQuantidadeHub] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [pricing, setPricing] = useState<ThinkzapPricingResponse | null>(null)
  const [pricingLoading, setPricingLoading] = useState(true)
  const [pricingErro, setPricingErro] = useState<string | null>(null)
  const [modalContratarAberto, setModalContratarAberto] = useState(false)

  /**
   * Estado de assinatura derivado de `/api/application/me` (SPA), não mais de
   * `session.subscription` (Prisma). Enquanto o contexto não carrega, o estado
   * vazio mantém a tela no caminho "sem assinatura" — o mesmo que acontecia
   * antes com `session.subscription` ainda `undefined`.
   */
  const billing =
    aplicationState.status === 'ready'
      ? aplicationState.billing
      : EMPTY_SUBSCRIPTION_STATE

  const isTrial = billing.status === 'TRIALING'
  const isCancelled = billing.status === 'CANCELLED'
  const hasSubscription = billing.hasSubscription

  /** Linhas contratadas = itens das assinaturas, não conectores. */
  const linhas = listSubscriptionLines(
    aplicationState.status === 'ready' ? aplicationState.subscriptions : null,
  )
  const totalLinhas = linhas.length

  const temAssinaturaAjustavel =
    hasSubscription && podeAlterarAssinaturaExistente(billing.status)

  const linhasNaAssinatura = billing.connectorQuantity
  const totalAposContratar = temAssinaturaAjustavel
    ? linhasNaAssinatura + quantidade
    : quantidade

  /** Com assinatura: estimativa do valor mensal para o total de linhas após a alteração. */
  const linhasNaEstimativa = temAssinaturaAjustavel
    ? totalAposContratar
    : quantidade

  useEffect(() => {
    let cancelled = false
    setPricingLoading(true)
    setPricingErro(null)

    void (async () => {
      try {
        const resolved = resolveThinkzapClient()
        if (!resolved.ok) {
          if (!cancelled) setPricingLoading(false)
          return
        }

        const data =
          await resolved.client.get<ThinkzapPricingResponse>(
            '/thinkzap/pricing',
          )

        if (!cancelled) {
          setPricing(data)
        }
      } catch {
        if (!cancelled) {
          setPricing(null)
          setPricingErro(t('erroCarregarPrecos'))
        }
      } finally {
        if (!cancelled) setPricingLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleIncrement = () => setQuantidade(prev => prev + 1)
  const handleDecrement = () => setQuantidade(prev => (prev > 1 ? prev - 1 : 1))
  const handleIncrementHub = () => setQuantidadeHub(prev => prev + 1)
  const handleDecrementHub = () =>
    setQuantidadeHub(prev => (prev > 0 ? prev - 1 : 0))

  function handleContinuar() {
    if (quantidade < 1 && quantidadeHub < 1) return

    if (temAssinaturaAjustavel) {
      setModalContratarAberto(true)
      return
    }

    void handleExecutarContratacao()
  }

  async function handleExecutarContratacao() {
    if (quantidade < 1 && quantidadeHub < 1) return

    setSubmitting(true)
    try {
      const resolved = resolveThinkzapClient()
      if (!resolved.ok) {
        toast.error(resolved.message)
        return
      }

      if (hasSubscription) {
        // Tela única: envia as quantidades por provider; backend ajusta os dois line items.
        const additions: { ZAPI?: number; HUBMESSAGE?: number } = {}
        if (quantidade > 0) additions.ZAPI = quantidade
        if (quantidadeHub > 0) additions.HUBMESSAGE = quantidadeHub

        await resolved.client.post<{
          connectorQuantity?: number
        }>('/thinkzap/subscription/add-quantity', { additions })
        setModalContratarAberto(false)
        toast.success(
          t('linhasAdicionadas', { count: quantidade + quantidadeHub }),
        )
        setQuantidadeHub(0)
        // Assinatura mudou na SPA e conectores mudaram no banco: recarrega os
        // dois contextos.
        await Promise.all([refreshSession(), refreshAplication()])
      } else {
        const data = await resolved.client.post<{
          clientSecret?: string | null
        }>('/thinkzap/subscription/checkout', {
          quantity: quantidade,
          mode: 'subscription',
          priceId: envConfig.priceCodes.ThinkzapConnectorsCode,
        })
        if (data.clientSecret) {
          router.push(`/checkout?session_id=${data.clientSecret}`)
        }
      }
    } catch (e: unknown) {
      toast.error(thinkzapApiErrorMessage(e, t('erroAtualizarAssinatura')))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmTrial() {
    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      toast.error(resolved.message)
      return
    }

    setSubmitting(true)
    try {
      const data = await resolved.client.post<{ sessionId?: string | null }>(
        '/thinkzap/subscription/end-trial',
        {
          priceId: envConfig.priceCodes.ThinkzapConnectorsCode,
        },
      )
      console.log('data:', data)
      if (data.sessionId) {
        router.push(`/checkout?session_id=${data.sessionId}`)
      }
      // await refreshSession()
      // toast.success('Assinatura efetivada.')
      // router.push('/thinkzap/conexoes')
    } catch (e: unknown) {
      console.error((e as Error).message)
      toast.error(thinkzapApiErrorMessage(e, (e as Error).message))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReactivateSubscription() {
    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      toast.error(resolved.message)
      return
    }

    setSubmitting(true)
    try {
      const data = await resolved.client.post<{ clientSecret?: string | null }>(
        '/thinkzap/subscription/checkout',
        {
          quantity: quantidade > 0 ? quantidade : 1,
          mode: 'subscription',
          priceId: envConfig.priceCodes.ThinkzapConnectorsCode,
        },
      )

      if (data.clientSecret) {
        router.push(`/checkout?session_id=${data.clientSecret}`)
      }
    } catch (e: unknown) {
      toast.error(thinkzapApiErrorMessage(e, t('erroReativarAssinatura')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <ContratarLinhasModal
        isOpen={modalContratarAberto}
        quantidade={quantidade}
        quantidadeHub={quantidadeHub}
        linhasNaAssinatura={linhasNaAssinatura}
        submitting={submitting}
        onClose={() => setModalContratarAberto(false)}
        onConfirm={() => void handleExecutarContratacao()}
      />

      <div className="border-t border-border" />

      <div className="space-y-4">
        {/* banner de assinatura - revisar depois
        <GestaoLinhasStatusBanner
          isTrial={isTrial}
          isCancelled={isCancelled}
          hasSubscription={hasSubscription}
        />
        */}

        {!isTrial && !hasSubscription && (
          <div className="flex items-center justify-between">
            <p>{tBanner('semAssinatura')}</p>
            <Link href="/thinkzap/ativar-trial" className={buttonVariants()}>
              {tBanner('ativarTrial')}
            </Link>
          </div>
        )}

        <GestaoLinhasPricingCard
          submitting={submitting}
          quantidade={quantidade}
          quantidadeHub={quantidadeHub}
          pricing={pricing}
          pricingLoading={pricingLoading}
          pricingErro={pricingErro}
          linhasNaAssinatura={linhasNaAssinatura}
          totalAposContratar={totalAposContratar}
          linhasNaEstimativa={linhasNaEstimativa}
          temAssinaturaAjustavel={temAssinaturaAjustavel}
          isTrial={isTrial}
          isCancelled={isCancelled}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onIncrementHub={handleIncrementHub}
          onDecrementHub={handleDecrementHub}
          onContinue={handleContinuar}
          onReactivateSubscription={() => void handleReactivateSubscription()}
        />
      </div>

      <GestaoLinhasContratadas
        isTrial={isTrial}
        submitting={submitting}
        onConfirmTrial={() => void handleConfirmTrial()}
        linhas={linhas}
        totalLinhas={totalLinhas}
      />
    </div>
  )
}
