'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/providers/session-provider'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { envConfig } from '@/shared/infra/env-config'
import {
  GestaoLinhasPricingCard,
  type ThinkzapPricingResponse,
} from '../_components/gestao-linhas/gestao-linhas-pricing-card'
import { GestaoLinhasStatusBanner } from '../_components/gestao-linhas/gestao-linhas-status-banner'
import { GestaoLinhasContratadas } from '../_components/gestao-linhas/gestao-linhas-contratadas'

/** Alinhado ao backend: ACTIVE, TRIALING, PAST_DUE permitem aumentar linhas na mesma assinatura. */
function podeAlterarAssinaturaExistente(status: string | undefined): boolean {
  return status === 'ACTIVE' || status === 'TRIALING' || status === 'PAST_DUE'
}

export default function GestaoLinhas() {
  const { session, refreshSession } = useSession()
  const router = useRouter()

  const [quantidade, setQuantidade] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pricing, setPricing] = useState<ThinkzapPricingResponse | null>(null)
  const [pricingLoading, setPricingLoading] = useState(true)
  const [pricingErro, setPricingErro] = useState<string | null>(null)

  const isTrial = useMemo(() => {
    return session?.subscription?.status === 'TRIALING'
  }, [session?.subscription?.status])
  const isCancelled = useMemo(() => {
    return session?.subscription?.status === 'CANCELLED'
  }, [session?.subscription?.status])

  const hasSubscription = useMemo(() => {
    return session?.subscription !== null
  }, [session?.subscription])

  const totalLinhas = session?.connectors?.length ?? 0
  const subscription = session?.subscription as
    | {
        status: string
        connectorQuantity: number
        trialEndsAt: string | null
      }
    | null
    | undefined

  const temAssinaturaAjustavel =
    subscription != null && podeAlterarAssinaturaExistente(subscription.status)

  const linhasNaAssinatura = subscription?.connectorQuantity ?? 0
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
          setPricingErro(
            'Não foi possível carregar os preços. Tente novamente.',
          )
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

  async function handleContinuar() {
    if (quantidade < 1) return
    setErro(null)

    setSubmitting(true)
    try {
      const resolved = resolveThinkzapClient()
      if (!resolved.ok) {
        setErro(resolved.message)
        return
      }

      if (hasSubscription) {
        const body = await resolved.client.post<{
          connectorQuantity?: number
        }>('/thinkzap/subscription/add-quantity', {
          additionalQuantity: quantidade,
        })
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
      setErro(
        thinkzapApiErrorMessage(e, 'Não foi possível atualizar a assinatura.'),
      )
    } finally {
      setSubmitting(false)
    }
    return

    // router.push(`/checkout?quantity=${quantidade}`)
  }

  async function handleActivateTrial() {
    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setErro(resolved.message)
      return
    }

    setErro(null)
    try {
      const data = await resolved.client.post<{ clientSecret?: string | null }>(
        '/thinkzap/subscription/checkout',
        {
          quantity: 1,
          mode: 'trial',
          priceId: envConfig.priceCodes.ThinkzapConnectorsCode,
        },
      )

      if (data.clientSecret) {
        router.push(`/checkout?session_id=${data.clientSecret}`)
      }
    } catch (e: unknown) {
      setErro(
        thinkzapApiErrorMessage(
          e,
          'Não foi possível iniciar o trial. Tente novamente.',
        ),
      )
    }
  }

  async function handleConfirmTrial() {
    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setErro(resolved.message)
      return
    }

    setErro(null)
    setSubmitting(true)
    try {
      await resolved.client.post('/thinkzap/subscription/end-trial')
      await refreshSession()
      router.push('/thinkzap/conexoes')
    } catch (e: unknown) {
      setErro(
        thinkzapApiErrorMessage(
          e,
          'Não foi possível efetivar a assinatura. Tente novamente.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReactivateSubscription() {
    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setErro(resolved.message)
      return
    }

    setErro(null)
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
      setErro(
        thinkzapApiErrorMessage(
          e,
          'Não foi possível reativar a assinatura. Tente novamente.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="border-t border-gray-200" />

      <div className="space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-5">
        <GestaoLinhasStatusBanner
          isTrial={isTrial}
          isCancelled={isCancelled}
          hasSubscription={hasSubscription}
          submitting={submitting}
          onActivateTrial={() => void handleActivateTrial()}
          onConfirmTrial={() => void handleConfirmTrial()}
        />

        {
          <GestaoLinhasPricingCard
            erro={erro}
            submitting={submitting}
            quantidade={quantidade}
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
            onContinue={() => void handleContinuar()}
            onConfirmTrial={() => void handleConfirmTrial()}
            onReactivateSubscription={() => void handleReactivateSubscription()}
          />
        }
      </div>

      <GestaoLinhasContratadas
        connectors={
          (session?.connectors ?? []) as Array<{
            id: string
            instance: {
              name?: string | null
              phoneNumber?: string | null
              status?: string | null
            }
          }>
        }
        totalLinhas={totalLinhas}
      />
    </div>
  )
}
